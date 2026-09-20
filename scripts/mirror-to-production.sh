#!/usr/bin/env bash
#
# Replaces production's content with the local database, keeping production's
# own auth layer.
#
# This is destructive. Production's content, media records and submissions are
# dropped and replaced by whatever is in the local database. What survives is
# the auth layer, restored back on top afterwards:
#
#   admin_%                    admin accounts, roles, permissions
#   strapi_api_token%          the API tokens the live frontend authenticates with
#   strapi_transfer_token%     transfer tokens
#   up_%                       users-permissions roles, including the public one
#
# Losing the API tokens would break the live site (the token in production's env
# file would no longer exist), and losing the public role permissions would turn
# anonymous GETs into 403s. That is why they are carried over rather than taken
# from local.
#
# Before anything is touched, a full production dump and a tar of the uploads
# are written to the VM home directory. They are the only copy of what is
# replaced, submissions included.
#
# Usage:
#   scripts/mirror-to-production.sh --host <ip-or-name> --user <ssh-user> \
#       [--key ~/.ssh/<key>] [--backend-path /opt/edusport/edusport_backend] [--yes]
#
# Without --yes it prints the plan, asks for confirmation and stops if the
# answer is not exactly "mirror".

set -euo pipefail

HOST=""
USER_NAME=""
KEY=""
BACKEND_PATH="/opt/edusport/edusport_backend"
ASSUME_YES=0

LOCAL_DB_CONTAINER="strapi_db"
LOCAL_APP_CONTAINER="strapi_app"
REMOTE_DB_CONTAINER="strapi_db"
REMOTE_APP_CONTAINER="strapi_app"
DB_NAME="edusport_postgres"
DB_USER="strapi"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) HOST="$2"; shift 2 ;;
    --user) USER_NAME="$2"; shift 2 ;;
    --key) KEY="$2"; shift 2 ;;
    --backend-path) BACKEND_PATH="$2"; shift 2 ;;
    --yes) ASSUME_YES=1; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

[[ -n "$HOST" && -n "$USER_NAME" ]] || { echo "--host and --user are required" >&2; exit 2; }

SSH_OPTS=(-o ConnectTimeout=15)
[[ -n "$KEY" ]] && SSH_OPTS+=(-i "$KEY")
TARGET="${USER_NAME}@${HOST}"
remote() { ssh "${SSH_OPTS[@]}" "$TARGET" "$@"; }

STAMP="$(date +%Y%m%d-%H%M%S)"
WORK="$(mktemp -d)"
LOCAL_DUMP="${WORK}/local-${STAMP}.dump"
trap 'rm -rf "$WORK"' EXIT

# Tables whose production rows are restored after the content is replaced.
KEEP_PATTERNS="table_name LIKE 'admin\\_%' OR table_name LIKE 'strapi\\_api\\_token%' OR table_name LIKE 'strapi\\_transfer\\_token%' OR table_name LIKE 'up\\_%'"

echo "== Preflight =="
docker exec "$LOCAL_DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null
echo "  local database reachable"
remote "docker inspect -f '{{.State.Running}}' ${REMOTE_DB_CONTAINER} ${REMOTE_APP_CONTAINER}" >/dev/null
echo "  production containers reachable"

KEEP_TABLES="$(remote "docker exec ${REMOTE_DB_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -At -c \"select table_name from information_schema.tables where table_schema='public' and (${KEEP_PATTERNS}) order by table_name\"")"
[[ -n "$KEEP_TABLES" ]] || { echo "Found no auth tables on production, refusing to continue" >&2; exit 1; }
echo "  auth tables to carry over:"
echo "$KEEP_TABLES" | sed 's/^/    /'

if [[ "$ASSUME_YES" -ne 1 ]]; then
  cat <<WARNING

This replaces the production database at ${HOST} with the local one.
Everything in production outside the tables listed above is dropped,
including every submission the live site has received. The backup written
in the next step is the only copy.

WARNING
  read -r -p 'Type "mirror" to continue: ' answer
  [[ "$answer" == "mirror" ]] || { echo "Stopped."; exit 1; }
fi

echo "== Backing up production =="
remote "docker exec ${REMOTE_DB_CONTAINER} pg_dump -U ${DB_USER} -Fc ${DB_NAME} > ~/prod-db-${STAMP}.dump"
remote "tar czf ~/prod-uploads-${STAMP}.tar.gz -C ${BACKEND_PATH} public/uploads"
remote "ls -la ~/prod-db-${STAMP}.dump ~/prod-uploads-${STAMP}.tar.gz"

echo "== Saving production's auth layer =="
KEEP_ARGS="$(echo "$KEEP_TABLES" | sed 's/^/--table=/' | tr '\n' ' ')"
remote "docker exec ${REMOTE_DB_CONTAINER} pg_dump -U ${DB_USER} -Fc --data-only ${KEEP_ARGS} ${DB_NAME} > ~/prod-auth-${STAMP}.dump"

echo "== Dumping the local database =="
docker exec "$LOCAL_DB_CONTAINER" pg_dump -U "$DB_USER" -Fc "$DB_NAME" > "$LOCAL_DUMP"
ls -la "$LOCAL_DUMP"
scp "${SSH_OPTS[@]}" "$LOCAL_DUMP" "${TARGET}:~/local-${STAMP}.dump"

echo "== Stopping Strapi on production =="
remote "docker stop ${REMOTE_APP_CONTAINER}"

echo "== Restoring the local database over production =="
# The app is stopped, but psql itself holds a connection, so the drop is issued
# from the maintenance database after terminating anything else still attached.
remote "docker exec ${REMOTE_DB_CONTAINER} psql -U ${DB_USER} -d postgres -c \"select pg_terminate_backend(pid) from pg_stat_activity where datname='${DB_NAME}' and pid <> pg_backend_pid()\" >/dev/null"
remote "docker exec ${REMOTE_DB_CONTAINER} psql -U ${DB_USER} -d postgres -c 'DROP DATABASE ${DB_NAME}'"
remote "docker exec ${REMOTE_DB_CONTAINER} psql -U ${DB_USER} -d postgres -c 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'"
remote "docker exec -i ${REMOTE_DB_CONTAINER} pg_restore -U ${DB_USER} -d ${DB_NAME} --no-owner < ~/local-${STAMP}.dump"

echo "== Putting production's auth layer back =="
TRUNCATE_LIST="$(echo "$KEEP_TABLES" | tr '\n' ',' | sed 's/,$//')"
remote "docker exec ${REMOTE_DB_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -c 'TRUNCATE ${TRUNCATE_LIST} RESTART IDENTITY CASCADE'"
remote "docker exec -i ${REMOTE_DB_CONTAINER} pg_restore -U ${DB_USER} -d ${DB_NAME} --data-only --no-owner --disable-triggers < ~/prod-auth-${STAMP}.dump"

# A data-only restore leaves each id sequence where the local dump left it, which
# can sit below the ids just written. The next insert would then collide, so every
# sequence is pushed past the highest id its table holds.
echo "== Resetting id sequences =="
remote "docker exec ${REMOTE_DB_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -At -c \"
  select 'select setval(' || quote_literal(quote_ident(s.sequence_name)) || ', coalesce((select max(id) from ' || quote_ident(t.table_name) || '), 0) + 1, false);'
  from information_schema.sequences s
  join information_schema.tables t on s.sequence_name = t.table_name || '_id_seq'
  where s.sequence_schema = 'public' and t.table_schema = 'public'
\" > /tmp/reseq-${STAMP}.sql"
remote "docker exec -i ${REMOTE_DB_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -q < /tmp/reseq-${STAMP}.sql >/dev/null"

echo "== Copying media =="
rsync -az --delete -e "ssh ${SSH_OPTS[*]}" ./public/uploads/ "${TARGET}:${BACKEND_PATH}/public/uploads/"

echo "== Starting Strapi =="
remote "docker start ${REMOTE_APP_CONTAINER}"

echo "== Health =="
for attempt in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' -m 10 https://cms-edusport.codrin.space/admin || true)"
  [[ "$code" == "200" ]] && { echo "  admin responds 200 after ${attempt} attempt(s)"; break; }
  sleep 10
done
[[ "$code" == "200" ]] || { echo "  admin did not come back up (last code ${code})" >&2; exit 1; }

echo
echo "Done. Backups kept on the VM:"
echo "  ~/prod-db-${STAMP}.dump        full production database as it was"
echo "  ~/prod-uploads-${STAMP}.tar.gz production media as it was"
echo "  ~/prod-auth-${STAMP}.dump      the auth layer that was carried over"
