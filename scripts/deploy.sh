#!/usr/bin/env bash
# Production deploy script for the EduSport Strapi backend.
# Idempotent. Safe to re-run. Run from the repo root:
#   cd /opt/edusport/edusport_backend && ./scripts/deploy.sh [phase]
#
# Phases (run individually so CI can track each step, or `all` for a full run):
#   pull    fetch + hard-reset to origin/${DEPLOY_REF:-main}
#   build   pre-flight (env + docker network) + docker compose build backend
#   up      start postgres, wait for readiness, then start backend (runs migrations)
#   health  poll /_health, prune dangling images, print status
#   all     pull -> build -> up -> health   (default)
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
DEPLOY_REF="${DEPLOY_REF:-main}"

# docker compose only auto-reads `.env` (no suffix); we keep secrets in
# `.env.production`, so every invocation must pass --env-file explicitly,
# otherwise ${VAR} references in the compose file resolve to empty strings.
COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

require_env() {
  if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: $ENV_FILE is missing. Copy .env.example and fill in real values."
    exit 1
  fi
}

require_network() {
  if ! docker network inspect edusport_net >/dev/null 2>&1; then
    echo "ERROR: docker network 'edusport_net' does not exist."
    echo "Create it once with: docker network create edusport_net"
    exit 1
  fi
}

phase_pull() {
  banner "Fetching origin/${DEPLOY_REF}"
  git fetch --prune
  git reset --hard "origin/${DEPLOY_REF}"
}

phase_build() {
  banner "Pre-flight checks"
  require_env
  require_network
  banner "Building backend image"
  "${COMPOSE[@]}" build backend
}

phase_up() {
  require_env
  require_network
  banner "Bringing up Postgres and waiting for readiness"
  "${COMPOSE[@]}" up -d postgres
  # Strapi 5 runs schema migrations on boot, so the DB must be live first.
  local attempts=0
  until "${COMPOSE[@]}" exec -T postgres pg_isready -U strapi >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 30 ]; then
      echo "ERROR: Postgres did not become ready within 30 attempts."
      exit 1
    fi
    echo "  postgres not ready yet (attempt $attempts)..."
    sleep 2
  done

  banner "Starting backend"
  "${COMPOSE[@]}" up -d backend
}

phase_health() {
  banner "Health check"
  # Strapi prints "started successfully" a few seconds before /_health actually
  # responds, so poll for up to 60s rather than firing a single shot.
  local attempts=0
  until "${COMPOSE[@]}" exec -T backend wget -qO- http://127.0.0.1:1337/_health >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 30 ]; then
      echo "ERROR: /_health did not respond after 30 attempts. Recent logs:"
      "${COMPOSE[@]}" logs --tail=80 backend
      exit 1
    fi
    echo "  /_health not ready yet (attempt $attempts)..."
    sleep 2
  done
  echo "OK: backend is healthy."

  docker image prune -f >/dev/null
  "${COMPOSE[@]}" ps
  echo ""
  echo "Deploy finished at $(date -u +%FT%TZ)."
}

case "${1:-all}" in
  pull)   phase_pull ;;
  build)  phase_build ;;
  up)     phase_up ;;
  health) phase_health ;;
  all)    phase_pull; phase_build; phase_up; phase_health ;;
  *)      echo "usage: $0 [pull|build|up|health|all]" >&2; exit 2 ;;
esac
