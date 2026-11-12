"use server";

import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_TYPES: readonly EmailOtpType[] = ["invite", "recovery", "email", "magiclink"];

/**
 * Tous les liens d'accès (invitation, lien à copier, réinitialisation du mot de passe) mènent au choix du mot de
 * passe : destination fixe côté serveur, pour ne pas dépendre d'un paramètre `next` transmis dans l'URL (encodage
 * des « / », modèle d'e-mail du tableau de bord Supabase…), qui a déjà provoqué une redirection vers « /compte » (404).
 */
const DESTINATION = "/compte/mot-de-passe";

/**
 * Validation du lien au clic sur « Continuer » : ouvre la session puis redirige. Jamais à la simple ouverture de la
 * page, qu'un aperçu automatique (WhatsApp, messagerie) consommerait.
 */
export async function confirmLink(formData: FormData): Promise<void> {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const type = String(formData.get("type") ?? "") as EmailOtpType;
  const code = String(formData.get("code") ?? "");

  const supabase = await createSupabaseServerClient();
  let ok = false;
  if (tokenHash && ALLOWED_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  redirect(ok ? DESTINATION : "/connexion?erreur=lien");
}
