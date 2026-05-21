#!/usr/bin/env bash
# EduSport backend backup script.
#
# Schedule via cron on the host (as root or the deploy user):
#   0 3 * * * /opt/edusport/edusport_backend/scripts/backup.sh >> /var/log/edusport-backup.log 2>&1
#
# Produces two files per run, in ./backups/:
#   strapi-YYYY-MM-DD.sql.gz   - Postgres dump
#   uploads-YYYY-MM-DD.tar.gz  - public/uploads tarball
#
# Rotation: keeps only the last 14 of each kind.

set -euo pipefail

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

BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

DATE="$(date +%F)"
SQL_FILE="$BACKUP_DIR/strapi-$DATE.sql.gz"
UPLOADS_FILE="$BACKUP_DIR/uploads-$DATE.tar.gz"

echo "[$(date -u +%FT%TZ)] starting backup"

# Stream the dump straight out of the postgres container.
docker compose -f docker-compose.production.yml exec -T postgres \
  pg_dump -U "$DATABASE_USERNAME" -d "$DATABASE_NAME" \
  | gzip -9 > "$SQL_FILE"

echo "  wrote $SQL_FILE ($(du -h "$SQL_FILE" | cut -f1))"

# Tarball uploads from inside the backend container so we always see the live volume.
docker compose -f docker-compose.production.yml exec -T backend \
  tar -C /opt/app/public -czf - uploads > "$UPLOADS_FILE"

echo "  wrote $UPLOADS_FILE ($(du -h "$UPLOADS_FILE" | cut -f1))"

# Rotate: keep last 14 of each.
ls -1t "$BACKUP_DIR"/strapi-*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm --
ls -1t "$BACKUP_DIR"/uploads-*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm --

echo "[$(date -u +%FT%TZ)] backup finished"
