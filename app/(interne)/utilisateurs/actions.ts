"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getInternalAccess } from "@/lib/auth/access";
import { SCREEN_ROLES } from "@/lib/auth/roles";
import { getServerEnv } from "@/lib/env";
import { failure, formObject, invalid, success, type FormState } from "@/lib/forms";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  accessLinkSchema,
  changeRoleSchema,
  inviteUserSchema,
  resendInviteSchema,
  resetMfaSchema,
  resetPasswordSchema,
  setActiveSchema,
} from "@/lib/validation/users";

const ADMIN_ONLY = "Action réservée à l’administrateur (avec double authentification validée).";
const BAN_FOREVER = "876000h";
const LINK_NOTICE =
  "Lien personnel, à usage unique et valable peu de temps : envoyez-le uniquement à cette personne (WhatsApp, en main propre).";

function invitationRedirect(): string {
  return `${getServerEnv().APP_URL}/auth/confirm?next=/compte/mot-de-passe`;
}

/**
 * Lien d’accès à usage unique, sans envoi d’e-mail : ouvre une session puis mène au choix du mot de passe.
 * La double authentification reste exigée ensuite pour les rôles concernés.
 */
async function createAccessLink(email: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) return null;
  const params = new URLSearchParams({ token_hash: tokenHash, type: "recovery", next: "/compte/mot-de-passe" });
  return `${getServerEnv().APP_URL}/auth/confirm?${params.toString()}`;
}

function emailAlreadyUsed(): FormState {
  return {
    ...failure("Un compte existe déjà avec cette adresse e-mail."),
    fieldErrors: { email: "Adresse déjà utilisée." },
  };
}

/**
 * US-1.2 : l’administrateur crée un utilisateur et lui attribue un rôle.
 * Le compte d’authentification est créé avec la clé service_role ; le profil (rôle) est créé au nom de
 * l’administrateur connecté, pour que le journal d’audit enregistre son identité (trigger profiles_audit).
 */
export async function inviteUser(_previous: FormState, formData: FormData): Promise<FormState> {
  const access = await getInternalAccess(SCREEN_ROLES.usersWrite);
  if (!access) return failure(ADMIN_ONLY);

  const parsed = inviteUserSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { email, fullName, role, delivery } = parsed.data;

  const admin = createSupabaseAdminClient();
  const { data, error } =
    delivery === "email"
      ? await admin.auth.admin.inviteUserByEmail(email, {
          redirectTo: invitationRedirect(),
          data: { full_name: fullName },
        })
      : await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error || !data.user) {
    if (error?.code === "email_exists" || error?.status === 422) return emailAlreadyUsed();
    if (error?.code === "over_email_send_rate_limit") {
      return failure(
        "Limite d’envoi d’e-mails atteinte. Réessayez dans quelques minutes, ou choisissez le lien à copier.",
      );
    }
    return failure("Le compte n’a pas pu être créé. Réessayez plus tard.");
  }

  const supabase = await createSupabaseServerClient();
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id: data.user.id, email, full_name: fullName, role });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return failure("Le profil n’a pas pu être créé : la création du compte a été annulée. Réessayez.");
  }
  revalidatePath("/utilisateurs");

  if (delivery === "email") {
    return success(`Invitation envoyée à ${email}. La personne choisira son mot de passe depuis le lien reçu.`);
  }

  const link = await createAccessLink(email);
  if (!link) return failure("Compte créé, mais le lien n’a pas pu être généré : utilisez « Obtenir un lien d’accès ».");
  await supabase.rpc("log_audit", { p_action: "access_link", p_object_type: "profiles", p_object_id: data.user.id });
  return success(`Compte créé pour ${email}. ${LINK_NOTICE}`, { lien: link });
}

/** Nouveau lien d’accès pour un compte existant (première connexion, mot de passe oublié). */
export async function generateAccessLink(_previous: FormState, formData: FormData): Promise<FormState> {
  const access = await getInternalAccess(SCREEN_ROLES.usersWrite);
  if (!access) return failure(ADMIN_ONLY);

  const parsed = accessLinkSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, "Demande invalide.");
  if (parsed.data.userId === access.userId)
    return failure("Utilisez « Mot de passe oublié » pour votre propre compte.");

  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, active")
    .eq("id", parsed.data.userId)
    .maybeSingle();
  if (!profile) return failure("Utilisateur introuvable.");
  if (!profile.active) return failure("Compte désactivé : réactivez-le avant de générer un lien.");

  const link = await createAccessLink(profile.email);
  if (!link) return failure("Le lien n’a pas pu être généré. Réessayez.");
  await supabase.rpc("log_audit", {
    p_action: "access_link",
    p_object_type: "profiles",
    p_object_id: parsed.data.userId,
  });
  return success(LINK_NOTICE, { lien: link });
}

export async function changeRole(_previous: FormState, formData: FormData): Promise<FormState> {
  const access = await getInternalAccess(SCREEN_ROLES.usersWrite);
  if (!access) return failure(ADMIN_ONLY);

  const parsed = changeRoleSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, "Rôle invalide.");
  if (parsed.data.userId === access.userId) return failure("Vous ne pouvez pas modifier votre propre rôle.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.userId)
    .neq("role", "client")
    .select("id");
  if (error?.code === "23514") return failure("Il doit rester au moins un administrateur actif.");
  if (error || !data?.length) return failure("Le rôle n’a pas pu être modifié.");

  revalidatePath("/utilisateurs");
  return success("Rôle enregistré.");
}

export async function setUserActive(_previous: FormState, formData: FormData): Promise<FormState> {
  const access = await getInternalAccess(SCREEN_ROLES.usersWrite);
  if (!access) return failure(ADMIN_ONLY);

  const parsed = setActiveSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, "Demande invalide.");
  const { userId, active } = parsed.data;
  if (userId === access.userId) return failure("Vous ne pouvez pas désactiver votre propre compte.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("profiles").update({ active }).eq("id", userId).select("id");
  if (error?.code === "23514") return failure("Il doit rester au moins un administrateur actif.");
  if (error || !data?.length) return failure("Le compte n’a pas pu être modifié.");

  // Bloque aussi la connexion côté authentification (la RLS refuse déjà tout accès à un compte inactif).
  const admin = createSupabaseAdminClient();
  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : BAN_FOREVER,
  });

  revalidatePath("/utilisateurs");
  if (banError) {
    return failure(
      active
        ? "Compte réactivé, mais la connexion n’a pas pu être débloquée. Réessayez."
        : "Compte désactivé (aucun accès aux données), mais la connexion n’a pas pu être bloquée. Réessayez.",
    );
  }
  return success(active ? "Compte réactivé." : "Compte désactivé.");
}

export async function resendInvite(_previous: FormState, formData: FormData): Promise<FormState> {
  const access = await getInternalAccess(SCREEN_ROLES.usersWrite);
  if (!access) return failure(ADMIN_ONLY);

  const parsed = resendInviteSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error, "Demande invalide.");

  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase.from("profiles").select("email").eq("id", parsed.data.userId).maybeSingle();
  if (!profile) return failure("Utilisateur introuvable.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(profile.email, { redirectTo: invitationRedirect() });
  if (error) return failure("L’invitation n’a pas pu être renvoyée (le compte est peut-être déjà activé).");

  await supabase.rpc("log_audit", {
    p_action: "resend_invite",
    p_object_type: "profiles",
    p_object_id: parsed.data.userId,
  });
  return success(`Invitation renvoyée à ${profile.email}.`);
}

/**
 * Contrôle d’accès en base, fermeture de toutes les sessions du compte et ligne d’audit (fonction
 * admin_revoke_user_sessions). Renvoie un message d’échec, ou null si tout s’est bien passé.
 */
async function revokeSessions(userId: string, action: "password_reset" | "mfa_reset"): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_revoke_user_sessions", { p_user_id: userId, p_action: action });
  if (!error) return null;
  if (error.code === "42501") return ADMIN_ONLY;
  if (error.code === "22023") return error.message;
  return "La réinitialisation n’a pas pu être effectuée. Réessayez.";
}

/**
 * Réinitialisation du mot de passe par l’administrateur (décision du 12/11/2026) : sessions fermées, ancien mot de
 * passe remplacé par une valeur aléatoire que personne ne connaît, puis lien pour choisir le nouveau (e-mail ou copie).
 */
export async function resetUserPassword(_previous: FormState, formData: FormData): Promise<FormState> {
  const access = await getInternalAccess(SCREEN_ROLES.usersWrite);
  if (!access) return failure(ADMIN_ONLY);

  const parsed = resetPasswordSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { userId, delivery } = parsed.data;
  if (userId === access.userId) return failure("Utilisez « Mot de passe oublié » pour votre propre compte.");

  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle();
  if (!profile) return failure("Utilisateur introuvable.");

  const revokeError = await revokeSessions(userId, "password_reset");
  if (revokeError) return failure(revokeError);

  // Chiffres et majuscule ajoutés : la valeur aléatoire respecte les exigences de mot de passe de Supabase Auth.
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: `${randomBytes(32).toString("base64url")}Aa1`,
  });
  if (error) {
    return failure("Les sessions ont été fermées, mais l’ancien mot de passe n’a pas pu être bloqué. Réessayez.");
  }
  revalidatePath("/utilisateurs");

  if (delivery === "email") {
    const { error: mailError } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: invitationRedirect(),
    });
    if (mailError) {
      return failure(
        "Ancien mot de passe bloqué, mais l’e-mail n’a pas pu être envoyé : utilisez « Lien à copier » pour réessayer.",
      );
    }
    return success(
      `Mot de passe réinitialisé. Un e-mail a été envoyé à ${profile.email} pour choisir le nouveau mot de passe.`,
    );
  }

  const link = await createAccessLink(profile.email);
  if (!link) return failure("Ancien mot de passe bloqué, mais le lien n’a pas pu être généré. Réessayez.");
  return success(`Mot de passe réinitialisé : l’ancien ne fonctionne plus. ${LINK_NOTICE}`, { lien: link });
}

/** Réinitialisation de la double authentification (téléphone perdu ou changé) : à reconfigurer à la connexion. */
export async function resetUserMfa(_previous: FormState, formData: FormData): Promise<FormState> {
  const access = await getInternalAccess(SCREEN_ROLES.usersWrite);
  if (!access) return failure(ADMIN_ONLY);

  const parsed = resetMfaSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { userId } = parsed.data;
  if (userId === access.userId)
    return failure("Vous ne pouvez pas réinitialiser votre propre double authentification.");

  const revokeError = await revokeSessions(userId, "mfa_reset");
  if (revokeError) return failure(revokeError);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
  if (error)
    return failure("Les sessions ont été fermées, mais la double authentification n’a pas pu être lue. Réessayez.");
  for (const factor of data.factors) {
    const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId });
    if (deleteError) {
      return failure(
        "Les sessions ont été fermées, mais la double authentification n’a pas pu être effacée. Réessayez.",
      );
    }
  }

  revalidatePath("/utilisateurs");
  return success("Double authentification réinitialisée : elle sera reconfigurée à la prochaine connexion.");
}
