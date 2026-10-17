"use server";

import { revalidatePath } from "next/cache";
import { getInternalAccess } from "@/lib/auth/access";
import { SCREEN_ROLES } from "@/lib/auth/roles";
import { getServerEnv } from "@/lib/env";
import { failure, formObject, invalid, success, type FormState } from "@/lib/forms";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { changeRoleSchema, inviteUserSchema, resendInviteSchema, setActiveSchema } from "@/lib/validation/users";

const ADMIN_ONLY = "Action réservée à l’administrateur (avec double authentification validée).";
const BAN_FOREVER = "876000h";

function invitationRedirect(): string {
  return `${getServerEnv().APP_URL}/auth/confirm?next=/compte/mot-de-passe`;
}

/**
 * US-1.2 : l’administrateur invite un utilisateur et lui attribue un rôle.
 * Le compte d’authentification est créé avec la clé service_role ; le profil (rôle) est créé au nom de
 * l’administrateur connecté, pour que le journal d’audit enregistre son identité (trigger profiles_audit).
 */
export async function inviteUser(_previous: FormState, formData: FormData): Promise<FormState> {
  const access = await getInternalAccess(SCREEN_ROLES.usersWrite);
  if (!access) return failure(ADMIN_ONLY);

  const parsed = inviteUserSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { email, fullName, role } = parsed.data;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: invitationRedirect(),
    data: { full_name: fullName },
  });
  if (error || !data.user) {
    if (error?.code === "email_exists" || error?.status === 422) {
      return {
        ...failure("Un compte existe déjà avec cette adresse e-mail."),
        fieldErrors: { email: "Adresse déjà utilisée." },
      };
    }
    if (error?.code === "over_email_send_rate_limit") {
      return failure("Limite d’envoi d’e-mails atteinte. Réessayez dans quelques minutes.");
    }
    return failure("L’invitation n’a pas pu être envoyée. Réessayez plus tard.");
  }

  const supabase = await createSupabaseServerClient();
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id: data.user.id, email, full_name: fullName, role });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return failure("Le profil n’a pas pu être créé : l’invitation a été annulée. Réessayez.");
  }

  revalidatePath("/utilisateurs");
  return success(`Invitation envoyée à ${email}. La personne choisira son mot de passe depuis le lien reçu.`);
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
