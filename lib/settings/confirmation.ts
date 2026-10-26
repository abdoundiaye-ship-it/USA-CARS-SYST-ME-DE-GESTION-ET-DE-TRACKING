/**
 * Validation des paramètres « à confirmer » (décision P6-4) : valeur de remplissage, nature de chaque version dans
 * l'historique, filtre de la liste et avancement. Le contrôle qui fait foi est en base (settings_check_confirmation).
 */

export type SettingStatus = "confirme" | "a_confirmer";

/** Valeur provisoire des paramètres à saisir par USA CARS (ex. coordonnées company.*) : jamais confirmable. */
export const PLACEHOLDER_VALUE = "À compléter";

export function isPlaceholderValue(value: unknown): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === PLACEHOLDER_VALUE.toLowerCase();
}

/** Valeur « non définie » : confirmable, mais signalée (choix volontaire de laisser le paramètre vide). */
export function isUndefinedValue(value: unknown): boolean {
  return value === null || value === undefined;
}

export type SettingActionKind = "initial" | "validation" | "modification" | "status" | "new_version";

export const SETTING_ACTION_LABELS: Record<SettingActionKind, string> = {
  initial: "Valeur initiale",
  validation: "Validation",
  modification: "Modification",
  status: "Changement de statut",
  new_version: "Nouvelle version",
};

interface VersionLike {
  value: unknown;
  status: SettingStatus;
}

/** Nature d'une version par rapport à la précédente (plus ancienne), pour l'historique. */
export function settingActionKind(version: VersionLike, previous: VersionLike | null): SettingActionKind {
  if (!previous) return "initial";
  if (JSON.stringify(version.value) !== JSON.stringify(previous.value)) return "modification";
  if (previous.status === "a_confirmer" && version.status === "confirme") return "validation";
  if (previous.status !== version.status) return "status";
  return "new_version";
}

export type StatusFilter = "a_confirmer" | "confirme" | "tous";

export const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  a_confirmer: "À confirmer",
  confirme: "Confirmés",
  tous: "Tous",
};

export function parseStatusFilter(raw: unknown): StatusFilter {
  return raw === "a_confirmer" || raw === "confirme" ? raw : "tous";
}

export function matchesStatusFilter(status: SettingStatus, filter: StatusFilter): boolean {
  return filter === "tous" || status === filter;
}

/** Avancement de la validation : paramètres confirmés sur le total, et reste à confirmer. */
export function confirmationProgress(statuses: readonly SettingStatus[]): {
  confirmed: number;
  toConfirm: number;
  total: number;
} {
  const toConfirm = statuses.filter((s) => s === "a_confirmer").length;
  return { confirmed: statuses.length - toConfirm, toConfirm, total: statuses.length };
}
