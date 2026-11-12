"use server";

import type { EmailOtpType } from "@supabase/supabase-js";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_TYPES: readonly EmailOtpType[] = ["invite", "recovery", "email", "magiclink"];

/**
 * Validation du lien (invitation, lien d’accès, réinitialisation) au clic sur « Continuer » : ouvre la session puis
 * redirige. Jamais à la simple ouverture de la page, qu’un aperçu automatique (WhatsApp, messagerie) consommerait.
 */
export async function confirmLink(formData: FormData): Promise<void> {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const type = String(formData.get("type") ?? "") as EmailOtpType;
  const code = String(formData.get("code") ?? "");
  const next = safeNextPath(formData.get("next"), "/compte/mot-de-passe");

  const supabase = await createSupabaseServerClient();
  let ok = false;
  if (tokenHash && ALLOWED_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  redirect((ok ? next : "/connexion?erreur=lien") as Route);
}
