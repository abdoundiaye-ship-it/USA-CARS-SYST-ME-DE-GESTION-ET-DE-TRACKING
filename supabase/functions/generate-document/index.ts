/**
 * Fonction Supabase generate-document — contrat (US-2.2, R14) et ordre d'achat (US-2.3, annexe B).
 *
 * Remplit le modèle Word, dépose le fichier dans le bucket privé « documents » et l'enregistre
 * (register_contract_document / register_purchase_order_document). Exécutée ici plutôt que dans l'application :
 * le remplissage d'un modèle (~85 ms de calcul) dépasse la limite de l'offre gratuite de Cloudflare Workers (10 ms).
 *
 * Toutes les lectures et écritures se font AU NOM DE L'UTILISATEUR (jeton transmis par l'application) :
 * la RLS s'applique ; la clé service_role n'est jamais utilisée.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  COMPANY_SETTING_KEYS,
  CONTRACT_TEMPLATE_VERSION,
  renderContract,
  type CompanyIdentity,
} from "../_shared/contract.ts";
import { sha256Hex } from "../_shared/docx.ts";
import { PURCHASE_ORDER_TEMPLATE_VERSION, renderPurchaseOrder } from "../_shared/purchase-order.ts";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = ["contract", "purchase_order"] as const;
type Kind = (typeof KINDS)[number];

class Refusal extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

/** Colonnes du dossier utilisées ici ; les autres sont transmises telles quelles aux modèles. */
type Row = { id: string; reference: string; client_id: string; params_as_of: string } & Record<string, unknown>;

/** Dernière valeur de chaque paramètre en vigueur à l'ouverture du dossier (décision X7). */
async function settingsAsOf(supabase: SupabaseClient, keys: string[], asOf: string) {
  const { data, error } = await supabase
    .from("settings")
    .select("key, value, effective_from")
    .in("key", keys)
    .lte("effective_from", asOf)
    .order("effective_from", { ascending: false });
  if (error || !data) throw new Refusal(500, "Les paramètres du document n’ont pas pu être lus.");
  return (key: string) => data.find((s) => s.key === key)?.value;
}

async function buildContract(supabase: SupabaseClient, dossier: Row) {
  const { data: client } = await supabase.from("clients").select("*").eq("id", dossier.client_id).maybeSingle();
  if (!client) throw new Refusal(404, "Client du dossier introuvable.");
  const valueOf = await settingsAsOf(
    supabase,
    [...Object.values(COMPANY_SETTING_KEYS), "templates.legal_validated"],
    dossier.params_as_of,
  );
  const company = Object.fromEntries(
    Object.entries(COMPANY_SETTING_KEYS).map(([field, key]) => {
      const value = valueOf(key);
      return [field, typeof value === "string" ? value : ""];
    }),
  ) as unknown as CompanyIdentity;
  const bytes = renderContract({
    reference: dossier.reference,
    date: new Date(),
    legalValidated: valueOf("templates.legal_validated") === true,
    company,
    client: client as never,
    dossier: dossier as never,
  });
  return { bytes, fileName: `Contrat-${dossier.reference}.docx`, templateVersion: CONTRACT_TEMPLATE_VERSION };
}

async function buildPurchaseOrder(supabase: SupabaseClient, dossier: Row) {
  const { data: po } = await supabase.from("purchase_orders").select("*").eq("dossier_id", dossier.id).maybeSingle();
  if (!po) throw new Refusal(409, "Saisissez d’abord l’ordre d’achat (enchère maximale).");
  const { data: contract } = await supabase
    .from("contracts")
    .select("reference")
    .eq("dossier_id", dossier.id)
    .maybeSingle();
  const valueOf = await settingsAsOf(supabase, ["templates.legal_validated"], dossier.params_as_of);
  const bytes = renderPurchaseOrder({
    contractReference: contract?.reference ?? dossier.reference,
    legalValidated: valueOf("templates.legal_validated") === true,
    dossier: dossier as never,
    auctionAt: po.auction_at ? new Date(po.auction_at) : null,
    maxBidCents: Number(po.max_bid_cents),
    depositCents: Number(po.deposit_cents),
  });
  return {
    bytes,
    fileName: `Ordre-achat-${dossier.reference}.docx`,
    templateVersion: PURCHASE_ORDER_TEMPLATE_VERSION,
  };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return reply(405, { message: "Méthode non autorisée." });
  const authorization = request.headers.get("Authorization");
  if (!authorization) return reply(401, { message: "Connexion requise." });

  let dossierId: unknown;
  let kind: unknown;
  try {
    ({ dossierId, kind } = await request.json());
  } catch {
    return reply(400, { message: "Requête invalide." });
  }
  if (typeof dossierId !== "string" || !UUID.test(dossierId)) return reply(400, { message: "Dossier inconnu." });
  if (!KINDS.includes(kind as Kind)) return reply(400, { message: "Type de document inconnu." });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // Écriture réservée à l'administrateur et à l'agent opérations (même règle que la RLS).
    const { data: canWrite } = await supabase.rpc("is_operations_writer");
    if (canWrite !== true) throw new Refusal(403, "Action réservée à l’administrateur et aux agents opérations.");

    const { data: dossier } = await supabase.from("dossiers").select("*").eq("id", dossierId).maybeSingle();
    if (!dossier) throw new Refusal(404, "Dossier introuvable.");

    let built: { bytes: Uint8Array; fileName: string; templateVersion: string };
    try {
      built =
        kind === "contract" ? await buildContract(supabase, dossier) : await buildPurchaseOrder(supabase, dossier);
    } catch (error) {
      if (error instanceof Refusal) throw error;
      console.error("generate-document: rendu impossible", error);
      throw new Refusal(500, "Le document n’a pas pu être généré à partir du modèle.");
    }

    const path = `dossiers/${dossier.id}/${kind}/${crypto.randomUUID()}-${built.fileName}`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(path, built.bytes, { contentType: DOCX_MIME, upsert: false });
    if (uploadError) {
      console.error("generate-document: dépôt impossible", uploadError.message);
      throw new Refusal(500, "Le document n’a pas pu être enregistré dans l’espace de stockage.");
    }

    const { data: id, error } = await supabase.rpc(
      kind === "contract" ? "register_contract_document" : "register_purchase_order_document",
      {
        p_dossier_id: dossier.id,
        p_storage_path: path,
        p_file_name: built.fileName,
        p_size_bytes: built.bytes.byteLength,
        p_sha256: await sha256Hex(built.bytes),
        p_template_version: built.templateVersion,
      },
    );
    if (error || !id) {
      // 22023 : règle métier (véhicule incomplet, trop âgé, décision déjà enregistrée…) — message destiné à l'agent.
      throw new Refusal(
        error?.code === "22023" ? 409 : 500,
        error?.code === "22023" ? error.message : "Le document n’a pas pu être enregistré.",
      );
    }
    return reply(200, { id });
  } catch (error) {
    if (error instanceof Refusal) return reply(error.status, { message: error.message });
    console.error("generate-document: erreur inattendue", error);
    return reply(500, { message: "Erreur inattendue lors de la génération du document." });
  }
});
