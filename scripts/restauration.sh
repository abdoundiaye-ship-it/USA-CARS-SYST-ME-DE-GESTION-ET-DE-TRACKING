#!/usr/bin/env bash
# Restauration d'une sauvegarde chiffrée (décision G3-a, docs/21_sauvegardes.md) dans un projet Supabase VIDE
# (nouveau projet, ou Supabase local de l'essai de restauration) : base, tâches pg_cron, fichiers, puis vérification
# des comptages. Jamais sur le projet de production.
#
# Usage : scripts/restauration.sh <archive.tar.gz.gpg>
# Variables : SUPABASE_DB_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY du projet CIBLE ; SAUVEGARDE_PHRASE.
# Outils : psql, gpg, tar, pnpm install déjà fait.
set -euo pipefail

archive="${1:?Usage : scripts/restauration.sh <archive.tar.gz.gpg>}"
: "${SUPABASE_DB_URL:?}" "${SUPABASE_URL:?}" "${SUPABASE_SERVICE_ROLE_KEY:?}" "${SAUVEGARDE_PHRASE:?}"

production_ref="$(sed -n 's/^export const PRODUCTION_PROJECT_REF = "\(.*\)";$/\1/p' lib/env.ts)"
if [[ -z "$production_ref" || "$SUPABASE_DB_URL$SUPABASE_URL" == *"$production_ref"* ]]; then
  echo "⛔ Restauration refusée sur le projet de production : restaurer dans un nouveau projet (docs/21)." >&2
  exit 1
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

echo "→ Déchiffrement"
gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 --decrypt \
  --output "$work/sauvegarde.tar.gz" "$archive" 3<<<"$SAUVEGARDE_PHRASE"
tar -xzf "$work/sauvegarde.tar.gz" -C "$work"
dir="$work/sauvegarde"

echo "→ Rôles (tolérant : les rôles gérés par Supabase existent déjà sur la cible)"
# La copie des rôles contient des GRANT/ALTER gérés par Supabase (ex. GRANT SET ON PARAMETER …) qui ne sont pas
# rejouables par l'utilisateur de restauration ; sur un projet Supabase neuf ces rôles existent déjà. On continue
# malgré ces erreurs attendues (ON_ERROR_STOP=0), puis on restaure le schéma et les données de façon stricte.
psql "$SUPABASE_DB_URL" -X -q -v ON_ERROR_STOP=0 -f "$dir/roles.sql" > /dev/null || true

echo "→ Schéma puis données (une seule transaction)"
psql "$SUPABASE_DB_URL" -X -q -v ON_ERROR_STOP=1 --single-transaction \
  -f "$dir/schema.sql" -c "SET session_replication_role = replica" -f "$dir/donnees.sql" \
  > /dev/null

echo "→ Tâches planifiées (pg_cron)"
psql "$SUPABASE_DB_URL" -X -q -v ON_ERROR_STOP=1 -v jobs="$(cat "$dir/taches-planifiees.json")" > /dev/null <<'SQL'
select cron.schedule(j.jobname, j.schedule, j.command)
from json_to_recordset(:'jobs'::json) as j(jobname text, schedule text, command text);
SQL

echo "→ Fichiers (Storage)"
pnpm exec tsx scripts/restauration-fichiers.ts "$dir/fichiers"

echo "→ Vérification des comptages"
psql "$SUPABASE_DB_URL" -X -At -v ON_ERROR_STOP=1 -f scripts/sql/comptages.sql > "$work/comptages-restaures.json"
pnpm exec tsx scripts/verifier-restauration.ts \
  "$dir/comptages-avant.json" "$dir/comptages-apres.json" "$work/comptages-restaures.json"

echo "Migrations à marquer « applied » sur le nouveau projet (supabase migration repair --status applied …) :"
cat "$dir/migrations-appliquees.txt"
