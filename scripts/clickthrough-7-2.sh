#!/usr/bin/env bash
# Click-through of phase 7-2 (sportiv routes) against a THROWAWAY Strapi (fixtures phase4, phase5, phase6 and phase7 loaded).
# Usage: IDS_FILE=/path/ids.json BASE=http://127.0.0.1:1412 bash scripts/clickthrough-7-2.sh
# Run from the repo root with the throwaway env loaded (DATABASE_*, AUTH_*): the last step reads the schedule-mail muted list through the real group store.
# Behaviour only: every step prints PASS or FAIL.
set -u
BASE="${BASE:-http://127.0.0.1:1412}"
SECRET="${PORTAL_BFF_SECRET:-test-bff-secret-000000000000000000}"
IDS="${IDS_FILE:?set IDS_FILE}"
case "$BASE" in http://127.0.0.1:1412*) ;; *) echo "refused: BASE must be the throwaway Strapi on 127.0.0.1:1412"; exit 2;; esac
fail=0
ok() { echo "PASS $1"; }
bad() { echo "FAIL $1"; fail=1; }
py() { python3 -I -c "$1"; }
ids() { py "import json;d=json.load(open('$IDS'));print($1)"; }
BODY="${TMPDIR:-/tmp}/ct-72-body.$$"
HEADERS="${TMPDIR:-/tmp}/ct-72-head.$$"
status() { curl -s -o "$BODY" -D "$HEADERS" -w '%{http_code}' "$@"; }
json() { py "import json;d=json.load(open('$BODY'));print($1)"; }
# expect "label" status-code want-code [field-expression want-value]
expect() {
  if [ "$2" != "$3" ]; then bad "$1 (status $2, want $3; $(head -c 250 "$BODY"))"; return; fi
  if [ $# -ge 5 ] && [ "$(json "$4")" != "$5" ]; then bad "$1 (got $(json "$4"), want $5)"; return; fi
  ok "$1"
}
H=(-H "x-portal-secret: $SECRET" -H 'content-type: application/json')
login() { status "${H[@]}" -X POST "$BASE/api/portal/auth/login" -d "{\"host\":\"$1\",\"email\":\"$2\",\"password\":\"$3\",\"deviceKey\":null}"; }

ANA=$(ids "d['athletes']['Ana Ionescu']"); MATEI=$(ids "d['athletes']['Matei Ionescu']"); IOANA=$(ids "d['athletes']['Ioana Marin']")
code=$(status -H "x-portal-secret: $SECRET" "$BASE/api/portal/sportiv/me"); expect "no bearer is refused" "$code" 401
code=$(login sportiv parinte1@example.invalid Throwaway-Parent-1); expect "parinte1 on sportiv" "$code" 200 "'accessToken' in d['data']" True
A=(-H "x-portal-secret: $SECRET" -H "authorization: Bearer $(json "d['data']['accessToken']")" -H 'content-type: application/json')
S="$BASE/api/portal/sportiv"
code=$(status "${A[@]}" "$S/me"); expect "me" "$code" 200 "d['data']['email']" parinte1@example.invalid
code=$(status "${A[@]}" "$S/athletes"); expect "athletes list Ana and Matei" "$code" 200 "sorted(a['name'] for a in d['data']['athletes'])" "['Ana Ionescu', 'Matei Ionescu']"
code=$(status "${A[@]}" "$S/athletes/$ANA/home"); expect "Ana home total 26" "$code" 200 "d['data']['presences']['total']" 26
expect "Ana home abonament next 5" "$code" 200 "d['data']['abonament']['next']" 5
code=$(status "${A[@]}" "$S/athletes/$ANA/profile"); expect "Ana profile" "$code" 200 "d['data']['name']" "Ana Ionescu"
code=$(status "${A[@]}" "$S/athletes/$ANA/history?page=2"); expect "history page 2 has 6 rows" "$code" 200 "len(d['data']['rows'])" 6
MONTH=$(TZ=Europe/Bucharest date +%Y-%m)
code=$(status "${A[@]}" "$S/athletes/$ANA/calendar?month=$MONTH"); expect "calendar this month" "$code" 200 "d['data']['month']" "$MONTH"
code=$(status "${A[@]}" "$S/athletes/$ANA/calendar.ics"); [ "$code" = 200 ] && ok "calendar.ics answers 200" || bad "calendar.ics status $code"
head -c 15 "$BODY" | grep -q '^BEGIN:VCALENDAR' && ok "calendar.ics starts BEGIN:VCALENDAR" || bad "calendar.ics start ($(head -c 60 "$BODY"))"
grep -qi '^content-type: text/calendar' "$HEADERS" && ok "calendar.ics content type" || bad "calendar.ics content type"
code=$(status "${A[@]}" "$S/athletes/$ANA/path"); expect "path badge antrenamente bronze" "$code" 200 "[b['tier'] for b in d['data']['badges'] if b['key']=='antrenamente'][0]" bronze
code=$(status "${A[@]}" "$S/athletes/$ANA/money"); expect "money" "$code" 200 "'left' in d['data']" True
code=$(status "${A[@]}" "$S/athletes/$ANA/payments"); expect "payments" "$code" 200 "d['data']['page']" 1
code=$(status "${A[@]}" "$S/athletes/$ANA/subscriptions"); expect "subscriptions" "$code" 200 "'active' in d['data']" True
code=$(status "${A[@]}" "$S/athletes/$ANA/documents/acord")
if [ "$code" = 200 ] && head -c 4 "$BODY" | grep -q '^%PDF'; then ok "documents/acord starts %PDF"; else bad "documents/acord (status $code; $(head -c 200 "$BODY"))"; fi
code=$(status "${A[@]}" "$S/athletes/$IOANA/home"); expect "Ioana is not held by parinte1" "$code" 403 "d['error']['message']" "Nu mai ai acces la acest sportiv."

# adult athlete: competitions with the null source
code=$(login sportiv sportiv18@example.invalid Throwaway-Adult-18); expect "sportiv18 on sportiv" "$code" 200 "'accessToken' in d['data']" True
B=(-H "x-portal-secret: $SECRET" -H "authorization: Bearer $(json "d['data']['accessToken']")" -H 'content-type: application/json')
code=$(status "${B[@]}" "$S/athletes/$IOANA/competitions"); expect "competitions of Ioana (null source: 404, merged with 7-3: available false)" "$code" 404

# schedule-mail switch (start unmuted so the script can run twice): parinte1 mutes, then the real group store reports Ana and Matei as muted
status "${A[@]}" -X PUT "$S/me/notifications" -d '{"schedule":true}' > /dev/null
code=$(status "${A[@]}" -X PUT "$S/me/notifications" -d '{"schedule":false}'); expect "parinte1 mutes the schedule mail" "$code" 200 "d['data']['toast']" "Salvat."
code=$(status "${A[@]}" "$S/me"); expect "me shows notifySchedule false" "$code" 200 "d['data']['notifySchedule']" False
MUTED=$(IDS_FILE="$IDS" node -e "
const { createStrapi, compileStrapi } = require('@strapi/strapi');
(async () => {
  const app = await createStrapi(await compileStrapi()).load();
  const { strapiGroupStore } = require(process.cwd() + '/dist/src/club/groups/strapi-store.js');
  const muted = await strapiGroupStore(app).scheduleMutedAthletes();
  console.log('MUTED=' + JSON.stringify(muted));
  await app.destroy();
  process.exit(0);
})().catch((e) => { console.error(String(e)); console.log('MUTED=ERROR'); process.exit(1); });
" 2>/dev/null | grep '^MUTED=' | tail -1); MUTED="${MUTED#MUTED=}"
if [ "$MUTED" = ERROR ] || [ -z "$MUTED" ]; then bad "scheduleMutedAthletes ran against the real DB"; else
  ok "scheduleMutedAthletes ran against the real DB: $MUTED"
  py "import json;m=json.loads('$MUTED');d=json.load(open('$IDS'))['athletes'];import sys;sys.exit(0 if d['Ana Ionescu'] in m and d['Matei Ionescu'] in m and d['Radu Pop'] not in m else 1)" && ok "muted list holds Ana and Matei, not Radu (other holder)" || bad "muted list content ($MUTED)"
fi

rm -f "$BODY" "$HEADERS"
[ "$fail" = 0 ] && echo "ALL PASS" || echo "SOME FAILED"
exit $fail
