#!/usr/bin/env bash
# Disaster-recovery restore for the EduSport backend Postgres database.
#
# Usage:
#   ./scripts/restore.sh backups/strapi-2026-05-18.sql.gz
#
# To restore matching uploads, manually extract the sibling tarball, e.g.:
#   docker compose -f docker-compose.production.yml stop backend
#   docker run --rm -v edusport_backend_uploads:/uploads -v "$PWD/backups":/b alpine \
#     sh -c "cd /uploads && tar -xzf /b/uploads-2026-05-18.tar.gz --strip-components=1"
#   docker compose -f docker-compose.production.yml start backend

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <path-to-strapi-YYYY-MM-DD.sql.gz>"
  exit 1
fi

DUMP="$1"
if [ ! -f "$DUMP" ]; then
  echo "ERROR: dump file not found: $DUMP"
  exit 1
fi

cd "$(dirname "$0")/.."

ENV_FILE=".env.production"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found."
  exit 1
fi

# shellcheck disable=SC1090
set -a
. "$ENV_FILE"
set +a

echo ""
echo "About to restore database '$DATABASE_NAME' from: $DUMP"
echo "This will DROP and RECREATE '$DATABASE_NAME'. All current data will be lost."
read -r -p "Type 'yes' to continue: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

COMPOSE="docker compose -f docker-compose.production.yml"

echo "Stopping backend..."
$COMPOSE stop backend

echo "Dropping and recreating database..."
$COMPOSE exec -T postgres psql -U "$DATABASE_USERNAME" -d postgres -c "DROP DATABASE IF EXISTS \"$DATABASE_NAME\";"
$COMPOSE exec -T postgres psql -U "$DATABASE_USERNAME" -d postgres -c "CREATE DATABASE \"$DATABASE_NAME\" OWNER \"$DATABASE_USERNAME\";"

echo "Restoring dump..."
gunzip -c "$DUMP" | $COMPOSE exec -T postgres psql -U "$DATABASE_USERNAME" -d "$DATABASE_NAME"

echo "Starting backend..."
$COMPOSE up -d backend

echo "Done. Remember to restore the matching uploads-*.tar.gz if needed (see header comment)."
