#!/usr/bin/env bash
# Click-through of the coach additions against a THROWAWAY Strapi (fixtures phase4, phase5, phase6, coach-additions loaded).
# Usage: IDS_FILE=/path/ids.json BASE=http://127.0.0.1:1389 bash scripts/clickthrough-coach-additions.sh
set -u
BASE="${BASE:-http://127.0.0.1:1389}"
SECRET="${PORTAL_BFF_SECRET:-test-bff-secret-000000000000000000}"
IDS="${IDS_FILE:?set IDS_FILE}"
case "$BASE" in http://127.0.0.1:1389*) ;; *) echo "refused: BASE must be the throwaway Strapi on 127.0.0.1:1389"; exit 2;; esac
fail=0
ok() { echo "PASS $1"; }
bad() { echo "FAIL $1"; fail=1; }
py() { python3 -I -c "$1"; }
ids() { py "import json,sys;d=json.load(open('$IDS'));print($1)"; }

TODAY=$(TZ=Europe/Bucharest date +%F)
TOMORROW=$(py "import datetime as d;print(d.date.fromisoformat('$TODAY')+d.timedelta(days=1))")
MONTH=${TODAY%-*}
BRONZE=$(ids "d['groups']['Intermediari Bronze']"); SILVER=$(ids "d['groups']['Intermediari Silver']"); ANA=$(ids "d['athletes']['Ana Popescu']")

H=(-H "x-portal-secret: $SECRET" -H 'content-type: application/json')
status() { curl -s -o ${TMPDIR:-/tmp}/ct-body.$$ -w '%{http_code}' "$@"; }
json() { py "import json;d=json.load(open('${TMPDIR:-/tmp}/ct-body.$$'));print($1)"; }

code=$(status "${H[@]}" -X POST "$BASE/api/portal/auth/login" -d '{"host":"antrenor","email":"antrenor1@example.invalid","password":"Throwaway-Coach-1","deviceKey":null}')
[ "$code" = 200 ] && ok "login" || { bad "login $code"; exit 1; }
TOKEN=$(json "d['data']['accessToken']")
A=(-H "authorization: Bearer $TOKEN" "${H[@]}")

code=$(status "${H[@]}" "$BASE/api/portal/coach/calendar?month=$MONTH"); [ "$code" = 401 ] && ok "calendar without a session is 401" || bad "calendar no session $code"
code=$(status "${A[@]}" "$BASE/api/portal/coach/calendar?month=$MONTH"); [ "$code" = 200 ] && ok "calendar $MONTH 200 ($(json "sum(len(x['items']) for x in d['data']['days'])") items)" || bad "calendar $code"
[ "$(json "any(i['location']=='Patinoar Test' and i['title']=='Intermediari Bronze' for x in d['data']['days'] for i in x['items'])")" = True ] && ok "calendar items carry the section location" || bad "calendar items have no location"
code=$(status "${A[@]}" "$BASE/api/portal/coach/calendar?month=2026-13"); [ "$code" = 400 ] && ok "calendar bad month 400" || bad "calendar bad month $code"

code=$(status "${A[@]}" "$BASE/api/portal/coach/groups/$BRONZE"); [ "$code" = 200 ] && ok "Bronze page 200" || bad "Bronze page $code"
[ "$(json "d['data']['location']")" = "Patinoar Test" ] && ok "Section location read from Strapi (Patinoar Test)" || bad "group location $(json "d['data']['location']")"
[ "$(json "[m['name'] for m in d['data']['members']]")" = "['Ana Popescu']" ] || echo "note: Bronze members $(json "[m['name'] for m in d['data']['members']]")"

code=$(status "${A[@]}" "$BASE/api/portal/coach/athletes/$ANA"); [ "$code" = 200 ] && ok "Ana card 200" || bad "Ana card $code"
[ "$(json "d['data']['competitions']")" = "{'available': False}" ] && ok "skateResultsSlug read (slug present, null source gives available false)" || bad "card competitions $(json "d['data']['competitions']")"
[ "$(json "d['data']['sectionName']")" = "Școala de Patinaj - AFI Cotroceni" ] && ok "card section name" || bad "card section $(json "d['data']['sectionName']")"

code=$(status "${A[@]}" -X POST "$BASE/api/portal/coach/groups/$BRONZE/members/$ANA/move" -d "{\"toGroupId\":\"$SILVER\",\"from\":\"$TOMORROW\"}")
[ "$code" = 200 ] && ok "move Ana to Silver from $TOMORROW" || bad "move $code $(cat ${TMPDIR:-/tmp}/ct-body.$$)"
code=$(status "${A[@]}" "$BASE/api/portal/coach/groups/$BRONZE")
[ "$(json "[(m['name'], m['leavesOn']) for m in d['data']['members'] if m['name']=='Ana Popescu']")" = "[('Ana Popescu', '$TOMORROW')]" ] && ok "Bronze still lists Ana, leavesOn $TOMORROW" || bad "leavesOn $(json "[(m['name'], m['leavesOn']) for m in d['data']['members']]")"

code=$(status "${A[@]}" "$BASE/api/portal/coach/history?month=$MONTH")
[ "$code" = 200 ] && [ "$(json "all('done' in r for r in d['data']['rows'])")" = True ] && ok "history 200, done on every row ($(json "len(d['data']['rows'])") rows, $(json "sum(1 for r in d['data']['rows'] if not r['done'])") not done)" || bad "history $code"

code=$(status "${A[@]}" "$BASE/api/portal/coach/competitions?scope=mine")
[ "$code" = 200 ] && [ "$(json "d['data']")" = "{'available': False}" ] && ok "competitions mine 200 available false" || bad "competitions $code $(cat ${TMPDIR:-/tmp}/ct-body.$$)"
code=$(status "${A[@]}" "$BASE/api/portal/coach/competitions?scope=x"); [ "$code" = 400 ] && ok "competitions bad scope 400" || bad "competitions bad scope $code"

rm -f ${TMPDIR:-/tmp}/ct-body.$$
[ "$fail" = 0 ] && echo "ALL PASS" || echo "SOME FAILED"
exit $fail
