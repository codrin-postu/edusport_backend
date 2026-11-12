#!/usr/bin/env bash
# Click-through of phase 7-1 (athlete access and accounts) against a THROWAWAY Strapi (fixtures phase4, phase5, phase6 and phase7 loaded).
# Usage: IDS_FILE=/path/ids.json BASE=http://127.0.0.1:1411 bash scripts/clickthrough-7-1.sh
# Needs the ids file written by phase7-shape.js. Behaviour only: every step prints PASS or FAIL.
set -u
BASE="${BASE:-http://127.0.0.1:1411}"
SECRET="${PORTAL_BFF_SECRET:-test-bff-secret-000000000000000000}"
IDS="${IDS_FILE:?set IDS_FILE}"
case "$BASE" in http://127.0.0.1:1411*) ;; *) echo "refused: BASE must be the throwaway Strapi on 127.0.0.1:1411"; exit 2;; esac
fail=0
ok() { echo "PASS $1"; }
bad() { echo "FAIL $1"; fail=1; }
py() { python3 -I -c "$1"; }
ids() { py "import json;d=json.load(open('$IDS'));print($1)"; }
BODY="${TMPDIR:-/tmp}/ct-71-body.$$"
status() { curl -s -o "$BODY" -w '%{http_code}' "$@"; }
json() { py "import json;d=json.load(open('$BODY'));print($1)"; }
# expect "label" status-code want-code [field-expression want-value]
expect() {
  if [ "$2" != "$3" ]; then bad "$1 (status $2, want $3; $(head -c 250 "$BODY"))"; return; fi
  if [ $# -ge 5 ] && [ "$(json "$4")" != "$5" ]; then bad "$1 (got $(json "$4"), want $5)"; return; fi
  ok "$1"
}
H=(-H "x-portal-secret: $SECRET" -H 'content-type: application/json')
login() { status "${H[@]}" -X POST "$BASE/api/portal/auth/login" -d "{\"host\":\"$1\",\"email\":\"$2\",\"password\":\"$3\",\"deviceKey\":null}"; }

# 1 holder of athletes: sportiv yes, antrenor no
code=$(login sportiv parinte1@example.invalid Throwaway-Parent-1); expect "parinte1 on sportiv" "$code" 200 "'accessToken' in d['data']" True
SP_TOKEN=$(json "d['data']['accessToken']")
code=$(login antrenor parinte1@example.invalid Throwaway-Parent-1); expect "parinte1 on antrenor is refused" "$code" 401
# 2 coach who also holds Radu: both hosts
code=$(login antrenor antrenor1@example.invalid Throwaway-Coach-1); expect "antrenor1 on antrenor" "$code" 200 "'accessToken' in d['data']" True
code=$(login sportiv antrenor1@example.invalid Throwaway-Coach-1); expect "antrenor1 on sportiv" "$code" 200 "'accessToken' in d['data']" True
CO_SP_REFRESH=$(json "d['data']['refreshToken']")
code=$(login antrenor antrenor1@example.invalid Throwaway-Coach-1); CO_AN_REFRESH=$(json "d['data']['refreshToken']")
# 4 own security on a sportiv session
code=$(status -H "x-portal-secret: $SECRET" -H "authorization: Bearer $SP_TOKEN" "$BASE/api/portal/me/security"); expect "sportiv session reads /me/security" "$code" 200
# 5 admin
ORIGIN="http://localhost:1411"
code=$(status -H 'content-type: application/json' -H "origin: $ORIGIN" -X POST "$BASE/api/admin-auth/login" -d '{"email":"admin7@example.invalid","password":"Throwaway-Admin-7"}')
expect "admin login" "$code" 200 "'accessToken' in d['data']" True
A=(-H "authorization: Bearer $(json "d['data']['accessToken']")" -H "origin: $ORIGIN" -H 'content-type: application/json')
ELENA=$(ids "d['athletes']['Elena Stan']"); MATEI=$(ids "d['athletes']['Matei Ionescu']")
code=$(status "${A[@]}" -X POST "$BASE/api/club/athletes/$ELENA/access/invite"); expect "invite Elena Stan (nou) is refused" "$code" 409 "d['error']['message']" "Confirmă sportivul întâi."
code=$(status "${A[@]}" -X POST "$BASE/api/club/athletes/$MATEI/access/remove"); expect "remove Matei's access" "$code" 200 "d['data']['access']['state']" none
code=$(status "${A[@]}" -X POST "$BASE/api/club/athletes/$MATEI/access/invite"); expect "invite Matei again" "$code" 200 "d['data']['toast']" "Acces adăugat."
# 6 disable antrenor1 as a coach: sportiv refresh stays, antrenor refresh ends
TM=$(ids "d['portal']['antrenor1']['teamMember']")
code=$(status "${A[@]}" "$BASE/api/club/team-members/$TM/account"); expect "read antrenor1 account" "$code" 200
ACC=$(json "d['data']['accountId']")
code=$(status "${A[@]}" -X POST "$BASE/api/club/portal-accounts/$ACC/disable"); expect "disable antrenor1 as coach" "$code" 200
code=$(status "${H[@]}" -X POST "$BASE/api/portal/auth/refresh" -d "{\"refreshToken\":\"$CO_SP_REFRESH\"}"); expect "antrenor1 sportiv refresh still works" "$code" 200
code=$(status "${H[@]}" -X POST "$BASE/api/portal/auth/refresh" -d "{\"refreshToken\":\"$CO_AN_REFRESH\"}"); expect "antrenor1 antrenor refresh is refused" "$code" 401

# 7 the e-mail of a holder account changes: its athletes and access rows follow, no second account appears
ANA=$(ids "d['athletes']['Ana Ionescu']"); P1ACC=$(ids "d['portal']['parinte1']['account']"); NEWMAIL="parinte1-new@example.invalid"
code=$(status "${A[@]}" -X POST "$BASE/api/club/portal-accounts/$P1ACC/email" -d "{\"email\":\"$NEWMAIL\"}"); expect "change parinte1 account e-mail" "$code" 200
code=$(status "${A[@]}" "$BASE/api/club/athletes/$ANA"); expect "Ana shows the new parent e-mail" "$code" 200 "d['data']['fields']['email']" "$NEWMAIL"
code=$(status "${A[@]}" "$BASE/api/club/athletes/$ANA/access"); expect "Ana access block shows the new address" "$code" 200 "d['data']['email'] + ' ' + d['data']['state']" "$NEWMAIL active"
code=$(status "${A[@]}" "$BASE/api/club/athletes/$MATEI/access"); expect "Matei access block shows the new address" "$code" 200 "d['data']['email'] + ' ' + d['data']['state']" "$NEWMAIL active"
code=$(login sportiv "$NEWMAIL" Throwaway-Parent-1); expect "the same account signs in with the new address" "$code" 200 "'accessToken' in d['data']" True
code=$(login sportiv parinte1@example.invalid Throwaway-Parent-1); expect "the old address no longer signs in (no second account)" "$code" 401

rm -f "$BODY"
[ "$fail" = 0 ] && echo "ALL PASS" || echo "SOME FAILED"
exit $fail
