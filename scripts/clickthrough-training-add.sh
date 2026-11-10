#!/usr/bin/env bash
# Click-through of "Antrenament nou" against a THROWAWAY Strapi (fixtures phase4, phase5, phase6, coach-additions, training-add loaded).
# Usage: IDS_FILE=/path/ids.json BASE=http://127.0.0.1:1393 bash scripts/clickthrough-training-add.sh
# Every step checks the status (any non-2xx fails the script) and one field of the answer.
set -u
BASE="${BASE:-http://127.0.0.1:1393}"
SECRET="${PORTAL_BFF_SECRET:-test-bff-secret-000000000000000000}"
IDS="${IDS_FILE:?set IDS_FILE}"
case "$BASE" in http://127.0.0.1:1393*) ;; *) echo "refused: BASE must be the throwaway Strapi on 127.0.0.1:1393"; exit 2;; esac
fail=0
ok() { echo "PASS $1"; }
bad() { echo "FAIL $1"; fail=1; }
py() { python3 -I -c "$1"; }
ids() { py "import json,sys;d=json.load(open('$IDS'));print($1)"; }
BODY="${TMPDIR:-/tmp}/ct-ta-body.$$"
status() { curl -s -o "$BODY" -w '%{http_code}' "$@"; }
json() { py "import json;d=json.load(open('$BODY'));print($1)"; }
day() { py "import datetime as d;print(d.date.fromisoformat('$1')+d.timedelta(days=$2))"; }
# first date on or after $1 that falls on weekday $2 (0 = Monday)
next() { py "import datetime as d;x=d.date.fromisoformat('$1')
while x.weekday()!=$2: x+=d.timedelta(days=1)
print(x)"; }
# step "label" expected-field-expression expected-value status-code
check() { [ "$4" -ge 200 ] && [ "$4" -lt 300 ] && [ "$(json "$2")" = "$3" ] && ok "$1" || bad "$1 (status $4, got $(json "$2"), want $3; $(head -c 300 "$BODY"))"; }

TODAY=$(TZ=Europe/Bucharest date +%F)
GROUP=$(ids "d['groups']['Club Marți Joi']"); ATHLETE=$(ids "d['athletes']['Mara Lecție']"); TM=$(ids "d['portal']['antrenor1']['teamMember']")
H=(-H "x-portal-secret: $SECRET" -H 'content-type: application/json')

code=$(status "${H[@]}" -X POST "$BASE/api/portal/auth/login" -d '{"host":"antrenor","email":"antrenor1@example.invalid","password":"Throwaway-Coach-1","deviceKey":null}')
[ "$code" = 200 ] && ok "login" || { bad "login $code"; exit 1; }
TOKEN=$(json "d['data']['accessToken']")
A=(-H "authorization: Bearer $TOKEN" "${H[@]}")
rules() { code=$(status "${A[@]}" "$BASE/api/portal/coach/groups/$GROUP/program?month=${1%-*}"); }

# 1 weekly Wednesday series with "Până la"
FROM=$(next "$(day "$TODAY" 7)" 2); UNTIL=$(day "$FROM" 28)
code=$(status "${A[@]}" -X POST "$BASE/api/portal/coach/groups/$GROUP/program" -d "{\"repeat\":true,\"freq\":\"weekly\",\"days\":[\"wed\"],\"startTime\":\"16:00\",\"durationMin\":60,\"from\":\"$FROM\",\"until\":\"$UNTIL\"}")
check "add weekly Wednesday series from $FROM until $UNTIL" "'eventId' in d['data'] and d['data']['date'] is None" "True" "$code"
# 2 rules
rules "$FROM"
check "rules list holds the Wednesday rule ending $UNTIL" "[r['to'] for r in d['data']['rules'] if r['day']=='wed']" "['$UNTIL']" "$code"
[ "$(json "[r['untilSeasonEnd'] for r in d['data']['rules'] if r['day']=='wed']")" = "[False]" ] && ok "Wednesday rule is not until season end" || bad "untilSeasonEnd"
# 3 end Tuesday from next week
TUE=$(json "[r['eventId'] for r in d['data']['rules'] if r['day']=='tue'][0]")
CUT=$(day "$TODAY" 7)
code=$(status "${A[@]}" -X POST "$BASE/api/portal/coach/program/$TUE/end" -d "{\"from\":\"$CUT\",\"day\":\"tue\"}")
check "end Tuesday from $CUT" "'eventId' in d['data']" "True" "$code"
rules "$CUT"
check "Tuesday rule now ends the day before $CUT" "[r['to'] for r in d['data']['rules'] if r['day']=='tue']" "['$(day "$CUT" -1)']" "$code"
# 4 remove one Thursday, keep it back
THU=$(json "[r['eventId'] for r in d['data']['rules'] if r['day']=='thu'][0]")
DATE=$(next "$(day "$TODAY" 1)" 3)
code=$(status "${A[@]}" -X PUT "$BASE/api/portal/coach/program/$THU/dates/$DATE" -d '{"mode":"remove"}')
check "remove Thursday $DATE" "d['data']['mode']" "remove" "$code"
code=$(status "${A[@]}" -X PUT "$BASE/api/portal/coach/program/$THU/dates/$DATE" -d '{"mode":"keep"}')
check "keep Thursday $DATE back" "d['data']['mode']" "keep" "$code"
# 5 one-off class
ONE=$(day "$TODAY" 3)
code=$(status "${A[@]}" -X POST "$BASE/api/portal/coach/groups/$GROUP/program" -d "{\"repeat\":false,\"date\":\"$ONE\",\"startTime\":\"15:00\",\"durationMin\":60}")
check "one-off class on $ONE" "d['data']['date']" "$ONE" "$code"
# 6 eight-lesson series
MON=$(next "$(day "$TODAY" 1)" 0); LAST=$(day "$MON" 49)
code=$(status "${A[@]}" -X POST "$BASE/api/portal/coach/lessons" -d "{\"athleteId\":\"$ATHLETE\",\"date\":\"$MON\",\"startTime\":\"18:00\",\"durationMin\":45,\"coachIds\":[\"$TM\"],\"repeat\":{\"freq\":\"weekly\",\"days\":[\"mon\"],\"until\":\"$LAST\"}}")
check "create 8 weekly lessons from $MON" "d['data']['count']" "8" "$code"
LESSON=$(json "d['data']['lessonId']")
# 7 read the lesson
code=$(status "${A[@]}" "$BASE/api/portal/coach/lessons/$LESSON")
check "lesson page carries its series" "d['data']['series']['freq']+str(d['data']['planEditable'])" "weeklyTrue" "$code"
# 8 edit following
code=$(status "${A[@]}" -X PUT "$BASE/api/portal/coach/lessons/$LESSON/plan" -d "{\"date\":\"$MON\",\"startTime\":\"18:30\",\"durationMin\":45,\"coachIds\":[\"$TM\"],\"scope\":\"following\",\"repeat\":{\"freq\":\"weekly\",\"days\":[\"mon\"],\"until\":\"$LAST\"}}")
check "edit this and the following lessons" "d['data']['count']" "8" "$code"
NEWID=$(json "d['data']['lessonId']")
code=$(status "${A[@]}" "$BASE/api/portal/coach/lessons/$NEWID")
check "edited lesson starts at 18:30" "d['data']['startTime'][:5]" "18:30" "$code"
# 9 delete following
code=$(status "${A[@]}" -X DELETE "$BASE/api/portal/coach/lessons/$NEWID?scope=following")
check "delete this and the following lessons" "d['data']['count']" "8" "$code"
code=$(status "${A[@]}" "$BASE/api/portal/coach/lessons/$NEWID")
[ "$code" = 404 ] && ok "deleted lesson is gone (404)" || bad "deleted lesson still readable ($code)"

rm -f "$BODY"
[ "$fail" = 0 ] && echo "ALL PASS" || echo "SOME FAILED"
exit $fail
