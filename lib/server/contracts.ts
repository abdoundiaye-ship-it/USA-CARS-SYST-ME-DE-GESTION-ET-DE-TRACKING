import "server-only";
import {
  COMPANY_SETTING_KEYS,
  CONTRACT_TEMPLATE_VERSION,
  renderContract,
  type CompanyIdentity,
} from "@/lib/documents/contract";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { storagePath, uploadToStorage } from "./documents";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type GenerateContractResult = { ok: true; contractId: string } | { ok: false; message: string };

/**
 * Génère (ou régénère, tant qu'il n'est pas signé) le contrat d'un dossier (US-2.2, R14) :
 * remplissage du modèle, dépôt dans le bucket privé, enregistrement du document et du contrat.
 * Toutes les lectures et écritures se font au nom de l'utilisateur : la RLS s'applique.
 */
export async function generateContract(dossierId: string): Promise<GenerateContractResult> {
  const supabase = await createSupabaseServerClient();

  const { data: dossier } = await supabase.from("dossiers").select("*").eq("id", dossierId).maybeSingle();
  if (!dossier) return { ok: false, message: "Dossier introuvable." };
  const { data: client } = await supabase.from("clients").select("*").eq("id", dossier.client_id).maybeSingle();
  if (!client) return { ok: false, message: "Client du dossier introuvable." };

  // Paramètres en vigueur à l'ouverture du dossier (décision X7) — dernière version par clé.
  const keys = [...Object.values(COMPANY_SETTING_KEYS), "templates.legal_validated"];
  const { data: settings, error: settingsError } = await supabase
    .from("settings")
    .select("key, value, effective_from")
    .in("key", keys)
    .lte("effective_from", dossier.params_as_of)
    .order("effective_from", { ascending: false });
  if (settingsError || !settings) return { ok: false, message: "Les paramètres du contrat n’ont pas pu être lus." };
  const valueOf = (key: string) => settings.find((s) => s.key === key)?.value;
  const company = Object.fromEntries(
    Object.entries(COMPANY_SETTING_KEYS).map(([field, key]) => {
      const value = valueOf(key);
      return [field, typeof value === "string" ? value : ""];
    }),
  ) as unknown as CompanyIdentity;

  let bytes: Uint8Array;
  try {
    bytes = renderContract({
      reference: dossier.reference,
      date: new Date(),
      legalValidated: valueOf("templates.legal_validated") === true,
      company,
      client,
      dossier,
    });
  } catch {
    return { ok: false, message: "Le contrat n’a pas pu être généré à partir du modèle." };
  }

  const fileName = `Contrat-${dossier.reference}.docx`;
  const stored = await uploadToStorage(storagePath(dossier.id, "contract", fileName), bytes, DOCX_MIME);
  if (!stored) return { ok: false, message: "Le contrat n’a pas pu être enregistré dans l’espace de stockage." };

  const { data: contractId, error } = await supabase.rpc("register_contract_document", {
    p_dossier_id: dossier.id,
    p_storage_path: stored.path,
    p_file_name: fileName,
    p_size_bytes: stored.size,
    p_sha256: stored.sha256,
    p_template_version: CONTRACT_TEMPLATE_VERSION,
  });
  if (error || !contractId) {
    return {
      ok: false,
      message: error?.code === "22023" ? error.message : "Le contrat n’a pas pu être enregistré.",
    };
  }
  return { ok: true, contractId };
}
