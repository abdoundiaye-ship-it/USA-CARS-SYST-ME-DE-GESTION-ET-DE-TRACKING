"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { getInternalAccess } from "@/lib/auth/access";
import { SCREEN_ROLES } from "@/lib/auth/roles";
import { failure, formObject, invalid, success, withValues, type FormState } from "@/lib/forms";
import { deleteErasureFiles } from "@/lib/server/erasure";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cancelErasureSchema, erasureIdSchema, requestErasureSchema } from "@/lib/validation/erasure";

/**
 * Anonymisation des dossiers dont la durée de conservation est atteinte (décisions G2-c/G2-d, contrat art. 33).
 * Administrateur uniquement, double validation (demande ≠ approbation) ; la base vérifie l'éligibilité, les droits
 * et la double validation. L'exécution supprime d'abord les fichiers du Storage, puis les lignes en base.
 */

const ADMIN_ONLY = "Action réservée à l’administrateur.";
const dossierPath = (id: string) => `/dossiers/${id}` as Route;

function rpcMessage(error: { code?: string; message: string } | null, fallback: string): string {
  return error && (error.code === "22023" || error.code === "42501") ? error.message : fallback;
}

function dossierIdFrom(formData: FormData): string {
  const value = formData.get("dossierId");
  return typeof value === "string" ? value : "";
}

/** L'administrateur demande l'anonymisation d'un dossier éligible (durée de conservation atteinte). */
export async function requestDossierErasure(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await getInternalAccess(SCREEN_ROLES.erasuresWrite))) return failure(ADMIN_ONLY);
  const parsed = requestErasureSchema.safeParse(formObject(formData));
  if (!parsed.success) return withValues(invalid(parsed.error), formData);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("request_dossier_erasure", {
    p_dossier_id: parsed.data.dossierId,
    p_reason: parsed.data.reason,
  });
  if (error) return withValues(failure(rpcMessage(error, "La demande n’a pas pu être enregistrée.")), formData);
  revalidatePath(dossierPath(parsed.data.dossierId));
  return success("Demande d’anonymisation enregistrée. Une autre personne doit l’approuver.");
}

/** Approbation par une seconde personne (double validation G2-d). */
export async function approveDossierErasure(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await getInternalAccess(SCREEN_ROLES.erasuresWrite))) return failure(ADMIN_ONLY);
  const parsed = erasureIdSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("approve_dossier_erasure", { p_id: parsed.data.erasureId });
  if (error) return failure(rpcMessage(error, "L’approbation n’a pas pu être enregistrée."));
  const dossierId = dossierIdFrom(formData);
  if (dossierId) revalidatePath(dossierPath(dossierId));
  return success("Demande approuvée. Vous pouvez maintenant exécuter l’anonymisation (irréversible).");
}

/** Exécution irréversible : suppression des fichiers du Storage puis effacement en base. */
export async function executeDossierErasure(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await getInternalAccess(SCREEN_ROLES.erasuresWrite))) return failure(ADMIN_ONLY);
  const parsed = erasureIdSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  // Les fichiers sont supprimés du Storage AVANT l'effacement en base : une donnée personnelle ne doit jamais
  // rester dans un fichier dont la ligne a disparu.
  const deleted = await deleteErasureFiles(parsed.data.erasureId);
  if (deleted === null) {
    return failure(
      "Les fichiers n’ont pas pu être supprimés du stockage. L’anonymisation n’a pas été effectuée ; réessayez.",
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("execute_dossier_erasure", { p_id: parsed.data.erasureId });
  if (error) return failure(rpcMessage(error, "L’anonymisation n’a pas pu être finalisée en base. Réessayez."));
  const dossierId = dossierIdFrom(formData);
  if (dossierId) revalidatePath(dossierPath(dossierId));
  return success("Anonymisation effectuée : identité et pièces concernées supprimées.");
}

/** Annulation d'une demande non exécutée. */
export async function cancelDossierErasure(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await getInternalAccess(SCREEN_ROLES.erasuresWrite))) return failure(ADMIN_ONLY);
  const parsed = cancelErasureSchema.safeParse(formObject(formData));
  if (!parsed.success) return withValues(invalid(parsed.error), formData);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_dossier_erasure", {
    p_id: parsed.data.erasureId,
    p_reason: parsed.data.reason,
  });
  if (error) return withValues(failure(rpcMessage(error, "L’annulation n’a pas pu être enregistrée.")), formData);
  const dossierId = dossierIdFrom(formData);
  if (dossierId) revalidatePath(dossierPath(dossierId));
  return success("Demande d’anonymisation annulée.");
}
