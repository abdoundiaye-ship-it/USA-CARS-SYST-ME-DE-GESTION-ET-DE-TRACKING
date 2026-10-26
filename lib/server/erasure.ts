import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const STORAGE_BUCKET = "documents";

/**
 * Supprime réellement du Storage (clé service_role, CLAUDE.md règle 9) les fichiers d'un dossier à anonymiser,
 * AVANT l'effacement des lignes en base (anonymisation réelle, G2-d). La liste des fichiers vient de
 * dossier_erasure_file_targets (RLS : administrateur, demande approuvée). Renvoie le nombre de fichiers
 * supprimés, ou null en cas d'échec (l'exécution en base est alors interrompue et pourra être relancée).
 */
export async function deleteErasureFiles(erasureId: string): Promise<number | null> {
  const supabase = await createSupabaseServerClient();
  const { data: paths, error } = await supabase.rpc("dossier_erasure_file_targets", { p_id: erasureId });
  if (error) return null;

  const list = (paths ?? []).filter((p): p is string => typeof p === "string" && p.length > 0);
  if (list.length === 0) return 0;

  const admin = createSupabaseAdminClient();
  const { error: removeError } = await admin.storage.from(STORAGE_BUCKET).remove(list);
  if (removeError) return null;
  return list.length;
}
