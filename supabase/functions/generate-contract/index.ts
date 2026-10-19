/**
 * Fonction Supabase generate-contract — US-2.2, règle R14.
 *
 * Génère (ou régénère, tant qu'il n'est pas signé) le contrat Word d'un dossier, le dépose dans le bucket privé
 * « documents » et l'enregistre (register_contract_document). Exécutée ici plutôt que dans l'application :
 * le remplissage du modèle (~85 ms de calcul) dépasse la limite de l'offre gratuite de Cloudflare Workers (10 ms).
 *
 * Toutes les lectures et écritures se font AU NOM DE L'UTILISATEUR (jeton transmis par l'application) :
 * la RLS s'applique ; la clé service_role n'est jamais utilisée.
 */
import { createClient } from "@supabase/supabase-js";
import {
  COMPANY_SETTING_KEYS,
  CONTRACT_TEMPLATE_VERSION,
  renderContract,
  sha256Hex,
  type CompanyIdentity,
} from "../_shared/contract.ts";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

Deno.serve(async (request) => {
  if (request.method !== "POST") return reply(405, { message: "Méthode non autorisée." });
  const authorization = request.headers.get("Authorization");
  if (!authorization) return reply(401, { message: "Connexion requise." });

  let dossierId: unknown;
  try {
    ({ dossierId } = await request.json());
  } catch {
    return reply(400, { message: "Requête invalide." });
  }
  if (typeof dossierId !== "string" || !UUID.test(dossierId)) return reply(400, { message: "Dossier inconnu." });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Écriture réservée à l'administrateur et à l'agent opérations (même règle que la RLS des contrats).
  const { data: canWrite } = await supabase.rpc("is_operations_writer");
  if (canWrite !== true) return reply(403, { message: "Action réservée à l’administrateur et aux agents opérations." });

  const { data: dossier } = await supabase.from("dossiers").select("*").eq("id", dossierId).maybeSingle();
  if (!dossier) return reply(404, { message: "Dossier introuvable." });
  const { data: client } = await supabase.from("clients").select("*").eq("id", dossier.client_id).maybeSingle();
  if (!client) return reply(404, { message: "Client du dossier introuvable." });

  // Paramètres en vigueur à l'ouverture du dossier (décision X7) — dernière version par clé.
  const keys = [...Object.values(COMPANY_SETTING_KEYS), "templates.legal_validated"];
  const { data: settings, error: settingsError } = await supabase
    .from("settings")
    .select("key, value, effective_from")
    .in("key", keys)
    .lte("effective_from", dossier.params_as_of)
    .order("effective_from", { ascending: false });
  if (settingsError || !settings) return reply(500, { message: "Les paramètres du contrat n’ont pas pu être lus." });
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
  } catch (error) {
    console.error("generate-contract: rendu impossible", error);
    return reply(500, { message: "Le contrat n’a pas pu être généré à partir du modèle." });
  }

  const fileName = `Contrat-${dossier.reference}.docx`;
  const path = `dossiers/${dossier.id}/contract/${crypto.randomUUID()}-${fileName}`;
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(path, bytes, { contentType: DOCX_MIME, upsert: false });
  if (uploadError) {
    console.error("generate-contract: dépôt impossible", uploadError.message);
    return reply(500, { message: "Le contrat n’a pas pu être enregistré dans l’espace de stockage." });
  }

  const { data: contractId, error } = await supabase.rpc("register_contract_document", {
    p_dossier_id: dossier.id,
    p_storage_path: path,
    p_file_name: fileName,
    p_size_bytes: bytes.byteLength,
    p_sha256: await sha256Hex(bytes),
    p_template_version: CONTRACT_TEMPLATE_VERSION,
  });
  if (error || !contractId) {
    const known = error?.code === "22023";
    return reply(known ? 409 : 500, { message: known ? error.message : "Le contrat n’a pas pu être enregistré." });
  }
  return reply(200, { contractId });
});
