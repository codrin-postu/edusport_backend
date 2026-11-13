#!/usr/bin/env bash
# Click-through of the one-source-per-athlete competitions rule on both portals against a THROWAWAY Strapi on 1419 (fixtures phase4, phase5, phase6,
# phase7, coach-additions, competition-source loaded) started with SKATE_RESULTS_API=http://127.0.0.1:18895. The script starts and stops the fake
# skate-results (scripts/fake-skate.mjs) itself.
# Usage: IDS_FILE=/path/ids.json PG_CONTAINER=es-cs-pg PG_USER=... PG_DB=... BASE=http://127.0.0.1:1419 bash scripts/clickthrough-competition-source.sh
# Behaviour only: every step prints PASS or FAIL.
set -u
BASE="${BASE:-http://127.0.0.1:1419}"
SECRET="${PORTAL_BFF_SECRET:-test-bff-secret-000000000000000000}"
IDS="${IDS_FILE:?set IDS_FILE}"
PGC="${PG_CONTAINER:-es-cs-pg}"; PGU="${PG_USER:?set PG_USER}"; PGD="${PG_DB:?set PG_DB}"
FAKE_PORT=18895
case "$BASE" in http://127.0.0.1:1419*) ;; *) echo "refused: BASE must be the throwaway Strapi on 127.0.0.1:1419"; exit 2;; esac
[ "$PGC" = es-cs-pg ] || { echo "refused: PG_CONTAINER must be es-cs-pg"; exit 2; }
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0
ok() { echo "PASS $1"; }
bad() { echo "FAIL $1"; fail=1; }
py() { python3 -I -c "$1"; }
ids() { py "import json;d=json.load(open('$IDS'));print($1)"; }
BODY="${TMPDIR:-/tmp}/ct-cs-body.$$"
status() { curl -s -o "$BODY" -w '%{http_code}' "$@"; }
json() { py "import json;d=json.load(open('$BODY'));print($1)"; }
expect() {
  if [ "$2" != "$3" ]; then bad "$1 (status $2, want $3; $(head -c 250 "$BODY"))"; return; fi
  if [ $# -ge 5 ] && [ "$(json "$4")" != "$5" ]; then bad "$1 (got $(json "$4"), want $5)"; return; fi
  ok "$1"
}
psql_() { docker exec "$PGC" psql -U "$PGU" -d "$PGD" -tAc "$1"; }
FAKE_PID=""
start_fake() { node "$ROOT/scripts/fake-skate.mjs" "$FAKE_PORT" > "${TMPDIR:-/tmp}/fake-skate-cs.log" 2>&1 & FAKE_PID=$!; for _ in $(seq 20); do curl -s "http://127.0.0.1:$FAKE_PORT/health" > /dev/null && return 0; sleep 0.25; done; return 1; }
stop_fake() { if [ -n "$FAKE_PID" ]; then kill "$FAKE_PID" 2> /dev/null; wait "$FAKE_PID" 2> /dev/null; fi; FAKE_PID=""; }
trap 'stop_fake; rm -f "$BODY"' EXIT
if lsof -i ":$FAKE_PORT" -sTCP:LISTEN > /dev/null 2>&1; then echo "refused: port $FAKE_PORT is busy"; exit 2; fi
start_fake || { echo "fake skate-results did not start"; exit 2; }

H=(-H "x-portal-secret: $SECRET" -H 'content-type: application/json')
login() { status "${H[@]}" -X POST "$BASE/api/portal/auth/login" -d "{\"host\":\"$1\",\"email\":\"$2\",\"password\":\"$3\",\"deviceKey\":null}"; }
MATEI=$(ids "d['athletes']['Matei Ionescu']"); IOANA=$(ids "d['athletes']['Ioana Marin']"); SARA=$(ids "d['athletes']['Sara Dinu']")
S="$BASE/api/portal/sportiv"
psql_ "delete from skate_snapshots" > /dev/null

# 1. Matei: no slug, two hand-entered competitions
code=$(login sportiv parinte1@example.invalid Throwaway-Parent-1); expect "parinte1 on sportiv" "$code" 200 "'accessToken' in d['data']" True
P1=(-H "x-portal-secret: $SECRET" -H "authorization: Bearer $(json "d['data']['accessToken']")" -H 'content-type: application/json')
code=$(status "${P1[@]}" "$S/athletes/$MATEI/competitions"); expect "1. Matei Concursuri: 200, total 2" "$code" 200 "str(d['data']['available']) + ' ' + str(d['data']['total'])" "True 2"
ROW=$(json "d['data']['rows'][0]['resultId']")
code=$(status "${P1[@]}" "$S/athletes/$MATEI/competitions/$ROW"); expect "1. Matei detail: 200, segments empty, no field, no link" "$code" 200 "str(d['data']['segments']) + ' ' + str(d['data']['field']) + ' ' + str(d['data']['officialUrl'])" "[] None None"
code=$(status "${P1[@]}" "$S/athletes/$MATEI/home"); expect "1. Matei Acasa: last competition Cupa Timisoarei" "$code" 200 "d['data']['lastCompetition']['row']['eventName']" "Cupa Timișoarei"
code=$(status "${P1[@]}" "$S/athletes/$MATEI/path"); expect "1. Matei Concursuri badge counts 2" "$code" 200 "[b['count'] for b in d['data']['badges'] if b['key']=='concursuri'][0]" 2
code=$(status "${P1[@]}" "$S/athletes"); expect "1. Matei performance true in the athlete list" "$code" 200 "[a['performance'] for a in d['data']['athletes'] if a['id']=='$MATEI'][0]" True

# 2. Ioana: skate-results rows only, never "Cupa Dubla"
code=$(login sportiv sportiv18@example.invalid Throwaway-Adult-18); expect "sportiv18 on sportiv" "$code" 200 "'accessToken' in d['data']" True
A=(-H "x-portal-secret: $SECRET" -H "authorization: Bearer $(json "d['data']['accessToken']")" -H 'content-type: application/json')
code=$(status "${A[@]}" "$S/athletes/$IOANA/competitions?q=Dubla"); expect "2. Ioana: no row named Cupa Dubla" "$code" 200 "str(d['data']['total']) + ' ' + str(len(d['data']['rows']))" "41 0"
code=$(status "${A[@]}" "$S/athletes/$IOANA/competitions"); expect "2. Ioana: the fake's 41 rows only" "$code" 200 "str(d['data']['total']) + ' ' + str(any('Dublă' in r['eventName'] for r in d['data']['rows']))" "41 False"

# 3. Sara: slug, no results
code=$(login sportiv parinte2@example.invalid Throwaway-Parent-2); expect "parinte2 on sportiv" "$code" 200 "'accessToken' in d['data']" True
P2=(-H "x-portal-secret: $SECRET" -H "authorization: Bearer $(json "d['data']['accessToken']")" -H 'content-type: application/json')
code=$(status "${P2[@]}" "$S/athletes/$SARA/home"); expect "3. Sara Acasa: lastCompetition null" "$code" 200 "d['data']['lastCompetition']" None

# 4. Coach, all athletes: h- events for Matei, s- events for Ioana, no Cupa Dubla
code=$(login antrenor antrenor1@example.invalid Throwaway-Coach-1); expect "antrenor1 on antrenor" "$code" 200 "'accessToken' in d['data']" True
C=(-H "x-portal-secret: $SECRET" -H "authorization: Bearer $(json "d['data']['accessToken']")" -H 'content-type: application/json')
code=$(status "${C[@]}" "$BASE/api/portal/coach/competitions?scope=all"); expect "4. coach competitions: 200 available" "$code" 200 "d['data']['available']" True
expect "4. coach: h- events for Matei" "$code" 200 "sorted(e['name'] for e in d['data']['events'] if e['eventId'].startswith('h-') and any(m['name']=='Matei Ionescu' for m in e['members']))" "['Cupa Reșiței', 'Cupa Timișoarei']"
expect "4. coach: s- events for Ioana" "$code" 200 "any(e['eventId'].startswith('s-') and any(m['name']=='Ioana Marin' for m in e['members']) for e in d['data']['events'])" True
expect "4. coach: no event named Cupa Dubla" "$code" 200 "any(e['name']=='Cupa Dublă' for e in d['data']['events'])" False

# 5. skate-results away and the snapshots gone: the coach list is unavailable, Matei still has his competitions
stop_fake
psql_ "delete from skate_snapshots" > /dev/null
code=$(status "${C[@]}" "$BASE/api/portal/coach/competitions?scope=all"); expect "5. service away, cold cache: coach competitions unavailable" "$code" 200 "d['data']" "{'available': False}"
code=$(status "${P1[@]}" "$S/athletes/$MATEI/competitions"); expect "5. service away: Matei Concursuri still 200, total 2" "$code" 200 "str(d['data']['available']) + ' ' + str(d['data']['total'])" "True 2"

[ "$fail" = 0 ] && echo "ALL PASS" || echo "SOME FAILED"
exit $fail
