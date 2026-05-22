#!/usr/bin/env bash
# Production deploy script for the EduSport Strapi backend.
# Idempotent. Safe to re-run. Run from the repo root.

set -euo pipefail

banner() {
  echo ""
  echo "=========================================="
  echo "  $1"
  echo "=========================================="
}

cd "$(dirname "$0")/.."

COMPOSE_FILE="docker-compose.production.yml"
ENV_FILE=".env.production"

# docker compose only auto-reads `.env` (no suffix); we keep secrets in
# `.env.production`, so every invocation must pass --env-file explicitly,
# otherwise ${VAR} references in the compose file resolve to empty strings.
COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

banner "1/6  Pre-flight checks"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE is missing. Copy .env.example and fill in real values."
  exit 1
fi

if ! docker network inspect edusport_net >/dev/null 2>&1; then
  echo "ERROR: docker network 'edusport_net' does not exist."
  echo "Create it once with: docker network create edusport_net"
  exit 1
fi

banner "2/6  Fetching latest code"
git fetch --prune
git reset --hard origin/main

banner "3/6  Building backend image"
"${COMPOSE[@]}" build backend

banner "4/6  Bringing up Postgres and waiting for readiness"
"${COMPOSE[@]}" up -d postgres

# Wait for pg_isready inside the postgres container before starting the backend.
# Strapi 5 will run schema migrations on boot, so the DB must be live first.
ATTEMPTS=0
until "${COMPOSE[@]}" exec -T postgres pg_isready -U strapi >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge 30 ]; then
    echo "ERROR: Postgres did not become ready within 30 attempts."
    exit 1
  fi
  echo "  postgres not ready yet (attempt $ATTEMPTS)..."
  sleep 2
done

banner "5/6  Starting backend"
"${COMPOSE[@]}" up -d backend

banner "6/6  Health check"
# Strapi prints "started successfully" a few seconds before /_health actually
# responds, so poll for up to 60s rather than firing a single shot.
HEALTH_ATTEMPTS=0
until "${COMPOSE[@]}" exec -T backend wget -qO- http://localhost:1337/_health >/dev/null 2>&1; do
  HEALTH_ATTEMPTS=$((HEALTH_ATTEMPTS + 1))
  if [ "$HEALTH_ATTEMPTS" -ge 30 ]; then
    echo "ERROR: /_health did not respond after 30 attempts. Recent logs:"
    "${COMPOSE[@]}" logs --tail=80 backend
    exit 1
  fi
  echo "  /_health not ready yet (attempt $HEALTH_ATTEMPTS)..."
  sleep 2
done
echo "OK: backend is healthy."

docker image prune -f >/dev/null

"${COMPOSE[@]}" ps

echo ""
echo "Deploy finished at $(date -u +%FT%TZ)."
