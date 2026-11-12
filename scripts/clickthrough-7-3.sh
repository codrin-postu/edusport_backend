#!/usr/bin/env bash
# Click-through of phase 7-3 (competitions from skate-results) against a THROWAWAY Strapi on 1413 (fixtures phase4, phase5, phase6, phase7 loaded)
# started with SKATE_RESULTS_API=http://127.0.0.1:18894. The script starts and stops the fake skate-results (scripts/fake-skate.mjs) itself.
# Usage: IDS_FILE=/path/ids.json PG_CONTAINER=es73-pg PG_USER=... PG_DB=... BASE=http://127.0.0.1:1413 bash scripts/clickthrough-7-3.sh
# Behaviour only: every step prints PASS or FAIL.
set -u
BASE="${BASE:-http://127.0.0.1:1413}"
SECRET="${PORTAL_BFF_SECRET:-test-bff-secret-000000000000000000}"
IDS="${IDS_FILE:?set IDS_FILE}"
PGC="${PG_CONTAINER:-es73-pg}"; PGU="${PG_USER:?set PG_USER}"; PGD="${PG_DB:?set PG_DB}"
FAKE_PORT=18894
case "$BASE" in http://127.0.0.1:1413*) ;; *) echo "refused: BASE must be the throwaway Strapi on 127.0.0.1:1413"; exit 2;; esac
[ "$PGC" = es73-pg ] || { echo "refused: PG_CONTAINER must be es73-pg"; exit 2; }
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0
ok() { echo "PASS $1"; }
bad() { echo "FAIL $1"; fail=1; }
py() { python3 -I -c "$1"; }
ids() { py "import json;d=json.load(open('$IDS'));print($1)"; }
BODY="${TMPDIR:-/tmp}/ct-73-body.$$"
status() { curl -s -o "$BODY" -w '%{http_code}' "$@"; }
json() { py "import json;d=json.load(open('$BODY'));print($1)"; }
expect() {
  if [ "$2" != "$3" ]; then bad "$1 (status $2, want $3; $(head -c 250 "$BODY"))"; return; fi
  if [ $# -ge 5 ] && [ "$(json "$4")" != "$5" ]; then bad "$1 (got $(json "$4"), want $5)"; return; fi
  ok "$1"
}
psql_() { docker exec "$PGC" psql -U "$PGU" -d "$PGD" -tAc "$1"; }
FAKE_PID=""
start_fake() { node "$ROOT/scripts/fake-skate.mjs" "$FAKE_PORT" > "${TMPDIR:-/tmp}/fake-skate-73.log" 2>&1 & FAKE_PID=$!; for _ in $(seq 20); do curl -s "http://127.0.0.1:$FAKE_PORT/health" > /dev/null && return 0; sleep 0.25; done; return 1; }
stop_fake() { if [ -n "$FAKE_PID" ]; then kill "$FAKE_PID" 2> /dev/null; wait "$FAKE_PID" 2> /dev/null; fi; FAKE_PID=""; }
trap 'stop_fake; rm -f "$BODY"' EXIT
if lsof -i ":$FAKE_PORT" -sTCP:LISTEN > /dev/null 2>&1; then echo "refused: port $FAKE_PORT is busy"; exit 2; fi
start_fake || { echo "fake skate-results did not start"; exit 2; }

H=(-H "x-portal-secret: $SECRET" -H 'content-type: application/json')
login() { status "${H[@]}" -X POST "$BASE/api/portal/auth/login" -d "{\"host\":\"$1\",\"email\":\"$2\",\"password\":\"$3\",\"deviceKey\":null}"; }
IOANA=$(ids "d['athletes']['Ioana Marin']"); SARA=$(ids "d['athletes']['Sara Dinu']")
S="$BASE/api/portal/sportiv"
psql_ "delete from skate_snapshots" > /dev/null

# Sara (slug, no results): Acasa has no competition card, the list is available and empty
code=$(login sportiv parinte2@example.invalid Throwaway-Parent-2); expect "parinte2 on sportiv" "$code" 200 "'accessToken' in d['data']" True
P=(-H "x-portal-secret: $SECRET" -H "authorization: Bearer $(json "d['data']['accessToken']")" -H 'content-type: application/json')
code=$(status "${P[@]}" "$S/athletes/$SARA/home"); expect "slug athlete with zero results: Acasa lastCompetition null" "$code" 200 "d['data']['lastCompetition']" None
code=$(status "${P[@]}" "$S/athletes/$SARA/competitions"); expect "slug athlete with zero results: list available, 0 rows" "$code" 200 "str(d['data']['available']) + ' ' + str(len(d['data']['rows']))" "True 0"

# Ioana (41 results)
code=$(login sportiv sportiv18@example.invalid Throwaway-Adult-18); expect "sportiv18 on sportiv" "$code" 200 "'accessToken' in d['data']" True
A=(-H "x-portal-secret: $SECRET" -H "authorization: Bearer $(json "d['data']['accessToken']")" -H 'content-type: application/json')
L="$S/athletes/$IOANA/competitions"
code=$(status "${A[@]}" "$S/athletes/$IOANA/home"); expect "Acasa card: lastCompetition available" "$code" 200 "d['data']['lastCompetition']['available']" True
expect "Acasa card: field size 10" "$code" 200 "d['data']['lastCompetition']['field']" 10
code=$(status "${A[@]}" "$L?page=1"); expect "list page 1: 20 rows" "$code" 200 "len(d['data']['rows'])" 20
expect "list: total 41, three seasons" "$code" 200 "str(d['data']['total']) + ' ' + str(len(d['data']['seasons']))" "41 3"
ROW1=$(json "d['data']['rows'][0]['resultId']")
code=$(status "${A[@]}" "$L?page=3"); expect "list page 3: 1 row of 41" "$code" 200 "len(d['data']['rows'])" 1
code=$(status "${A[@]}" "$L?q=brasov"); expect "search brasov finds only Brasov rows" "$code" 200 \
  "str(0 < len(d['data']['rows']) < 20) + ' ' + str(all('brasov' in (r['eventName'] + ' ' + (r['location'] or '')).lower().replace('ș','s') for r in d['data']['rows']))" "True True"
code=$(status "${A[@]}" "$L?sort=points"); expect "sort points: first total is the max" "$code" 200 "d['data']['rows'][0]['total'] == max(r['total'] for r in d['data']['rows']) == d['data']['records']['best']" True
code=$(status "${A[@]}" "$L/$ROW1"); expect "detail of own result: two segments" "$code" 200 "len(d['data']['segments'])" 2
expect "detail: short program first, elements present" "$code" 200 "str(d['data']['segments'][0]['isShort']) + ' ' + str(len(d['data']['segments'][0]['elements']))" "True 2"
code=$(status "${A[@]}" "$L/5000"); expect "foreign result id is 404" "$code" 404
code=$(status "${A[@]}" "$S/athletes/$IOANA/path"); expect "Concursuri badge counts 41" "$code" 200 "[b['count'] for b in d['data']['badges'] if b['key']=='concursuri'][0]" 41

# the service goes away: a warm cache answers stale
stop_fake
psql_ "update skate_snapshots set fetched_at = now() - interval '2 hours'" > /dev/null
status "${A[@]}" "$L" > /dev/null; sleep 1.5
code=$(status "${A[@]}" "$L"); expect "service stopped, warm cache: stale true" "$code" 200 "str(d['data']['available']) + ' ' + str(d['data']['stale']) + ' ' + str(d['data']['total'])" "True True 41"

# cold cache with the service away
psql_ "delete from skate_snapshots" > /dev/null
code=$(status "${A[@]}" "$L"); expect "cold athlete: list available false" "$code" 200 "d['data']" "{'available': False}"
t0=$(python3 -c 'import time;print(time.time())')
code=$(status "${A[@]}" "$S/athletes/$IOANA/home"); t1=$(python3 -c 'import time;print(time.time())')
expect "cold athlete: Acasa lastCompetition available false" "$code" 200 "d['data']['lastCompetition']" "{'available': False}"
python3 -c "import sys;sys.exit(0 if $t1 - $t0 < 2.0 else 1)" && ok "cold athlete: Acasa answers fast" || bad "cold athlete: Acasa took $(python3 -c "print(round($t1 - $t0, 2))")s"

[ "$fail" = 0 ] && echo "ALL PASS" || echo "SOME FAILED"
exit $fail
