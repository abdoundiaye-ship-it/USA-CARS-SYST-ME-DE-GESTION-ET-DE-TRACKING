/** Génère la migration de chargement initial des paramètres (pnpm settings:generate). */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildSettingsMigrationSql, type SpecSetting } from "../lib/settings/initial";

export const SPEC_PATH = "specs/parametres_contractuels.json";
export const MIGRATION_PATH = "supabase/migrations/20261017100300_parametres_initiaux.sql";

const spec = JSON.parse(readFileSync(resolve(SPEC_PATH), "utf8")) as { settings: SpecSetting[] };
writeFileSync(resolve(MIGRATION_PATH), buildSettingsMigrationSql(spec.settings), "utf8");
console.log(`✅ ${spec.settings.length} paramètres écrits dans ${MIGRATION_PATH}`);
