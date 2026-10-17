import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isInternalRole, type AppRole, type InternalRole } from "./roles";

export interface Access {
  userId: string;
  email: string;
  role: AppRole | null;
  active: boolean;
  fullName: string;
  mfaRequired: boolean;
  aal: "aal1" | "aal2";
}

/**
 * Utilisateur connecté et son état d’accès (profil, MFA). Les droits réels sont appliqués par la RLS :
 * ces informations ne servent qu’à orienter l’utilisateur dans l’interface.
 */
export const getAccess = cache(async (): Promise<Access | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.rpc("my_access").maybeSingle();
  return {
    userId: user.id,
    email: user.email ?? "",
    role: data?.role ?? null,
    active: data?.active ?? false,
    fullName: data?.full_name ?? user.email ?? "",
    mfaRequired: data?.mfa_required ?? false,
    aal: data?.aal === "aal2" ? "aal2" : "aal1",
  };
});

export type InternalAccess = Access & { role: InternalRole };

/** Garde des pages de l’espace interne : connexion, compte actif, MFA si exigée, rôle autorisé. */
export async function requireInternal(allowed?: readonly AppRole[]): Promise<InternalAccess> {
  const access = await getAccess();
  if (!access) redirect("/connexion");
  if (!access.role || !access.active) redirect("/acces-refuse");
  if (access.mfaRequired && access.aal !== "aal2") redirect("/connexion/mfa");
  if (!isInternalRole(access.role)) redirect("/acces-refuse");
  if (allowed && !allowed.includes(access.role)) redirect("/acces-refuse");
  return access as InternalAccess;
}

/** Variante pour les actions serveur : renvoie null au lieu de rediriger. */
export async function getInternalAccess(allowed?: readonly AppRole[]): Promise<InternalAccess | null> {
  const access = await getAccess();
  if (!access || !access.role || !access.active || !isInternalRole(access.role)) return null;
  if (access.mfaRequired && access.aal !== "aal2") return null;
  if (allowed && !allowed.includes(access.role)) return null;
  return access as InternalAccess;
}
