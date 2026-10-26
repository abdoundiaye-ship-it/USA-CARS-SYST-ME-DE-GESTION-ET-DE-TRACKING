"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getInternalAccess } from "@/lib/auth/access";
import { SCREEN_ROLES } from "@/lib/auth/roles";
import { failure, formObject, invalid, success, type FormState } from "@/lib/forms";
import { parseSettingInput } from "@/lib/settings/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { confirmSettingSchema, parseEffectiveFrom, settingVersionSchema } from "@/lib/validation/settings";

const ADMIN_ONLY = "Action réservée à l’administrateur (avec double authentification validée).";

function revalidateSetting(key: string) {
  revalidatePath("/parametres");
  revalidatePath(`/parametres/${encodeURIComponent(key)}`);
}

/** US-1.3 : nouvelle version datée d’un paramètre (l’ancienne reste consultable). */
export async function createSettingVersion(_previous: FormState, formData: FormData): Promise<FormState> {
  const access = await getInternalAccess(SCREEN_ROLES.settingsWrite);
  if (!access) return failure(ADMIN_ONLY);

  const parsed = settingVersionSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { key, status, reason } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data: latest } = await supabase
    .from("settings")
    .select("value_type, source")
    .eq("key", key)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return failure("Paramètre inconnu.");

  const value = parseSettingInput(latest.value_type, parsed.data.value);
  if (!value.ok) return { status: "error", message: "La valeur est à corriger.", fieldErrors: { value: value.error } };

  const effectiveFrom = parseEffectiveFrom(parsed.data.effectiveFrom) ?? new Date();
  if (effectiveFrom.getTime() < Date.now() - 60_000) {
    return {
      status: "error",
      message: "La date d’effet est à corriger.",
      fieldErrors: { effectiveFrom: "Choisissez maintenant ou une date future (pas d’effet rétroactif)." },
    };
  }

  const { error } = await supabase.from("settings").insert({
    key,
    value: value.value,
    value_type: latest.value_type,
    status,
    source: "Écran Paramètres",
    reason,
    effective_from: effectiveFrom.toISOString(),
  });
  if (error?.code === "23505")
    return failure("Une version existe déjà à cette date d’effet. Choisissez une autre date.");
  // Garde-fou de la base : une valeur « À compléter » ne peut pas être confirmée (P6-4).
  if (error?.code === "22023") return failure(error.message);
  if (error) return failure("La nouvelle version n’a pas pu être enregistrée.");

  revalidateSetting(key);
  return success("Nouvelle version enregistrée. Elle apparaît dans l’historique ci-dessous.");
}

/**
 * Décision P6-4 : valide la valeur en vigueur d'un paramètre « à confirmer » (même valeur, statut « confirmé »).
 * La nouvelle version garde l'administrateur et l'heure de la validation ; la base refuse « À compléter ».
 */
export async function confirmSetting(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await getInternalAccess(SCREEN_ROLES.settingsWrite))) return failure(ADMIN_ONLY);

  const parsed = confirmSettingSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("confirm_setting", { p_key: parsed.data.key, p_reason: parsed.data.reason });
  if (error?.code === "22023") return failure(error.message);
  if (error?.code === "42501") return failure(ADMIN_ONLY);
  if (error) return failure("La validation n’a pas pu être enregistrée.");

  revalidateSetting(parsed.data.key);
  // Le bloc de validation disparaît une fois le paramètre confirmé : le message est affiché par la fiche.
  redirect(`/parametres/${encodeURIComponent(parsed.data.key)}?valide=1` as Route);
}
