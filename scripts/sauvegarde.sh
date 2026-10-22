#!/usr/bin/env bash
# Sauvegarde complète et chiffrée (décision G3-a, docs/21_sauvegardes.md) : base (schéma, rôles, données), tâches
# pg_cron, migrations appliquées, fichiers Storage, comptages des tables avant et après la copie des données.
# Lecture seule sur le projet sauvegardé. Exécutée chaque nuit par GitHub Actions (.github/workflows/sauvegarde.yml).
#
# Usage : scripts/sauvegarde.sh <archive.tar.gz.gpg>
# Variables : SUPABASE_DB_URL (connexion PostgreSQL, mot de passe compris), SUPABASE_URL (API du projet),
#             SUPABASE_SERVICE_ROLE_KEY (lecture des fichiers), SAUVEGARDE_PHRASE (phrase de chiffrement).
# Outils : psql, gpg, tar, curl, Docker (supabase db dump), pnpm install déjà fait.
set -euo pipefail

archive="${1:?Usage : scripts/sauvegarde.sh <archive.tar.gz.gpg>}"
: "${SUPABASE_DB_URL:?}" "${SUPABASE_URL:?}" "${SUPABASE_SERVICE_ROLE_KEY:?}" "${SAUVEGARDE_PHRASE:?}"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
dir="$work/sauvegarde"
mkdir -p "$dir/versions"

query() { psql "$SUPABASE_DB_URL" -X -At -v ON_ERROR_STOP=1 -f "$1"; }

# Copie de la base : en production, le projet est relié (SUPABASE_LINKED=1) et la CLI se connecte au pooler avec le
# bon nom d'utilisateur (postgres.<ref>) — `--db-url` sur le pooler tronque ce nom. En local (essai sur base fictive),
# pas de projet relié : on passe l'URL locale directement.
dump() {
  if [ "${SUPABASE_LINKED:-0}" = "1" ]; then
    pnpm exec supabase db dump --linked "$@"
  else
    pnpm exec supabase db dump --db-url "$SUPABASE_DB_URL" "$@"
  fi
}

echo "→ Comptage des tables (avant)"
query scripts/sql/comptages.sql > "$dir/comptages-avant.json"
echo "→ Copie de la base (schéma, rôles, données)"
dump -f "$dir/schema.sql"
dump --role-only -f "$dir/roles.sql"
dump --data-only -f "$dir/donnees.sql"
echo "→ Comptage des tables (après), tâches planifiées, migrations appliquées"
query scripts/sql/comptages.sql > "$dir/comptages-apres.json"
query scripts/sql/taches-planifiees.sql > "$dir/taches-planifiees.json"
query scripts/sql/migrations-appliquees.sql > "$dir/migrations-appliquees.txt"

echo "→ Versions d'Auth et de Storage (mêmes versions pour l'essai de restauration)"
curl -sf "$SUPABASE_URL/auth/v1/health" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  | sed -n 's/.*"version":"\([^"]*\)".*/\1/p' > "$dir/versions/gotrue-version"
storage_version="$(curl -sf "$SUPABASE_URL/storage/v1/version" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY")"
echo "v${storage_version#v}" > "$dir/versions/storage-version"

echo "→ Copie des fichiers (Storage)"
pnpm exec tsx scripts/sauvegarde-fichiers.ts "$dir/fichiers"

echo "→ Archive chiffrée (AES-256)"
tar -czf "$work/sauvegarde.tar.gz" -C "$work" sauvegarde
gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 --symmetric --cipher-algo AES256 \
  --output "$archive" "$work/sauvegarde.tar.gz" 3<<<"$SAUVEGARDE_PHRASE"
echo "✅ Sauvegarde écrite : $archive ($(du -h "$archive" | cut -f1))"
