import "server-only";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type GenerateContractResult = { ok: true; contractId: string } | { ok: false; message: string };

/**
 * Génère (ou régénère, tant qu'il n'est pas signé) le contrat d'un dossier (US-2.2, R14).
 * Le travail est fait par la fonction Supabase generate-contract (supabase/functions), appelée avec le jeton
 * de l'utilisateur connecté : la RLS s'applique, et le calcul ne pèse pas sur Cloudflare Workers.
 */
export async function generateContract(dossierId: string): Promise<GenerateContractResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.functions.invoke<{ contractId: string }>("generate-contract", {
    body: { dossierId },
  });
  if (data?.contractId && !error) return { ok: true, contractId: data.contractId };

  if (error instanceof FunctionsHttpError) {
    const body = (await error.context.json().catch(() => null)) as { message?: unknown } | null;
    if (typeof body?.message === "string") return { ok: false, message: body.message };
  }
  return { ok: false, message: "Le service de génération du contrat ne répond pas. Réessayez dans un instant." };
}
