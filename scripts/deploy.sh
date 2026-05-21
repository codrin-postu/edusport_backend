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

banner "1/6  Pre-flight checks"

if [ ! -f .env.production ]; then
  echo "ERROR: .env.production is missing. Copy .env.example and fill in real values."
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
docker compose -f "$COMPOSE_FILE" build backend

banner "4/6  Bringing up Postgres and waiting for readiness"
docker compose -f "$COMPOSE_FILE" up -d postgres

# Wait for pg_isready inside the postgres container before starting the backend.
# Strapi 5 will run schema migrations on boot, so the DB must be live first.
ATTEMPTS=0
until docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U strapi >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge 30 ]; then
    echo "ERROR: Postgres did not become ready within 30 attempts."
    exit 1
  fi
  echo "  postgres not ready yet (attempt $ATTEMPTS)..."
  sleep 2
done

banner "5/6  Starting backend"
docker compose -f "$COMPOSE_FILE" up -d backend

# Give Strapi a moment to migrate + boot before we probe the health endpoint.
sleep 10

banner "6/6  Health check"
if docker compose -f "$COMPOSE_FILE" exec -T backend wget -qO- http://localhost:1337/_health >/dev/null; then
  echo "OK: backend is healthy."
else
  echo "WARN: /_health probe failed. Showing recent logs:"
  docker compose -f "$COMPOSE_FILE" logs --tail=80 backend
  exit 1
fi

docker image prune -f >/dev/null

docker compose -f "$COMPOSE_FILE" ps

echo ""
echo "Deploy finished at $(date -u +%FT%TZ)."
