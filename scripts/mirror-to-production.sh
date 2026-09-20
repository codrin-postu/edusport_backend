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
# Production keeps its uploads in a docker named volume mounted at
# /opt/app/public/uploads inside the container, NOT in the repo checkout.
# Writing to the repo path would leave Strapi serving 404s for media the
# database happily points at, so the volume is addressed directly.
REMOTE_UPLOADS="/var/lib/docker/volumes/edusport_backend_uploads/_data"
ASSUME_YES=0

# The two sides do not agree on names: locally the stack is strapi_app /
# strapi_db with the database called edusport_postgres, while on the VM it is
# edusport_backend / edusport_postgres with the database called strapi. Both
# sets are therefore explicit, and overridable.
LOCAL_DB_CONTAINER="strapi_db"
LOCAL_DB_NAME="edusport_postgres"
REMOTE_DB_CONTAINER="edusport_postgres"
REMOTE_APP_CONTAINER="edusport_backend"
REMOTE_DB_NAME="strapi"
DB_USER="strapi"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) HOST="$2"; shift 2 ;;
    --user) USER_NAME="$2"; shift 2 ;;
    --key) KEY="$2"; shift 2 ;;
    --backend-path) BACKEND_PATH="$2"; shift 2 ;;
    --remote-uploads) REMOTE_UPLOADS="$2"; shift 2 ;;
    --local-db-container) LOCAL_DB_CONTAINER="$2"; shift 2 ;;
    --local-db-name) LOCAL_DB_NAME="$2"; shift 2 ;;
    --remote-db-container) REMOTE_DB_CONTAINER="$2"; shift 2 ;;
    --remote-app-container) REMOTE_APP_CONTAINER="$2"; shift 2 ;;
    --remote-db-name) REMOTE_DB_NAME="$2"; shift 2 ;;
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
docker exec "$LOCAL_DB_CONTAINER" pg_isready -U "$DB_USER" -d "$LOCAL_DB_NAME" >/dev/null
echo "  local database reachable"
remote "docker inspect -f '{{.State.Running}}' ${REMOTE_DB_CONTAINER} ${REMOTE_APP_CONTAINER}" >/dev/null
echo "  production containers reachable"

KEEP_TABLES="$(remote "docker exec ${REMOTE_DB_CONTAINER} psql -U ${DB_USER} -d ${REMOTE_DB_NAME} -At -c \"select table_name from information_schema.tables where table_schema='public' and (${KEEP_PATTERNS}) order by table_name\"")"
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
remote "docker exec ${REMOTE_DB_CONTAINER} pg_dump -U ${DB_USER} -Fc ${REMOTE_DB_NAME} > ~/prod-db-${STAMP}.dump"
remote "tar czf ~/prod-uploads-${STAMP}.tar.gz -C ${REMOTE_UPLOADS} ."
remote "ls -la ~/prod-db-${STAMP}.dump ~/prod-uploads-${STAMP}.tar.gz"

echo "== Saving production's auth layer =="
KEEP_ARGS="$(echo "$KEEP_TABLES" | sed 's/^/--table=/' | tr '\n' ' ')"
remote "docker exec ${REMOTE_DB_CONTAINER} pg_dump -U ${DB_USER} -Fc --data-only ${KEEP_ARGS} ${REMOTE_DB_NAME} > ~/prod-auth-${STAMP}.dump"

echo "== Dumping the local database =="
docker exec "$LOCAL_DB_CONTAINER" pg_dump -U "$DB_USER" -Fc "$LOCAL_DB_NAME" > "$LOCAL_DUMP"
ls -la "$LOCAL_DUMP"
scp "${SSH_OPTS[@]}" "$LOCAL_DUMP" "${TARGET}:~/local-${STAMP}.dump"

echo "== Stopping Strapi on production =="
remote "docker stop ${REMOTE_APP_CONTAINER}"

echo "== Restoring the local database over production =="
# The app is stopped, but psql itself holds a connection, so the drop is issued
# from the maintenance database after terminating anything else still attached.
remote "docker exec ${REMOTE_DB_CONTAINER} psql -U ${DB_USER} -d postgres -c \"select pg_terminate_backend(pid) from pg_stat_activity where datname='${REMOTE_DB_NAME}' and pid <> pg_backend_pid()\" >/dev/null"
remote "docker exec ${REMOTE_DB_CONTAINER} psql -U ${DB_USER} -d postgres -c 'DROP DATABASE ${REMOTE_DB_NAME}'"
remote "docker exec ${REMOTE_DB_CONTAINER} psql -U ${DB_USER} -d postgres -c 'CREATE DATABASE ${REMOTE_DB_NAME} OWNER ${DB_USER}'"
remote "docker exec -i ${REMOTE_DB_CONTAINER} pg_restore -U ${DB_USER} -d ${REMOTE_DB_NAME} --no-owner < ~/local-${STAMP}.dump"

echo "== Putting production's auth layer back =="
# Every content table carries created_by_id / updated_by_id pointing at
# admin_users. TRUNCATE ... CASCADE on the auth tables therefore does not stop
# at them: it walks those foreign keys and empties the content that was just
# restored. Clearing the audit columns first removes the references, so the
# auth rows can be deleted on their own.
remote "docker exec ${REMOTE_DB_CONTAINER} psql -U ${DB_USER} -d ${REMOTE_DB_NAME} -At -c \"
  select 'update ' || quote_ident(table_name) || ' set ' || string_agg(quote_ident(column_name) || ' = null', ', ') || ';'
  from information_schema.columns
  where table_schema = 'public' and column_name in ('created_by_id', 'updated_by_id')
  group by table_name
\" > /tmp/null-audit-${STAMP}.sql"
remote "docker exec -i ${REMOTE_DB_CONTAINER} psql -U ${DB_USER} -d ${REMOTE_DB_NAME} -q < /tmp/null-audit-${STAMP}.sql >/dev/null"

# Deleted rather than truncated, and children before parents, so no cascade is
# needed and nothing outside these tables is touched.
DELETE_ORDER="$(echo "$KEEP_TABLES" | grep '_lnk$' || true; echo "$KEEP_TABLES" | grep -v '_lnk$')"
DELETE_SQL="$(echo "$DELETE_ORDER" | sed 's/^/delete from /; s/$/;/' | tr '\n' ' ')"
remote "docker exec ${REMOTE_DB_CONTAINER} psql -U ${DB_USER} -d ${REMOTE_DB_NAME} -q -c \"${DELETE_SQL}\""
remote "docker exec -i ${REMOTE_DB_CONTAINER} pg_restore -U ${DB_USER} -d ${REMOTE_DB_NAME} --data-only --no-owner --disable-triggers < ~/prod-auth-${STAMP}.dump"

# A data-only restore leaves each id sequence where the local dump left it, which
# can sit below the ids just written. The next insert would then collide, so every
# sequence is pushed past the highest id its table holds.
echo "== Resetting id sequences =="
remote "docker exec ${REMOTE_DB_CONTAINER} psql -U ${DB_USER} -d ${REMOTE_DB_NAME} -At -c \"
  select 'select setval(' || quote_literal(quote_ident(s.sequence_name)) || ', coalesce((select max(id) from ' || quote_ident(t.table_name) || '), 0) + 1, false);'
  from information_schema.sequences s
  join information_schema.tables t on s.sequence_name = t.table_name || '_id_seq'
  where s.sequence_schema = 'public' and t.table_schema = 'public'
\" > /tmp/reseq-${STAMP}.sql"
remote "docker exec -i ${REMOTE_DB_CONTAINER} psql -U ${DB_USER} -d ${REMOTE_DB_NAME} -q < /tmp/reseq-${STAMP}.sql >/dev/null"

echo "== Copying media =="
rsync -az --delete -e "ssh ${SSH_OPTS[*]}" ./public/uploads/ "${TARGET}:${REMOTE_UPLOADS}/"

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
