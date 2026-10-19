"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getInternalAccess } from "@/lib/auth/access";
import { SCREEN_ROLES } from "@/lib/auth/roles";
import { failure, formObject, invalid, success, withValues, type FormState } from "@/lib/forms";
import { generateContract } from "@/lib/server/contracts";
import { storagePath, uploadToStorage } from "@/lib/server/documents";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  acceptanceSchema,
  dossierIdSchema,
  newDossierSchema,
  proofFileError,
  vehicleSchema,
  type VehicleInput,
} from "@/lib/validation/operations";

const WRITERS_ONLY = "Action réservée à l’administrateur et aux agents opérations.";

function vehicleRow(input: VehicleInput) {
  return {
    platform: input.platform,
    lot_number: input.lotNumber,
    vin: input.vin,
    make: input.make,
    model: input.model,
    model_year: input.modelYear,
    mileage: input.mileage,
    vehicle_category: input.vehicleCategory,
    title_status: input.titleStatus,
    color: input.color,
    purchase_location: input.purchaseLocation,
    departure_port: input.departurePort,
    notes: input.notes,
  };
}

const dossierPath = (id: string) => `/dossiers/${id}` as Route;

/**
 * Ouverture d'un dossier (un véhicule) et génération immédiate de son contrat (R14).
 * Si la génération échoue, le dossier reste ouvert : le contrat peut être généré depuis sa fiche.
 */
export async function createDossier(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await getInternalAccess(SCREEN_ROLES.operationsWrite))) return failure(WRITERS_ONLY);

  const parsed = newDossierSchema.safeParse(formObject(formData));
  if (!parsed.success) return withValues(invalid(parsed.error), formData);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("dossiers")
    .insert({ client_id: parsed.data.clientId, ...vehicleRow(parsed.data) })
    .select("id")
    .single();
  if (error || !data) {
    const message =
      error?.code === "23503"
        ? "Client inconnu : choisissez un client dans la liste."
        : "Le dossier n’a pas pu être ouvert.";
    return withValues(failure(message), formData);
  }

  const contract = await generateContract(data.id);
  revalidatePath("/dossiers");
  redirect(`${dossierPath(data.id)}?${contract.ok ? "ouvert=1" : "contrat=erreur"}` as Route);
}

/** Modification des informations du véhicule (le client et la référence restent figés). */
export async function updateVehicle(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await getInternalAccess(SCREEN_ROLES.operationsWrite))) return failure(WRITERS_ONLY);

  const id = dossierIdSchema.safeParse(formObject(formData));
  if (!id.success) return failure("Dossier inconnu.");
  const parsed = vehicleSchema.safeParse(formObject(formData));
  if (!parsed.success) return withValues(invalid(parsed.error), formData);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("dossiers")
    .update(vehicleRow(parsed.data))
    .eq("id", id.data.dossierId)
    .select("id");
  if (error) return withValues(failure("Les informations du véhicule n’ont pas pu être enregistrées."), formData);
  if (!data?.length) return failure(WRITERS_ONLY);

  revalidatePath(dossierPath(id.data.dossierId));
  return success(
    "Véhicule enregistré. Si le contrat n’est pas encore signé, régénérez-le pour y reporter ces informations.",
  );
}

/** Génère ou régénère le contrat tant qu'aucune décision n'est enregistrée. */
export async function regenerateContract(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await getInternalAccess(SCREEN_ROLES.operationsWrite))) return failure(WRITERS_ONLY);
  const id = dossierIdSchema.safeParse(formObject(formData));
  if (!id.success) return failure("Dossier inconnu.");

  const result = await generateContract(id.data.dossierId);
  if (!result.ok) return failure(result.message);
  revalidatePath(dossierPath(id.data.dossierId));
  return success("Contrat généré. Téléchargez la nouvelle version pour la faire signer.");
}

/**
 * US-2.2 / R15 : acceptation ou refus du contrat, par papier signé scanné ou par WhatsApp.
 * La preuve est téléversée dans le bucket privé ; la base impose la version en vigueur et son empreinte.
 */
export async function recordContractAcceptance(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await getInternalAccess(SCREEN_ROLES.operationsWrite))) return failure(WRITERS_ONLY);

  const parsed = acceptanceSchema.safeParse(formObject(formData));
  if (!parsed.success) return withValues(invalid(parsed.error), formData);
  const proof = formData.get("proof");
  const proofError = proofFileError(proof instanceof File ? proof : null);
  if (proofError) {
    return withValues(
      { status: "error", message: "La preuve est à joindre.", fieldErrors: { proof: proofError } },
      formData,
    );
  }
  const file = proof as File;
  const { dossierId, contractId, method, decision, decidedOn, whatsappFrom, notes } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data: dossier } = await supabase.from("dossiers").select("client_id").eq("id", dossierId).maybeSingle();
  if (!dossier) return failure("Dossier introuvable.");
  const stored = await uploadToStorage(
    storagePath(dossierId, "acceptance_proof", file.name),
    new Uint8Array(await file.arrayBuffer()),
    file.type,
  );
  if (!stored) return withValues(failure("La preuve n’a pas pu être enregistrée. Réessayez."), formData);

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .insert({
      dossier_id: dossierId,
      client_id: dossier.client_id,
      kind: "acceptance_proof",
      storage_path: stored.path,
      file_name: file.name.slice(0, 200),
      mime_type: file.type,
      size_bytes: stored.size,
      sha256: stored.sha256,
    })
    .select("id")
    .single();
  if (documentError || !document) return withValues(failure("La preuve n’a pas pu être enregistrée."), formData);

  // Date saisie (JJ/MM/AAAA côté écran) : midi à Dakar (UTC+0), pour éviter tout décalage de jour.
  const decidedAt = new Date(`${decidedOn}T12:00:00Z`);
  const { error } = await supabase.from("acceptances").insert({
    dossier_id: dossierId,
    subject: "contract",
    subject_id: contractId,
    document_id: document.id, // remplacé par la base (version en vigueur du contrat)
    document_sha256: stored.sha256, // idem
    method,
    decision,
    decided_at: (decidedAt.getTime() > Date.now() ? new Date() : decidedAt).toISOString(),
    proof_document_id: document.id,
    whatsapp_from: whatsappFrom,
    notes,
  });
  if (error) {
    return withValues(
      failure(error.code === "22023" ? error.message : "La décision du client n’a pas pu être enregistrée."),
      formData,
    );
  }

  revalidatePath(dossierPath(dossierId));
  return success(decision === "accepted" ? "Acceptation du contrat enregistrée." : "Refus du contrat enregistré.");
}

/** « Dupliquer le dossier » (R14) : nouveau dossier pour le même client, avec son propre contrat. */
export async function duplicateDossier(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await getInternalAccess(SCREEN_ROLES.operationsWrite))) return failure(WRITERS_ONLY);
  const id = dossierIdSchema.safeParse(formObject(formData));
  if (!id.success) return failure("Dossier inconnu.");

  const supabase = await createSupabaseServerClient();
  const { data: newId, error } = await supabase.rpc("duplicate_dossier", { p_dossier_id: id.data.dossierId });
  if (error || !newId) return failure("Le dossier n’a pas pu être dupliqué.");

  const contract = await generateContract(newId);
  revalidatePath("/dossiers");
  redirect(`${dossierPath(newId)}?${contract.ok ? "duplique=1" : "contrat=erreur"}` as Route);
}
