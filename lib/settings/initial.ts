import { parseUsdToCents } from "@/lib/money/cents";
import { isValidSettingValue, parseSettingType, type SettingValue } from "./types";

/**
 * Chargement initial de la table settings depuis specs/parametres_contractuels.json (CLAUDE.md règle 4).
 * Le résultat est une migration SQL versionnée (appliquée aussi en production), pas un seed.
 */

export interface SpecSetting {
  key: string;
  value: unknown;
  type: string;
  status: "confirme" | "a_confirmer";
  source?: string;
}

export interface InitialSetting {
  key: string;
  value: SettingValue;
  valueType: string;
  status: "confirme" | "a_confirmer";
  source: string | null;
}

/** Date d’effet du chargement initial : fixe, pour que la migration soit déterministe et rejouable. */
export const INITIAL_EFFECTIVE_FROM = "2026-10-17T00:00:00Z";

/** Normalise une entrée du JSON : `money` y est exprimé en dollars, stocké en centimes. */
export function toInitialSetting(spec: SpecSetting): InitialSetting {
  parseSettingType(spec.type);
  let value = spec.value as SettingValue;
  if (spec.type === "money" && value !== null) {
    const cents = typeof value === "number" ? parseUsdToCents(String(value)) : null;
    if (cents === null) throw new Error(`Paramètre ${spec.key} : montant invalide (${String(spec.value)}).`);
    value = cents;
  }
  if (!isValidSettingValue(spec.type, value)) {
    throw new Error(
      `Paramètre ${spec.key} : valeur ${JSON.stringify(spec.value)} incompatible avec le type ${spec.type}.`,
    );
  }
  return { key: spec.key, value, valueType: spec.type, status: spec.status, source: spec.source ?? null };
}

const sqlString = (text: string) => `'${text.replace(/'/g, "''")}'`;

export function buildSettingsMigrationSql(specs: SpecSetting[]): string {
  const keys = new Set<string>();
  const rows = specs.map((spec) => {
    if (keys.has(spec.key)) throw new Error(`Paramètre en double : ${spec.key}.`);
    keys.add(spec.key);
    const s = toInitialSetting(spec);
    return `  (${[
      sqlString(s.key),
      `${sqlString(JSON.stringify(s.value))}::jsonb`,
      sqlString(s.valueType),
      sqlString(s.status),
      s.source === null ? "null" : sqlString(s.source),
      `${sqlString(INITIAL_EFFECTIVE_FROM)}::timestamptz`,
    ].join(", ")})`;
  });

  return [
    "-- Phase 1 — chargement initial des paramètres contractuels.",
    "-- GÉNÉRÉ par `pnpm settings:generate` depuis specs/parametres_contractuels.json : ne pas modifier à la main.",
    "-- Montants (type money) en centimes USD. Les modifications ultérieures passent par l’écran Paramètres",
    "-- (nouvelle version datée), jamais par la modification de cette migration une fois appliquée en production.",
    "",
    "insert into public.settings (key, value, value_type, status, source, effective_from) values",
    `${rows.join(",\n")}`,
    "on conflict (key, effective_from) do nothing;",
    "",
  ].join("\n");
}
