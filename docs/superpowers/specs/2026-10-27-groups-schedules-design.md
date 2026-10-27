# Phase 4: groups and schedules (design)

Status: v1.1, approved by the user (2026-10-27): W1-W21, parent e-mail texts, new season.

Parent docs: `docs/architecture/10-spec.md` 3.5 Groups and 3.6 Schedules (3.7 lists what stays for phase 5), `13-roadmap.md` (phase 4), diagrams `03a`, `03b`, `02f`. Builds on `2026-10-26-athletes-registrations-design.md` (P3) and `2026-10-27-personal-data-design.md` (P3C). Production facts: `.superpowers/phase4/research.md` (read-only production read, 2026-10-27).

Precedence: a dated entry in `edusport_frontend/docs/portal/DECISIONS.md` wins over this file and over the parent spec; a later dated entry wins over an earlier one; an approved mockup wins over an older mockup, and a dated decision wins over a mockup [P3 header; DEC 2026-10-26 3b Q31]. Where this file departs from `10-spec.md`, the decision that causes it is cited.

Citation keys:
- `[m4 n]`: DECISIONS 2026-10-27 "phase 4 mockups", item n (1 to 12).
- `[p4 scope]`, `[p4 design]`: DECISIONS 2026-10-27 "phase 4 scope" and "phase 4 design".
- `[DEC 2026-10-27 phase 4 spec review]`: W1-W21 approved, parent e-mail texts approved, new season designed in phase 4, proposed group = last season's main group.
- `[DEC 2026-10-27 phase 4 new season n]`: DECISIONS 2026-10-27 "phase 4 new season", item n (1 to 6).
- `[DEC <date> <id>]`: older DECISIONS entries, by date and screen or id.
- `[mock <file> <state>]`: approved phase 4 mockups in `edusport_frontend/docs/portal/mockups/screens/phase4/` (copy from `gen_phase4.py` and `gen_sezon_nou.py`): grupe-list, grupa-a (chosen), pauze-a (chosen), program-site (A chosen), migrare-grupe, sezon-nou-a (chosen; sezon-nou-b not chosen).
- `[old mock <file>]`: older approved mockups in `mockups/screens/` (move-modal-final, aloca-v2, pending-groups-v1, main-group-v1) and the coach-schedule-app-v3 behaviour in `mockups/coach-mobile.html` / `coach-desktop.html`.
- `[prod]`: the production read in `research.md`. `[code]`: current code, file named.
- `[SPEC x.y]`: `10-spec.md`. `[P3 x.y]`, `[P3C x]`: the phase 3 specs.
- `[W n]`: decided while writing this file, listed in section 15 (W1-W21 approved; later ones for the user to overrule).

Copy convention (as P3): quoted copy is the exact UI text; "->" in quoted copy is the arrow "→" the UI shows; `<name>` marks a value. Romanian, terse, no em dash, no middle dot, straight quotes "..." [DEC 2026-10-27 phase 3 polish 3; DEC 2026-10-26 gaps #1].

## 1. Purpose and success

Groups become the real roster and the real owner of the training schedule. The admin sees every group of a season with its program, coaches and count, places athletes without a group in one click, moves them without losing history, edits each group's program date by date, sets holiday breaks once for all groups, and the website program and calendar come from the same data.

Success:
- Grupe shows the 7 Școala groups and the 2 Club groups with their real program, coaches and distinct totals for the selected season [m4 1; DEC 2026-10-10 user (distinct totals)].
- "Fără grupă" reaches 0 by "Alocă" / "Alocă toți în grupele propuse"; every allocation, move, addition and removal is in Istoric and can be undone from the toast [DEC 2026-10-10 pending-groups-v1 Q1 A; aloca-v2 (a)].
- A date cancelled or moved on a group's Program shows the same way in the admin, on the website calendar (when the group is public) and, if ticked, in an e-mail to that group's parents [DEC 2026-10-19 notif-q1-emails; m4 9].
- /cursuri/program shows the same notebook as today, built from the Școala groups, and the "Serii de cursuri" editor is gone [m4 7, 8; p4 design].
- The production migration runs dry first, applies idempotently, and leaves the website looking as it does today [DEC 2026-10-19 build-q3-final-review (1)].
- "Începe sezonul <next>" on Sezoane makes the next season current and prepares its groups in one window, with a preview and an 8 s undo; children not copied wait in "Fără grupă" with last season's group proposed [DEC 2026-10-27 phase 4 new season 1-6].

## 2. Scope

In scope [p4 scope; p4 design]:
- Data: Group "Program public", calendar-event group link used for every group schedule, per-date exceptions with reason, opt-in parent e-mail, breaks (Pauze), history lines (3).
- Migration of production data (4).
- Admin: Grupe list, "Fără grupă", group page with tabs Sportivi / Program / Istoric, move window, "Adaugă și în grupă", "Scoate din grupă", "+ Grupă nouă", Pauze section in "Calendar și serii", removal of "Serii de cursuri" (5, 6).
- Routes and public reads (8); website /cursuri/program notebook and calendar (9).
- New season: "Începe sezonul <next>" on Sezoane (makes the season current, copies members and programs per group), and the later per-group "Copiază sportivii / programul din <sezon>" (10) [DEC 2026-10-27 phase 4 spec review; DEC 2026-10-27 phase 4 new season 1-6].

Out of scope:
- Coaches editing their Club groups' schedules: phase 6, with coach login [p4 scope; DEC 2026-10-19 user (Skating School schedule admin-only)].
- Attendance, the group tab "Prezență", sessions, "În afara programului", subscriptions and the abonament bar in the move window: phase 5 [m4 2; SPEC 3.7, 3.8]. In phase 4 no athlete has a subscription, so the move window's abonament section is always hidden, as decided for "no abonament" [DEC 2026-10-10 user (move-modal-final)].
- Athlete record tab "Grupe și abonament": phase 5 with subscriptions; in phase 4 the record header line and the Sportivi "Grupa" column read the real memberships [P3 6.1, 5].
- Proposed groups from the registration answers: Open 1.
- Membri echipă "Predă la" text and the Echipa page: unchanged [W19].

## 3. Data model changes

### 3.1 Group (`api::group.group`, table `club_groups`)
- New `programPublic`: boolean, default `true`. Label "Program public", hint "Programul apare în calendarul de pe site." [m4 9; p4 design; hint from old mock group-create]. Off: the group's events are left out of the public occurrences, the website calendar and the notebook; the admin still sees them (8.2). Code reads `programPublic !== false`, so rows written before the column existed count as public [W8].
- Existing fields used as they are: `name` (string, required), `active` (boolean), `order` (integer, list and notebook order), `section` (manyToOne section), `priceList` (manyToOne price-list), `coaches` (manyToMany team-member) [code schema.json].
- `name` unique within its section, ignoring case and diacritics (the `nameKey` rule of `src/club/migrate/names.ts`), checked by the service; error "Există deja o grupă cu acest nume." [W17].
- Groups are not per season: they carry over; memberships and schedule series are per season [DEC 2026-10-18 states-v2; SPEC 3.4].

### 3.2 Group membership (`api::group-membership.group-membership`)
- Fields unchanged: `athlete`, `group`, `season`, `isMain` (boolean), `from` (date), `to` (date, null while current) [code].
- Current membership = `to` is null. Every rule and count below reads current memberships of one season.
- Exactly one current main membership per athlete per season whenever the athlete has any current membership [SPEC 2 rule 2; DEC 2026-10-10 main-group-v1 B]. `checkMainGroup` in `src/club/group-membership.ts` is changed to look at current rows only (today it counts ended rows too) [code].
- `from` = today, or the season start when the season has not started (the existing `membershipFrom` of `src/club/confirm/season.ts`) [DEC 2026-10-26 gaps #29].
- Ending a membership sets `to` = yesterday, so the row stays as history; a membership whose `from` is today or later is deleted instead (it never applied), its history lines stay [W4].

### 3.3 Calendar event (`api::calendar-event.calendar-event`)
- `group` (manyToOne group, exists, unused today) links an event to ONE group; a group has 0..n events: weekly series and one-off classes. Competitions, holidays and school events stay unlinked [DEC 2026-10-11 class-model-v2 (1); DEC 2026-10-11 user (extra class = one-time event); code].
- Group events written by phase 4: `type` = `scoala` for a school-section group, `curs` for a Club group; `title` = the group name at creation; `label` empty [W9].
- Recurrence (`calendar.recurrence`, unchanged fields): `freq` `weekly | biweekly | monthly` for "Se repetă", `none` + `singleDate` for one class; weekday booleans; `weekOfMonth` for monthly; `startTime`; `endTime` = start + duration (times are entered as start + duration, lists show the start only) [DEC 2026-10-19 coach-schedule-app-v3; DEC 2026-10-19 "Cât de des"]; `seasonStart` = "Se aplică din"; `seasonEnd` = the last day of the season that contains "Se aplică din" (the existing validator requires both bounds and a span of at most 366 days) [code validate-recurrence.ts; W10].
- Duration is not stored on its own: it is `endTime - startTime`. No overnight group classes (`endsNextDay` false).

### 3.4 Per-date exception (`calendar.exception` component)
- New field `reason`: string, max 120 characters, optional ("Motiv", hint "Opțional") [mock grupa-a A7].
- Per date "Ține / Anulează / Mută" [DEC 2026-10-19 coach-schedule-app-v3; mock grupa-a A7, A8]:
  - Ține: removes the exception of that date (the series date holds again);
  - Anulează: `kind` = `anulat`, `reason`;
  - Mută: `kind` = `override`, `newDate`, `newStartTime`, `newEndTime` = new start + the series duration, `reason` [W12].
- Existing kinds `cancel` / `liber` stay readable for old events; new group writes use only `anulat` and `override` [code expand.ts].
- The occurrence `note` becomes `reason ?? newTitle` (old events keep their `newTitle` notes) [code expand.ts; W12].

### 3.5 Breaks (`api::calendar-blackout.calendar-blackout`, "Pauze")
- Fields unchanged: `label` (string, required, shown as "Nume"), `startDate` and `endDate` (date, required, "De la" / "Până la") [code; mock pauze-a].
- Effect: every date of a group event inside a break is cancelled, single classes included; competitions, holidays and other unlinked events are not affected (old unlinked `scoala` events still are) [mock pauze-a hint "Nicio ședință a grupelor în aceste zile."; W13]. Today a break cancels every event; that changes.
- A break-cancelled occurrence carries the break's label in `note` (today it carries none) [mock pauze-a effect state].
- A Mută (override) on a break date still holds, as today [code expand.ts].

### 3.6 E-mail job (`api::email-job.email-job`)
- `kind` enum gains `schedule-change` [DEC 2026-10-19 notif-q1-emails].
- New `group`: relation manyToOne group, set for `schedule-change` jobs.
- New `payload`: json `{ groupName: string, date: string (YYYY-MM-DD), startTime: string (HH:mm), mode: "cancel" | "move", newDate: string | null, newStartTime: string | null (HH:mm), nextDate: string | null, nextStartTime: string | null, reason: string | null }`; `startTime` is the time of the changed date, `nextDate` / `nextStartTime` the group's next class for the cancel text (6.5).
- New `changeKey`: string, the id of the schedule change (the history entry documentId), so undo can cancel every job of one change.
- New `notBefore`: datetime; the first attempt and the cron retry skip a job until then.
- `registration` stays optional (null for `schedule-change`). The existing `cancelled` status is used for undo [code].

### 3.7 History (`history-entry`, unchanged schema)
Every write in this phase writes a history entry (who, what, when, old and new) [SPEC 2 rule 9]. New subject types `group` and `calendar-blackout`; lines (`<nume>` = athlete full name, dates as "14 noiembrie", program text as in 6.2):
- Group: "Grupă creată." / field changes `<Câmp>: "<vechi>" -> "<nou>"` for "Nume", "Listă de prețuri", "Antrenori", "Program public" [P3 1.6 pattern].
- Group roster [mock grupa-a A10, neutral forms W1]: "Sportiv adăugat: <nume>." / "Sportiv alocat: <nume>." / "Mutat în <grupă>: <nume>. Grupa principală schimbată: <veche> -> <nouă>" (second sentence only when the main group changed) / "Mutat din <grupă>: <nume>." (on the group left) / "Sportiv scos: <nume>."
- Group program [mock grupa-a A10]: "Program adăugat: Sâ și Du, 11:00, 50 min, din 4 oct 2026." / "Program schimbat din <data>: <vechi> -> <nou>." / "Program șters din <data>: <program>." / "Ședință unică adăugată: <zi>, <data>, <ora>, <durată>." / "Ședința din 14 noiembrie anulată: Competiție la Brașov. Părinții anunțați pe e-mail." (reason and the last sentence only when present) / "Ședința din <data> mutată: <data nouă>, <ora>." / "Ședința din <data> se ține."
- Athlete (existing P3 lines reused): "Adăugat în grupa <grupă>", "Grupa principală schimbată: <veche> -> <nouă>" [P3 1.6; DEC 2026-10-27 phase 3 polish 10]; new: "Mutat din <din> în <în>", "Scos din grupa <grupă>", "Reactivat" (P3 line, when adding an inactive athlete) [DEC 2026-10-18 states-v2].
- Break: "Pauză adăugată: <nume>, <de la> - <până la>." / field changes / "Pauză ștearsă: <nume>."
- New season and per-group copies: lines of 10.8 (subject types `season`, `group`, `athlete`).
- Undo: "Anulat: <the undone line>" on every subject the action wrote to [W15; P3 pattern "Confirmare anulată"].
- Migration rows: actor "migrare", shown as "Migrare" [DEC 2026-10-26 3b Q23].

## 4. Migration (production)

Facts [prod]: `programs.schedule_groups` = 09:00-09:50 Avansați Gold; 10:00-10:50 "Primii Paşi" (cedilla), Intermediari Silver, Avansați Silver; 11:00-11:50 Începători, Intermediari Bronze, Avansați Bronze. `club_groups` already holds the 9 real groups. No calendar event is linked to a group. Events: "Antrenament: Avansati" (curs), "Titlu" (curs), "Școala de patinaj" x2 (scoala, the weekend series), competitions, events, "Vacanta scolara" x3 (vacanta). Blackout "Vacanța de iarnă" 2026-01-14..16. `team_members.groups`: Andreea Pascu ["Profesionisti","Avansati"], Virgil Pascu ["Intermediari Silver","Intermediari Bronze"].

Script `scripts/migrate-groups-schedules.js --step=<step> [--apply]`, same shape as `migrate-athletes-registrations.js`: dry run by default, `--apply` writes, one step per run, idempotent and re-runnable, no big transaction, planners are pure functions in `src/club/groups/migrate/*` read from `dist`, actor "migrare", every write logged and written to history [DEC 2026-10-19 build-q3-final-review (1); P3 11; code].

Steps, in order:
1. `group-names`: any group name with cedilla letters (ş, ţ, Ş, Ţ) is rewritten with comma letters (ș, ț, Ș, Ț); "Primii Paşi" becomes "Primii Pași" [DEC 2026-10-19 data-q1-groups; SPEC 4]. Prints every rename.
2. `coaches`: for each team member, each text in `groups` is matched by `nameKey` to a group; the member is added to that group's `coaches` when missing. "Profesionisti" -> Club Profesioniști, "Avansati" -> Club Avansați (exact key match, so never a Școala "Avansați <nivel>"), "Intermediari Silver" / "Intermediari Bronze" -> the Școala groups [DEC 2026-10-19 data-q1-groups; m4 11; prod]. Unmatched texts are listed and skipped. `team_members.groups` is not changed [W19].
3. `program-public`: every group without a value gets `programPublic` = true, so the website shows what it shows today [W8].
4. `school-series`: one weekly series per Școala group from `program.scheduleGroups` [m4 7; p4 design]:
   - each `courses` text is matched by `nameKey` to a Școala group ("Primii Paşi" -> Primii Pași); unmatched texts are listed and skipped [mock migrare-grupe];
   - start = the first time of `timeSlot`, duration 50 min, so end = start + 50 min [prod; DEC 2026-10-03 scoala-v1 (50 min)];
   - days = the weekdays of the unlinked `scoala` event(s) whose window overlaps the current season (Sat and Sun in production), Sat + Sun when none [prod; W14];
   - window = from the later of the current season start and that event's `seasonStart`, to the season's last day;
   - the Liber / Anulat dates of those old `scoala` events inside the window are copied as exceptions to every new series (`liber` stays `liber`, `anulat` stays `anulat`, the note goes to `reason`), so the website weekends look the same [W14];
   - type `scoala`, title = group name, `group` set; history on the group "Program adăugat: Sâ și Du, 10:00, 50 min, din <data>." [3.7];
   - idempotent: a group that already has a linked weekly series overlapping the season is skipped.
5. `link-events`: unlinked events of type `curs` whose title, without a leading "Antrenament:" or "Curs", matches a group by `nameKey` get `group` set: "Antrenament: Avansati" -> Club Avansați; "Curs Avansati" -> Club Avansați where it exists (it is not in production) [m4 11; prod]. "Titlu" and "Eveniment" are left alone; the three "Vacanta scolara" stay unlinked calendar entries [p4 design]. Test and demo names ("Grupa A", "Weekend curs", TEST "Performanță", "Grupa Mică", "Grupa Mare") are skipped [m4 11].
6. `retire-old-series` (separate, run only after the user has checked /cursuri/program, the website calendar and the group Program tabs): deletes the unlinked `scoala` events whose dates were copied in step 4. Dry run lists them with their dates and exceptions [W14].

`program.scheduleGroups` keeps its data in the database (rollback source); nothing reads it after the frontend deploy except the fallback in 9.1. The field and its custom field registration stay in the schema until a later cleanup, so Strapi still boots [m4 7; W18].

Deploy order (each step needs the previous one; phase 4 deploys after phase 2 + 3 are live):
1. Backup of the database [P3 11].
2. Deploy the backend: schema (3.1, 3.4, 3.6) applied on restart.
3. Deploy the frontend: website reads 9.1 / 9.2, with the notebook fallback while the groups have no school series.
4. Migration steps 1 to 5, each dry run, shown to the user, then `--apply`.
5. Checks: Grupe, each group's Program, /cursuri/program, /inscrieri "Programul pe următoarea lună".
6. Step 6, dry run, then `--apply` after the user approves.

## 5. Admin: Grupe

### 5.1 Menu
"Club și școală" gets "Grupe" above "Sportivi" [DEC 2026-10-10 aloca-v2 (c); mock grupe-list shell; P3 7]. Route `/plugins/edusport-grupe`, the group page under `/plugins/edusport-grupe/<documentId>` (same pattern as the Sportivi record) [code sportivi/routes.ts].

### 5.2 List page [mock grupe-list 1, 2; m4 1]
- Title "Grupe"; actions "Fără grupă" with the count (5.3, only when the count is not 0) and "Grupă nouă" (primary, plus icon) [DEC 2026-10-10 pending-groups-v1 Q1 A].
- Toolbar: season select "Sezon 2026-2027" (default current season), like Sportivi [mock grupe-list].
- Tabs per section with the number of groups: "Școala de patinaj" (7), "Club" (2); no "Toate" [DEC 2026-10-10 aloca-v2 (b)]. While there is one school the school tab reads "Școala de patinaj"; with 2+ schools each school tab shows its section name [W16].
- Line under the tabs: "<n> sportivi în <k> grupe", n = distinct athletes with a current membership in the tab's groups for the season [DEC 2026-10-10 user (distinct totals); mock grupe-list]. Forms: "1 sportiv", "1 grupă", "20 de sportivi" [DEC 2026-10-26 plan 3-5 ("de" from 20)].
- Table columns "Grupă" | "Program" | "Antrenori" | "Sportivi"; the row opens the group [DEC 2026-10-10 aloca-v2 (b)]:
  - Grupă: name;
  - Program: one line per weekly series of the season, "<zile> <ora>" ("Sâ, Du 10:00", "Lu, Mi, Vi 18:00"; a second series on its own line, "Lu, Mi 17:00" / "Sâ 09:00"); start time only; one-off classes not listed [mock grupe-list; DEC 2026-10-19 coach-schedule-app-v3]; no series: "Fără program" (muted) [W16];
  - Antrenori: names joined by commas; none: "Fără antrenor" (muted) [mock grupe-list; m4 1];
  - Sportivi: count of current memberships in the season.
- Inactive groups (`active` false) are not listed. Order: `order`, then name.
- Phone: header with both buttons stacked, season select, tabs, the count line, cards (name; "<program>, <n> sportivi"; coaches or "Fără antrenor") [mock grupe-list phone].
- A past season is read-only: no "Fără grupă", no "Grupă nouă" [W5].

### 5.3 "Fără grupă" [mock grupe-list 3, 4, 5; old mock aloca-v2; DEC 2026-10-10 pending-groups-v1 Q1 A, aloca-v1 A]
- Button "Fără grupă" with an orange count (admin "eveniment" orange tokens, as drawn), next to "Grupă nouă"; it belongs to the whole club and shows on both tabs; it disappears at 0 [DEC 2026-10-10 pending-groups-v1 Q1 A; m4 1].
- Who: athletes with status Nou or Activ and no current membership in the selected season ("Fără grupă" = zero groups) [DEC 2026-10-10 user (Fără grupă = zero groups); W6].
- Desktop: dropdown under the button, header "<n> sportivi fără grupă"; one row per athlete: name (bold), source line, first that applies: "Înscriere Școală, 12 ani" (a registration of that season is linked), "Din 2026-2027, 12 ani" (a membership in the previous season), "Adăugat în Sportivi, 13 ani" (otherwise); age left out when unknown; a `SearchableSelect` with placeholder "Alege grupa" preselected with the proposed group; button "Alocă"; footer "Alocă toți în grupele propuse" (ghost) [mock grupe-list 3; mock sezon-nou-a A8; DEC 2026-10-27 phase 4 new season 4; W6; W30].
- Proposed group: the athlete's main group of the previous season when that group is still active; otherwise none [W6; DEC 2026-10-27 phase 4 spec review; Open 1].
- Group options: every active group, school groups first then Club, in their order, the section name as the option hint ("Școala de patinaj" / "Club") [mock grupe-list 4; DEC 2026-10-10 user (SearchableSelect)].
- "Alocă": the row's group, straight away, no navigation; the row disappears, the count drops [DEC 2026-10-10 aloca-v1 A]. The membership is main (the athlete had none) [3.2].
- "Alocă toți în grupele propuse": every row with a group chosen (proposed or changed); rows without a group stay [W6].
- Toasts with "Anulează", 8 seconds, no X [DEC 2026-10-10 aloca-v2 (a); DEC 2026-10-26 gaps #32; plan 3-1]: "Sportiv alocat în Intermediari Bronze: Elisa Georgescu." / "<n> sportivi alocați în grupele propuse." ("1 sportiv alocat în grupa propusă.") [mock grupe-list 5; W1].
- Phone: the same rows in a bottom sheet titled "<n> sportivi fără grupă", footer "Alocă toți în grupele propuse" (secondary) [mock grupe-list 3 phone].
- No e-mail, no subscription, everything in Istoric [old mock aloca-v2].

### 5.4 "Grupă nouă" and "Editează grupa" [W11]
- Window (Modal; full-height sheet on phones) "Grupă nouă": "Nume" (required), "Listă de prețuri" (`SearchableSelect` of the section's price lists, hint "Opțional"), "Antrenori" (several, from Membri echipă), "Program public" (switch, on, hint "Programul apare în calendarul de pe site."). The section is the open tab's. Buttons "Anulează" / "Creează grupa" [old mock group-create; DEC 2026-10-10 aloca-v2 (b) ("+ Grupă nouă" in the open tab)].
- After creating: the new group page opens on "Program"; toast "Grupă creată: <nume>." The program is added there (6.2).
- "Editează grupa": same fields, button "Salvează"; toast "Salvat." / "Nicio modificare." [DEC 2026-10-26 plan 3-5].
- Only admins create groups; no capacity [DEC 2026-10-19 coach-q7-roles; DEC 2026-10-06 groups-v2].
- Same price list = shared abonament; no separate setting [DEC 2026-10-10 main-group-v1].

## 6. Admin: group page (option A) [m4 2; mock grupa-a]

### 6.1 Header and tabs
- Full page with back link "Grupe"; title = group name; subtitle "<secțiune>, <antrenori>, lista <listă>, <n> sportivi" ("Școala de patinaj, Virgil Pascu, lista Standard, 11 sportivi"); "Fără antrenor" when none; the list part is left out without a price list [mock grupa-a header].
- The season is the one chosen on Grupe (in the URL), default current; a past season is read-only (no row menus, no "Adaugă sportivi", no program edits) [W5].
- Header "..." ("Mai multe acțiuni"): "Editează grupa" (5.4); "Șterge grupa" only for a group that never had a membership or an event (confirmation "Ștergi grupa "<nume>"? Acțiunea nu poate fi anulată.") [W11].
- Tabs "Sportivi" (count) | "Program" | "Istoric" (count), shared Tabs count badges; "Prezență" joins in phase 5 [m4 2; DEC 2026-10-26 Istoric tab count].
- Phone: full-height sheet like the athlete record: title = group name, the subtitle line, "..." button, scrolling tab bar [mock grupa-a phone; DEC 2026-10-26 3b Q7].

### 6.2 Sportivi tab [mock grupa-a A1, A2, A3; m4 3, 4]
- Bar: "<n> sportivi" and "Adaugă sportivi" (secondary, plus icon).
- Columns "Sportiv" | "Vârstă" | "Principală" | "Alte grupe" | row "..." [m4 4]:
  - Sportiv: full name, opens the athlete record in the same tab [DEC 2026-10-26 gaps #33];
  - Vârstă: "<n> ani", blank without a birth date [P3 5];
  - Principală: "Da" / "Nu" (Nu muted);
  - Alte grupe: the athlete's other current groups this season joined by commas, the main one followed by " (principală)"; none: "Niciuna" (muted) [mock grupa-a A1; m4 4].
- Sorted by name. No "Și în <grupă>" line under names [DEC 2026-10-10 move-v3].
- Phone: cards, name, then "<n> ani, principală, și în <grupă>" (parts present only when true), "..." beside the card [mock grupa-a phone].
- Row "...": "Mută", "Adaugă și în grupă", "Scoate din grupă" (red) [mock grupa-a A2].
- "Mută" opens the one move window [old mock move-modal-final; m4 3; DEC 2026-10-10 user (every move uses the same window)]:
  - title "Mută în altă grupă"; label/value "Sportiv" <nume>; columns "Din" <this group> and "În" (`SearchableSelect`, placeholder "Alege grupa", every other active group with the section hint); buttons "Anulează" / "Mută" [mock grupa-a A3];
  - abonament section (title, "Expiră pe <data>", 8 segments, "<n> folosite", "<n> rămase"; Avansați Gold line "Abonamentul actual rămâne valabil. Următorul, la prețul Avansați Gold.") hidden in phase 4, since no subscription exists; built with phase 5 [DEC 2026-10-10 move-modal-v3 Q2 B, user (move-modal-final)];
  - effect: this membership ends (3.2) and a current membership in "În" starts; when the row was the main group the new one becomes main, otherwise the main group stays where it was; an athlete already on "În" keeps that row and it takes over this row's main flag [DEC 2026-10-10 main-group-v1 B ("Mută" changes the main group); W2];
  - toast "Sportiv mutat în Intermediari Silver: Ana Ionescu." with "Anulează" [W1].
- "Adaugă și în grupă": a window like the move window, title "Adaugă și în grupă", "Sportiv", "În", buttons "Anulează" / "Adaugă"; adds a current, non-main membership; the main group does not change [DEC 2026-10-10 main-group-v1 B; W3]. Toast "Sportiv adăugat și în <grupă>: <nume>."
- "Scoate din grupă": no window; the membership ends; when it was the main group and others remain, the remaining group with the earliest `from` becomes main (history "Grupa principală schimbată") [W4]. Toast "Sportiv scos din <grupă>: <nume>." with "Anulează".
- "Adaugă sportivi": dropdown under the button (bottom sheet on phones) with the athlete search of "Caută alt sportiv" [P3 4.1, 6.7], starting on the "Fără grupă" filter of 5.3 with a switch to all athletes; tick several; button "Adaugă în grupă"; athletes already in the group are not listed [old mock groups-v2 3; W3]. Each becomes main when it has no group this season, otherwise not. An inactive athlete becomes Activ ("Reactivat") [DEC 2026-10-18 states-v2]. Toast "<n> sportivi adăugați în grupă." ("1 sportiv adăugat în grupă.").
- One-off attendance in another group is not a membership: phase 5 [DEC 2026-10-10 main-group-v1 B].

### 6.3 Program tab [mock grupa-a A4 to A9; DEC 2026-10-19 coach-schedule-app-v3]
- Block "Program obișnuit": one row per weekly series of the season, "<zile>, <ora>, <durată>" in bold ("Sâ și Du, 11:00, 50 min"; ", la 2 săptămâni" or ", lunar" appended for those frequencies), muted "din <data>" ("din 4 oct 2026"), link "Schimbă"; under it "Adaugă program" (secondary, plus icon) [mock grupa-a A4; W10].
- Below: the existing admin calendar (`cal` components), "Listă" / "Lună", month navigation to any month, "Azi" [mock grupa-a A4; DEC 2026-10-19 coach-schedule-app-v3]. Listă groups dates by week ("9 - 15 noiembrie"), each date shows the start time:
  - normal: "11:00"; one-off classes look the same (no other colour) [DEC 2026-10-19 coach-schedule-app-v3];
  - cancelled: struck, "anulat" colour, "11:00 Anulată: Competiție la Brașov" ("11:00 Anulată" without a reason) [mock grupa-a A4];
  - moved: on the new date "12:00 Mutată de la 11:00" (same day) or "12:00 Mutată de la 14 noiembrie" (other day); nothing on the old date [mock grupa-a A4; W12];
  - break: struck, grey ("liber" colour), "11:00 Vacanța de iarnă", one row per date [m4 6; mock pauze-a effect].
- "Adaugă program" opens the Drawer (bottom sheet on phones) "Program nou" [mock grupa-a A5, A6]:
  - "Se repetă" switch, on by default;
  - on: "Cât de des" (Select "Săptămânal" / "La 2 săptămâni" / "Lunar") [DEC 2026-10-19 "Cât de des"]; "Săptămâna din lună" (existing calendar options "Prima" ... "Ultima"), only for Lunar [code model.ts; W10]; "Zile" (day toggles Lu Ma Mi Jo Vi Sâ Du); "De la" (time) and "Durată" (Select "<n> min", 15 to 240 in steps of 5, default 50) [W10]; "Se aplică din" (date, default today or the season start);
  - off: "Data", "De la", "Durată", "Notă" (hint "Opțional", stored as the event description) [mock grupa-a A6];
  - buttons "Anulează" / "Salvează"; toast "Program adăugat." or "Ședință adăugată: 20 noiembrie." with "Anulează".
- "Schimbă" opens the same Drawer titled "Schimbă programul", prefilled, without "Se repetă", with "Se aplică din" (default the next date of the series) and a red link "Șterge programul" [DEC 2026-10-19 coach-schedule-app-v3; W10]:
  - saving ends the old series the day before "Se aplică din" and starts a new series from that day; dates already changed (Anulează / Mută) from that day on move to the new series when they are still class dates there; toast "Program schimbat." [W10];
  - "Șterge programul" asks "Ștergi programul din <data>? Datele de dinainte rămân." and ends the series the day before "Se aplică din"; a series with no date before that day is deleted; toast "Program șters." [W10].
- Click on a date opens the Drawer (bottom sheet on phones) titled "<Zi>, <data>, <ora>" ("Sâmbătă, 14 noiembrie, 11:00") [mock grupa-a A7, A8]:
  - "Această dată": segmented "Ține" / "Anulează" / "Mută";
  - Mută: "Data nouă" (date) and "De la" (time); the duration stays;
  - "Motiv" (hint "Opțional") for Anulează and Mută;
  - "Anunță părinții pe e-mail" (checkbox), shown for Anulează and Mută, off by default [DEC 2026-10-19 notif-q1-emails; W7];
  - a one-off class also shows a red link "Șterge ședința" ("Ștergi ședința din <data>?") [W10];
  - buttons "Anulează" / "Salvează";
  - toasts with "Anulează": "Ședința din 14 noiembrie a fost anulată." / "Ședința din 21 noiembrie a fost mutată." / "Ședința din 14 noiembrie se ține." [mock grupa-a A9].
- A break date opens the panel read-only with the notice "Pauză: <nume>." (no Ține / Anulează / Mută); a break is changed in Pauze [W13].
- Changes go live on the website directly, no approval [DEC "Decided" (coach schedule changes go live)].

### 6.4 Istoric tab [mock grupa-a A10; P3 6.5]
- Newest first; date "27 oct 2026, 14:22" bold, actor muted ("Migrare" for migration rows), the line under it [DEC 2026-10-26 plan 3-5; 3b Q23].
- Lines of 3.7 for the group's roster, program and settings.

### 6.5 Parent e-mail on a schedule change [DEC 2026-10-19 notif-q1-emails; SPEC 3.10]
- Sent only when "Anunță părinții pe e-mail" is ticked, for that change only.
- Recipients: the contact e-mail of every athlete with a current membership in the group, in the season that contains the date; athletes Inactiv or anonymized and empty e-mails are left out; addresses trimmed, lower case, each address once (siblings get one e-mail) [P3 2.1 normalising; W7].
- One `email-job` per address, `kind` `schedule-change`, `changeKey` = the change's history entry, `notBefore` = now + 15 seconds; the existing Brevo queue sends it (first attempt after `notBefore`, then the hourly cron retries, 5 tries, GlitchTip alert, outside production every e-mail goes to the one test address) [DEC 2026-10-03 flow-after-submit-v2; DEC 2026-10-19 phase 2 sections 1-4; code src/email].
- The toast's "Anulează" within the window sets every job of that `changeKey` still queued to `cancelled` [W7].
- Text and layout in our code, Brevo only sends; "letter" layout E1 like the registration e-mail [DEC 2026-10-19 phase2-q1-technical; DEC 2026-10-05 email-e-v2].
- Texts, approved [DEC 2026-10-27 phase 4 spec review; companion phase4-spec-review 3]. `<zi>` is the weekday in lower case ("sâmbătă"), `<data>` as "14 noiembrie", `<ora>` "10:00":
  - Subject, cancelled: "<grupă>: ședința de <zi>, <data>, se anulează" ("Primii Pași: ședința de sâmbătă, 14 noiembrie, se anulează").
  - Subject, moved: "<grupă>: ședința de <zi>, <data>, se mută" ("Primii Pași: ședința de sâmbătă, 14 noiembrie, se mută").
  - Body, cancelled (paragraphs in order):
    - "Bună ziua,"
    - "Ședința grupei <grupă> de <zi>, <data>, ora <ora>, se anulează." and, on the next line of the same paragraph, "Motiv: <motiv>."
    - "Următoarea ședință: <zi>, <data>, ora <ora>."
    - "Echipa EduSport"
    - Example: "Ședința grupei Primii Pași de sâmbătă, 14 noiembrie, ora 10:00, se anulează." / "Motiv: Competiție la Brașov." / "Următoarea ședință: duminică, 15 noiembrie, ora 10:00."
  - Body, moved (paragraphs in order):
    - "Bună ziua,"
    - "Ședința grupei <grupă> de <zi>, <data>, ora <ora>, se mută <zi nouă>, <data nouă>, ora <ora nouă>." and, on the next line of the same paragraph, "Motiv: <motiv>."
    - "Echipa EduSport"
    - Example: "Ședința grupei Primii Pași de sâmbătă, 14 noiembrie, ora 10:00, se mută duminică, 15 noiembrie, ora 12:00." / "Motiv: Patinoarul este închis."
  - The "Motiv" line only when a reason is written; a reason that already ends in ".", "!" or "?" gets no second period [W33].
  - "Următoarea ședință": the group's first class after the cancelled date that is held (series, one class or a moved date at its new date) in the same season; the line is left out when there is none [W33].
- History line ends with "Părinții anunțați pe e-mail." and stores the number of addresses.

## 7. Admin: "Calendar și serii" [m4 5, 7; mock pauze-a]

### 7.1 Pauze section
- New section "Pauze" at the top of the page, button "Adaugă pauză" (secondary, plus icon) [mock pauze-a A1].
- Table "Nume" | "De la" | "Până la" | row "...", dates "20 dec 2026", sorted by "De la"; phone: cards "<nume>" and "<de la> - <până la>" [mock pauze-a A1].
- Row "...": "Editează", "Șterge" (red; "Ștergi pauza "<nume>"?") [W13].
- Window (Modal; sheet on phones) "Pauză nouă" / "Editează pauza": "Nume", "De la", "Până la", hint "Nicio ședință a grupelor în aceste zile."; buttons "Anulează" / "Salvează" [mock pauze-a A2]. "Până la" before "De la": "Data de sfârșit trebuie să fie după data de început." Toast "Pauză salvată." / "Pauză ștearsă."
- Effect as 3.5; the calendar shows break days with the break name in the "liber" colour [mock pauze-a A1].

### 7.2 Calendar section
- Stays as it is ("Calendar", "se salvează automat"); it now reads the admin occurrences route (8.2), so groups whose program is not public are visible here too.
- Group events show as "<ora> <grupă>" chips (month) or rows (list) [mock pauze-a A1].
- Clicking a group event opens the group date panel of 6.3 with a link "Deschide grupa"; series of a group are changed only on the group page [p4 design (groups own their program); W18]. The event drawer's "Categorie" no longer offers "Școala de patinaj" for new events [W18].
- The existing routes `/api/calendar/events` refuse writes to group events (409, "Evenimentul aparține grupei <grupă>. Se schimbă din pagina grupei.") [W18].

### 7.3 "Serii de cursuri Școala de Patinaj" removed
The section and its save bar leave `ProgramEditPage.tsx`; `ScheduleGroupsInner` is no longer used by the page. Done in the same release as the website reading the groups [m4 7; p4 design].

## 8. Rules, routes and public reads

### 8.1 Rules
- One main group per athlete per season; checked after every membership write in the same transaction [SPEC 2 rule 2].
- Moves keep history: ended rows stay with their `to` date [DEC 2026-10-10 main-group-v1 B ("Grupe anterioare")].
- Counts per group = current memberships of the season; totals = distinct athletes [DEC 2026-10-10 user].
- Season scoping: Grupe, the group page, "Fără grupă" and counts read one season; past seasons read-only [W5].
- Locks: membership writes lock the touched athletes (sorted by id) through the existing `lockAthlete`; P3 writers keep registrations then athletes; phase 4 membership writes take no registration lock, so the order holds [code locks.ts]. Schedule writes lock the calendar-event row before reading its exceptions. No write takes both kinds.
- All or nothing per action; failure text "Acțiunea nu a reușit. Nimic nu a fost salvat." [P3C 7].
- Undo: from the toast only, 8 seconds; it reverts exactly what the action wrote (memberships, main flags, exceptions, series split, queued e-mails) and writes "Anulat: ..." (3.7); refused when a later change touched the same rows: "Nu se mai poate anula. Grupa s-a schimbat între timp." [DEC 2026-10-10 aloca-v2 (a); DEC 2026-10-26 gaps #32; W15].

### 8.2 Admin routes
All under `src/api/club/routes/06-groups.ts` and `07-schedule.ts`, config `{ auth: false, policies: ['global::is-admin'], middlewares: [] }` like every P3 admin route [code 05-athletes.ts]:
- `GET /club/groups?season=<label>&section=<slug>`: list rows of 5.2, tab counts, distinct line.
- `GET /club/groups/unassigned?season=<label>`: rows of 5.3.
- `POST /club/groups`, `PUT /club/groups/:documentId`, `DELETE /club/groups/:documentId` (409 when it ever had a membership or an event).
- `GET /club/groups/:documentId?season=<label>`: header and roster; `GET /club/groups/:documentId/history`.
- `POST /club/groups/:documentId/members` body `{ season, athleteIds }`: "Alocă", "Adaugă sportivi", "Adaugă și în grupă".
- `POST /club/memberships/allocate` body `{ season, items: [{ athleteId, groupId }] }`: "Alocă toți".
- `POST /club/memberships/:documentId/move` body `{ toGroupId }`; `DELETE /club/memberships/:documentId`: "Scoate din grupă".
- `POST /club/groups/:documentId/program` (series or one class), `PUT /club/program/:eventId` ("Schimbă", body includes `from`), `POST /club/program/:eventId/end` body `{ from }` ("Șterge programul"), `DELETE /club/program/:eventId` (one class), `PUT /club/program/:eventId/dates/:date` body `{ mode: "keep" | "cancel" | "move", newDate, newStartTime, reason, notifyParents }`.
- `POST /club/undo` body `{ actionId }`: the toast "Anulează" for every action above (actionId = the action's history entry).
- `GET /club/calendar/occurrences?from&to[&group=<documentId>]`: all occurrences incl. non-public groups, with `groupId`, `groupName`, `originalDate`, `originalStartTime` for overrides; same 92-day cap.
- `GET /club/breaks`, `POST /club/breaks`, `PUT /club/breaks/:documentId`, `DELETE /club/breaks/:documentId`.
- Every write route answers `{ data, undo: { actionId } }` where undo applies.
- New-season and per-group copy routes: 10.9.
- Each write that changes the public calendar or notebook calls `pingRevalidate()` after commit (fire and forget) [DEC "Decided" (pingRevalidate later); code utils/revalidate.ts].

### 8.3 Public reads
- `GET /api/calendar/occurrences` (auth false, unchanged address and cap): leaves out events of groups with `programPublic` false or `active` false; each occurrence gains `groupName` (string or null); break notes as 3.5. No athlete, coach or count data [m4 9; p4 design; SPEC 5].
- New `GET /api/club/schedule` (auth false, `Cache-Control: public, max-age=60` like `/club/public`): per school section with a public page, `{ section: { name, slug }, slots: [{ start: "09:00", end: "09:50", groups: ["Avansați Gold"] }] }` from the weekly series of public, active school groups running in the current season; slots ordered by start, groups by `order` [m4 8; W20].
- The core routers of `calendar-event`, `calendar-blackout` and `group` must stay closed to the Public role (a test asserts 403 on `/api/calendar-events`, `/api/calendar-blackouts`, `/api/groups`), so a non-public group's program never leaks [code createCoreRouter; SPEC 5].

## 9. Website

### 9.1 /cursuri/program notebook [m4 8; mock program-site A]
- Same notebook look, built from `/api/club/schedule`: one block per time slot "09:00 - 09:50" with "- <grupă>" lines, Școala groups only; Club groups are not listed here (they use the calendar, later their own portal page) [m4 8]. The Club notebook drawn in mock program-site A is not built (m4 8 is the later decision).
- Header "Sâmbătă & Duminică" / "Program Școala de Patinaj" and the CMS subtitle stay as they are; group days are not printed per group [W20].
- Fallback while the endpoint has no slots (before migration step 4) or fails: `program.scheduleGroups` as today; the empty text "Programul sezonului va fi publicat în curând." stays for when both are empty [W18].

### 9.2 Calendar (/cursuri/program and /inscrieri "Programul pe următoarea lună") [m4 10; p4 design]
- Public groups only (8.3).
- One Școala tile per school day, as today: `occurrencesToCalendarEvents` merges every `scoala` occurrence of a date into one tile titled "Școala de patinaj"; state "curs" when any of them holds class, else "anulat" when any is anulat, else "liber"; time "<first start> - <last end>"; note = the first non-empty note (break name or reason) [m4 10; DEC 2026-10-03 (cancelled weekends red + struck); W21]. The weekend model and /inscrieri read the merged result.
- Club group dates stay one tile each, as "Antrenament: Avansati" does today, titled with the group name; cancelled ones are not shown (as today) [code occurrences-to-calendar.ts; W9].

### 9.3 Caching
- /cursuri/program keeps `revalidate = 300`; the occurrences fetch keeps 300 s; the schedule fetch 60 s; admin writes ping `/api/revalidate` (no tag: all default paths incl. /cursuri/program, /inscrieri) when `REVALIDATE_FRONTEND_URL` and `REVALIDATE_SECRET` are set on the VM (Open 2) [DEC "Decided" (revalidate 300 s, pingRevalidate later); code].

## 10. New season [DEC 2026-10-27 phase 4 spec review; DEC 2026-10-27 phase 4 new season 1-6; mock sezon-nou-a]

Groups carry over; memberships and series are per season (3.1). Examples below use 2026-2027 as the current season (`<curent>`) and 2027-2028 as the next one (`<next>`).

### 10.1 Start point [DEC 2026-10-27 phase 4 new season 1; mock sezon-nou-a A1, A7]
- Sezoane (`SezoanePage.tsx`) gets a row button "Începe sezonul 2027-2028" (secondary, small) in a last, untitled column; on phones it sits under the season name. The click does not open the row's edit panel.
- Shown only on the season right after the current one: the season whose label start year is the current season's start year + 1. It exists once created with "Sezon nou" (still created not current [code season-admin-service.ts]). No current season, or no next season: no button [W23].
- Any admin may use it (`global::is-admin`, like every Sezoane route); no decision limits it to Super Admin [code 03-admin-prices-seasons.ts; W22].
- Allowed at any time, before or after the next season's start month [W23].
- After applying, the new season shows "Curent" and no row shows the button (until the season after it is created) [mock sezon-nou-a A7].

### 10.2 The window [mock sezon-nou-a A2 to A4]
Modal (size lg; full-height sheet on phones), title "Începe sezonul 2027-2028", next to the title "Pasul <n> din 3". Nothing is written before the last button.

Step 1, what changes [mock sezon-nou-a A2]:
- Lead "2027-2028 devine sezonul curent. Se aplică abia la ultimul pas."
- Header "Pe site", label/value rows:
  - "Înscrieri": "Formularul trece pe 2027-2028, taxa de membru 200 RON. Deschis sau închis din Setări site, ca acum." (the fee is the next season's `membershipFee`; the part ", taxa de membru <n> RON" is left out without a fee [W29]);
  - "Formular pe hârtie": "Sezonul 2027-2028.";
  - "Program": "Orarul Școlii se ia din programul grupelor în 2027-2028.";
  - "Calendar": "Nu se schimbă. Arată fiecare dată din programul grupelor, din ambele sezoane."
- Header "În panou":
  - "Grupe, Sportivi": "Se deschid pe 2027-2028.";
  - "2026-2027": "Rămâne de citit în Grupe, nu se mai modifică." [W5];
  - "Membru A.C.S.": "Pe sezon, nu se copiază. În 2027-2028 toți pornesc de la Nu."
- Buttons "Anulează" (ghost) / "Continuă".

Step 2, the groups [mock sezon-nou-a A3; DEC 2026-10-27 phase 4 new season 2, 3]:
- Lead "Toate grupele trec în 2027-2028. Alege ce copiezi din 2026-2027."
- One table per section, section header above it ("Școala de patinaj", "Club"; section names with 2+ schools as W16), active groups only, in their order. Columns "Grupă" | "În 2026-2027" | "Copiază sportivii" | "Copiază programul"; the two last headers are checkboxes that tick or untick every row of that section and show the mixed state when rows differ [DEC 2026-10-27 phase 4 new season 2].
- Row: group name; "<n> sportivi" (current memberships in 2026-2027), plus ", <k> inactiv" / ", <k> inactivi" when some are Inactiv, and the link "Vezi sportivii" ("Ascunde" when open; no link at 0); a checkbox; a checkbox followed by the muted program text in the list format of 5.2, several series joined by ", " ("Lu, Mi 17:00, Sâ 09:00").
- Defaults: "Copiază sportivii" off for school groups, on for Club groups; "Copiază programul" on for every group [DEC 2026-10-27 phase 4 new season 2].
- Disabled boxes [W26]: "Copiază sportivii" with 0 sportivi; "Copiază programul" when the group has no series running on the last day of 2026-2027 (text "Fără program") or already has a weekly series in 2027-2028 (off, text "Are program în 2027-2028").
- "Vezi sportivii" opens a row under the group: header "Sportiv" | "Grupa principală în 2027-2028"; one line per athlete, sorted by name: checkbox "<nume>, <n> ani" (age left out when unknown), then the main group they will have in 2027-2028 if everything ticked is applied, with a muted second line when useful: "ca în 2026-2027" (main kept in another copied group), "în 2026-2027: <grupă>, care nu se copiază" (main changes) [mock sezon-nou-a A3].
  - Untick a child who left: that child is not copied into this group (other groups are not affected) [DEC 2026-10-27 phase 4 new season 3; W26].
  - Inactiv athletes: checkbox off and disabled, "Inactiv, nu se copiază"; they are never copied; anonymized athletes are not listed [DEC 2026-10-27 phase 4 new season 3].
  - The child checkboxes are enabled only while the group's "Copiază sportivii" is ticked; ticking the group ticks every active child again.
- Under the tables, muted: "Grupa principală rămâne aceeași dacă se copiază și ea. Altfel devine principală grupa copiată."
- Summary box: "Se copiază <n> sportivi în <k> grupe și programul a <m> grupe. <x> sportivi rămân fără grupă, <y> inactivi nu se copiază." (n distinct athletes; x = the "Fără grupă" count 5.3 will show in 2027-2028 after applying; number forms as 5.2: "1 sportiv", "1 grupă", "20 de sportivi"; the "<y> inactivi" part left out at 0, "1 inactiv nu se copiază" for one) [mock sezon-nou-a A3; W29].
- Phone: per section the two ticks "Sportivii, toate" and "Programul, toate", then one card per group: name; "<n> sportivi în 2026-2027[, <k> inactiv], <program>"; checkboxes "Copiază sportivii" and "Copiază programul"; link "Vezi sportivii" / "Ascunde sportivii"; child lines "<nume>, <n> ani" with "Principală: <grupă>" under [mock sezon-nou-a A3 phone].
- Buttons "Înapoi" / "Continuă".

Step 3, preview [mock sezon-nou-a A4; DEC 2026-10-27 phase 4 new season 5]:
- Four StatTiles: "Grupe" <n> "toate trec în 2027-2028"; "Sportivi copiați" <n> "în <k> grupe" (followed by the section name when all are in one section: "în 2 grupe Club"); "Programe copiate" <n series> "din 1 oct 2027"; "Fără grupă" <n> "grupa din 2026-2027 propusă".
- Lines, the bold part first, a line left out when its count is 0 [W29]:
  - "**Grupa principală se schimbă pentru <n> sportivi.** Filip Radu: Intermediari Bronze -> Profesioniști. Luca Mihai: Avansați Gold -> Avansați." (every athlete listed);
  - "**Rămâne aceeași pentru <n> sportivi**, de exemplu Ioana Marin: Profesioniști.";
  - "**<n> sportivi inactivi nu se copiază:** Tudor Matei, Mihnea Sava.";
  - "**<n> de sportivi intră la Fără grupă** în 2027-2028, cu grupa principală din 2026-2027 propusă.";
  - "**Programul se repetă** din 1 oct 2027 până pe 31 mai 2028. Pauzele nu se copiază: adaugă vacanțele în Calendar și serii." (only when a program is copied);
  - "**Membru A.C.S. nu se copiază.** În 2027-2028 toți pornesc de la Nu." (always);
  - when no school group gets a program: Notice (warning) "Grupele Școlii nu au program în 2027-2028: pagina Program arată textul vechi până îl adaugi." [9.1 fallback; text from mock sezon-nou-b B7; W29].
- The counts come from the server, computed by the same planner that applies (10.9), so the preview and the result match.
- Buttons "Înapoi" / "Începe sezonul 2027-2028" (primary).

### 10.3 What is copied [DEC 2026-10-27 phase 4 new season 2-4]
Members, per group with "Copiază sportivii" ticked:
- Source: the group's current memberships (`to` null) in 2026-2027.
- Never copied: athletes Inactiv or anonymized; children unticked in "Vezi sportivii" (for that group).
- Each copied athlete gets a membership in 2027-2028: `from` = the later of the season start and today (`membershipFrom`, 3.2), `to` null. A group the athlete already has in 2027-2028 is not written twice [P3 1.4 "nothing written twice"; W25].
- Main group carried over [mock sezon-nou-a A3 rule line; W25]:
  - the athlete already has a main group in 2027-2028 (added earlier on that season): it stays, copies are not main;
  - otherwise, when the 2026-2027 main group is copied for the athlete, it is main again;
  - otherwise the copied group with the earliest `from` in 2026-2027 becomes main (then the group order); this is the "Grupa principală se schimbă" line of the preview.
- One main membership per athlete per season holds after the copy (8.1).
- Status is not changed (no "Reactivat"): only Nou and Activ athletes are copied.

Children not copied [DEC 2026-10-27 phase 4 new season 4; mock sezon-nou-a A8]:
- Nothing is written for them. Nou and Activ athletes without a membership in 2027-2028 are the "Fără grupă" of 2027-2028 by the 5.3 rule, with the 2026-2027 main group proposed (when still active) and the source line "Din 2026-2027, <n> ani"; new registrations of 2027-2028 join the same list with "Înscriere Școală" [W6; W30].
- A leaver who stays in "Fără grupă" leaves the list when set to Inactiv in Sportivi [P3 statuses].

A.C.S. [DEC 2026-10-27 phase 4 new season 4]:
- Nothing is copied or written: no `acs-membership` row is created for 2027-2028. "Nu" is the absence of a row for that athlete and season, as already shown in Sportivi [P3 5 "no value shown as Nu"]. The 2026-2027 rows stay as they are. A confirmed 2027-2028 registration with the wish "Da" writes "În așteptare" as in P3 1.4.

Program, per group with "Copiază programul" ticked [DEC 2026-10-27 phase 4 new season 2, 6; W27]:
- Source: the group's series (`freq` weekly, biweekly or monthly) still running on the last day of 2026-2027, i.e. the "Program obișnuit" rows at the season's end. Series ended earlier ("Schimbă", "Șterge programul") are not copied.
- Each becomes a new calendar event: same `freq`, weekdays, `weekOfMonth`, `startTime`, `endTime`, `type`; `group` set; `title` = the group's current name; `seasonStart` = the later of the first day of 2027-2028 and today; `seasonEnd` = the last day of 2027-2028 ("din 1 oct 2027 până pe 31 mai 2028"). A biweekly series counts its weeks from the new `seasonStart`.
- Not copied: per-date exceptions (Anulează, Mută, Ține), one-off classes, the event description. Pauze are not copied either: breaks are dated, so the next season's holidays are added in "Calendar și serii" [DEC 2026-10-27 phase 4 new season 6].
- Groups themselves (name, section, price list, coaches, "Program public", order) are not written: they carry over.

### 10.4 Making the season current [DEC 2026-10-27 phase 4 new season 1; mock sezon-nou-a A2]
- In the same transaction as the copies: 2027-2028 `isCurrent` = true; every other season `isCurrent` = false.
- Website, through every reader of the current season (`findCurrentSeason`, `src/club/current-season.ts`):
  - `/api/club/public`: season label and membership fee, so /inscrieri shows 2027-2028 and its fee; new registrations are filed under 2027-2028 (`registration-submit.ts`); open or closed stays in Setări site [code public-info-loader.ts, registration-submit.ts];
  - the paper form PDF prints 2027-2028 [code documents/service.ts];
  - /cursuri/program notebook: `/api/club/schedule` reads the 2027-2028 series (8.3), with the 9.1 fallback when the school groups have none;
  - calendar (/cursuri/program, /inscrieri): unchanged; occurrences are read by date, so dates of both seasons show.
- Panel: Grupe and Sportivi open on 2027-2028; 2026-2027 becomes a past season, read-only (W5).
- `pingRevalidate()` after commit and after an undo (8.2).

### 10.5 Applying, toast and undo [DEC 2026-10-27 phase 4 new season 5; mock sezon-nou-a A5]
- One transaction for everything (season flags, every membership, every series, every history line), not one per group [W24]. Why: the window promises a season that is current and prepared together; per-group transactions could fail half way and leave 2027-2028 current with some groups copied and others not, which is the half-done state option A was chosen to avoid. The size is small (production: under 100 memberships and about 10 series), so one transaction holds its locks briefly.
- Locks in order: the two season rows, then the copied athletes sorted by id (`lockAthlete`); no registration lock, so the 8.1 order holds.
- Before writing, inside the transaction, the planner runs again on fresh rows; when 2026-2027 is no longer the current season or 2027-2028 is already current: 409 "Sezonul curent s-a schimbat. Reîncarcă pagina." [W28]. Failure: "Acțiunea nu a reușit. Nimic nu a fost salvat." (8.1).
- After success: Grupe opens on 2027-2028, toast "2027-2028 este sezonul curent. 14 sportivi și 10 programe copiate." with "Anulează", 8 seconds, no X [DEC 2026-10-10 aloca-v2 (a)]. Forms: "1 sportiv", "1 program", "20 de sportivi"; a part with 0 is left out ("2027-2028 este sezonul curent. 10 programe copiate."); nothing copied: "2027-2028 este sezonul curent." [W29].
- "Anulează" (`POST /club/undo`, 8.2) reverts in one transaction: `isCurrent` back to 2026-2027, every membership and series the action created deleted, "Anulat: <linia>" on every subject it wrote to (3.7, W15); then `pingRevalidate()`.
- Limits, as W15: refused when anything changed since: a membership or group event of 2027-2028 written after the action, either season edited, or a registration filed under 2027-2028 after the action. Text "Nu se mai poate anula. Sezonul s-a schimbat între timp." [W15; W28]. Then corrections are made group by group.

### 10.6 Later, per group [DEC 2026-10-27 phase 4 new season 6; mock sezon-nou-a A9, A10]
On the group page (6), for a season that is not past (W5), with the previous season (label start year - 1) as `<anterior>`:
- Sportivi tab with 0 memberships in the season, and the group has members in `<anterior>`: empty state "Niciun sportiv în 2027-2028.", button "Copiază sportivii din 2026-2027" (secondary), hint "11 sportivi în 2026-2027, 1 inactiv nu se copiază." (the inactive part only when > 0; "2 inactivi nu se copiază"). "Adaugă sportivi" stays in the bar.
- Program tab with no series in the season, and the group has a series running on the last day of `<anterior>`: under "Program obișnuit" the empty state "Niciun program în 2027-2028.", buttons "Copiază programul din 2026-2027" and "Adaugă program" (both secondary), hint "În 2026-2027: Sâ și Du, 11:00, 50 min. Se repetă din 1 oct 2027." (program text as 6.3, several series joined by "; "; the date is the `seasonStart` 10.3 would use).
- No window: the click copies straight away, with the rules of 10.3 for this group, except the main flag: main only when the athlete has no group in the season yet (as "Adaugă sportivi", 6.2) [W31]. Every active member is copied (no unticking; "Scoate din grupă" after).
- Toasts with "Anulează", 8 s: "<n> sportivi copiați din 2026-2027." ("1 sportiv copiat din 2026-2027.") / "Program copiat din 2026-2027." Undo and its refusal as W15 (text "Nu se mai poate anula. Grupa s-a schimbat între timp.").
- Not offered when the source has nothing to copy (0 active members, no running series): the tab shows its normal empty state.

### 10.7 Rules
- Only the next season can be started (10.1), only from the current one; the season the copy reads from is always the current season at the moment of applying.
- Memberships written here follow 3.2 and 8.1 (one main per season, current rows only, locks).
- Series written here follow 3.3 (bounds inside one season, 366-day cap).
- No e-mail is sent by the new season or the per-group copies.

### 10.8 History lines [W32]
- Season 2027-2028: `Curent: "Nu" -> "Da"`, then "Copiat din 2026-2027: 14 sportivi în 2 grupe, 10 programe." Season 2026-2027: `Curent: "Da" -> "Nu"` [P3 1.6 field-change pattern].
- Group, per group with copied members: "Sportivi copiați din 2026-2027: <n>."; per copied series: "Program copiat din 2026-2027: Sâ și Du, 11:00, 50 min, din 1 oct 2027." (program text as 3.7).
- Athlete, per copied athlete: "Copiat în 2027-2028: Avansați (principală), Profesioniști." (the main group marked as in 6.2).
- Per-group copies (10.6) write the same group and athlete lines.
- Undo: "Anulat: <linia>" on every subject above (3.7).
- Actor: the admin who applied.

### 10.9 Routes (new file `src/api/club/routes/08-new-season.ts`)
Config `{ auth: false, policies: ['global::is-admin'], middlewares: [] }` on every route, like 8.2. Static paths are declared before parameter paths in each routes file (`/club/groups/unassigned` before `/club/groups/:documentId`, `/club/seasons/:documentId/start/preview` before `/club/seasons/:documentId/start`), and a source-reading test checks that order.
- `GET /club/seasons/:documentId/start`: step 2 data for the target season: current and target labels, target fee, per section the active groups with member counts, inactive counts, program texts, disabled reasons, and per group the athletes (name, age, status, 2026-2027 main group). 409 when the target is not the season right after the current one.
- `POST /club/seasons/:documentId/start/preview` body `{ groups: [{ groupId, copyMembers, excludeAthleteIds, copyProgram }] }`: step 3 counts and lines, computed by the apply planner without writing.
- `POST /club/seasons/:documentId/start` same body: applies (10.5); answers `{ data: { season, copied: { athletes, groups, series }, unassigned }, undo: { actionId } }`.
- `POST /club/groups/:documentId/copy-members` body `{ season }` and `POST /club/groups/:documentId/copy-program` body `{ season }`: 10.6; answer `{ data, undo: { actionId } }`. 409 when the tab is no longer empty.
- `GET /club/groups/:documentId?season=` (8.2) gains `copyFrom: { season, members, inactive, program: string[] } | null` for the empty states.
- Undo through `POST /club/undo` (8.2).
- Planners are pure functions in `src/club/groups/new-season/*`; the strings live in `src/club/groups/copy.ts` (11).

### 10.10 Tests and proof
- Unit (pure): next-season detection (label + 1, no current, no next); default ticks per section and the header tick with the mixed state; disabled boxes; child list main-group text ("ca în", "care nu se copiază"); Inactiv and anonymized never copied; unticked child per group; main rule (kept when copied, earliest `from` then order, existing 2027-2028 main kept, nothing twice); `from` and series bounds (later of season start and today, season end); only series running on the old season's last day; exceptions, one-off classes and Pauze not copied; title = current name; "Fără grupă" projection count and the source line order ("Înscriere Școală", "Din <sezon>", "Adăugat în Sportivi"); no `acs-membership` written; summary, tiles, preview lines and toast with number forms and parts left out at 0; the school-program warning; undo plan and every refusal (later membership, later group event, season edited, registration filed); per-group copies (empty-tab condition, main only without a group, toasts); history lines of 10.8.
- Store parity: the fake and Strapi stores implement the new-season reads and writes identically [P3 12].
- Routes: source-reading test for the admin guard on the five new routes and the static-before-parameter order.
- UI source-reading: the Sezoane button only on the next season's row and its click not opening the panel, the three steps and their buttons, step 1 rows, default ticks, "Vezi sportivii" rows, the preview lines, the toast with "Anulează", the two empty states with their buttons; copy module strings without em dash or middle dot.
- Boot check on a throwaway Postgres (with the 12 boot check data): add synthetic 2026-2027 memberships (one athlete in both sections, one Inactiv) and create 2027-2028 through `POST /club/seasons`; then:
  - `GET .../start` and `.../start/preview` match the planner;
  - apply with Club members and every program: exactly one season `isCurrent` (2027-2028); `/api/club/public` returns 2027-2028 and its fee; `/api/club/schedule` returns the copied school slots; public occurrences show dates of both seasons; no `acs-membership` row for 2027-2028; Inactiv athlete not copied; `GET /club/groups/unassigned?season=2027-2028` lists the school children with their 2026-2027 group proposed and "Din 2026-2027";
  - undo right away restores 2026-2027 as current and removes every new row; apply again, add a membership in 2027-2028, then undo: 409 with the refusal text;
  - per-group "copy-members" and "copy-program" on an empty group, and their undo.
- Diagrams: 02f gains the new-season flow; 03a notes that `Season.isCurrent` is switched here.

## 11. Errors and copy rules
- Romanian, terse, one line; no em dash; no middle dot (rows, columns, commas instead); straight quotes; empty values blank except where a mockup shows a word ("Fără antrenor", "Niciuna", "Fără program") [DEC 2026-10-26 gaps #1, #2; DEC 2026-10-27 phase 3 polish 3; m4 1; W16].
- No pills, no circles (count badges and day toggles square), no dashed or dotted lines; only the spinner is round [user rules for EduSport UI (no rounded shapes, no dashed lines); mock grupa-a day toggles].
- Shared failure text "Acțiunea nu a reușit. Nimic nu a fost salvat."; load failure "Nu am putut încărca datele." [P3C 7; DEC 2026-10-26 plan 3-4].
- Specific: "Există deja o grupă cu acest nume.", "Alege grupa." (Alocă or Mută without a group), "Alege cel puțin o zi." (series without days), "Data de sfârșit trebuie să fie după data de început.", "Nu se mai poate anula. Grupa s-a schimbat între timp.", "Evenimentul aparține grupei <grupă>. Se schimbă din pagina grupei." [W17]; new season: "Sezonul curent s-a schimbat. Reîncarcă pagina.", "Nu se mai poate anula. Sezonul s-a schimbat între timp." [W28].
- Every phase 4 string lives in one copy module (`src/club/groups/copy.ts`), as P3C [P3C 7].

## 12. Tests and proof
- Unit (pure): main group (first group main, Mută carries the flag, non-main Mută, add, remove and promotion, one main per season on current rows only), membership `from` / `to` and delete-instead-of-end, distinct counts, "Fără grupă" eligibility and proposal, program summary texts (list column, "Program obișnuit", history), series from the form (start + duration, Se aplică din, season end, 366-day cap), Schimbă split and exceptions carried, Șterge programul, date modes to exceptions (Ține removes, Anulează, Mută keeps duration), break scope (group and old scoala only, single classes too, override wins), occurrence notes, public filter, e-mail recipients (season, current members, dedupe, inactive and anonymized out), `notBefore` and undo cancel, undo planners for every action and the refusal, history lines of 3.7, gender-neutral copy.
- Website (frontend unit): one Școala tile per day with the state rule, time span and note; Club tiles; /inscrieri weekends unchanged for single-event data; notebook slots and the fallback.
- Migration planners on the production shape of `research.md`: cedilla rename, coach links (Club Avansați vs Școala Avansați *), series per group with 50 min and Sat + Sun, exceptions copied from the old scoala event, "Antrenament: Avansati" link, skipped names listed; a second apply writes nothing.
- Store parity: the fake and Strapi stores implement the new group, membership, schedule and break methods identically (P3 pattern) [P3 12].
- Routes: source-reading test that every new admin route uses `{ auth: false, policies: ['global::is-admin'] }` and the two public ones `auth: false` with no private fields; Public role 403 on the core routers (8.3).
- UI source-reading tests: menu entry, tabs and columns, "Fără grupă" hidden at 0, row menu items, move window without the abonament section, date panel fields and the unticked e-mail box, Pauze section, "Serii de cursuri" gone, copy module strings (no em dash, no middle dot).
- New season: unit, store, route, UI and boot-check proof in 10.10.
- Boot check on a throwaway Postgres: start the backend, load a copy of the production shape (the rows of `research.md`), run every migration step dry then `--apply` twice, then: Grupe totals, a group's Program dates, a cancelled date with an e-mail job queued to the test address, the undo cancelling it, public occurrences without a non-public group, `/api/club/schedule` matching today's notebook.
- Renders after implementation (no pre-build approvals): Grupe, "Fără grupă", group tabs, move window, Program panels, Pauze, the "Începe sezonul" window (3 steps), the empty-tab copy states, /cursuri/program, desktop and phone [DEC 2026-10-26 phase3ab (no pre-build renders)].
- Diagrams: 03a (Group.programPublic), 03b (exception `reason`, break scope, e-mail job), 02f (Pauze, Fără grupă) updated with the build.

## 13. Open items (for the user)
1. Proposed group for a child with no group (5.3, 10.3): last season's main group for now (W6) [DEC 2026-10-27 phase 4 spec review]; the club is asked later for a better rule from the form answers ("Sezonul trecut", age, level, school).
2. VM env: `REVALIDATE_FRONTEND_URL` / `REVALIDATE_SECRET` set on the VM? Without them the website updates within 5 minutes.
3. The notebook subtitle and the TEST tile "Weekend curs" keep an existing middle dot (CMS text); changing them is a separate copy decision [mockups README].
4. Membri echipă "Predă la" text now duplicates group coaches (W19); moving the Echipa page to the group coaches is a later change.

## 14. Conflicts between decisions (resolved here, flagged for the user)
- mock program-site A draws a Club notebook; m4 8 (same day, item list) shows the recurring schedule only for Școala: no Club notebook.
- DEC 2026-10-19 coach-schedule-app-v3 "Se repetă ... De la / Până la" vs the approved grupa-a form ("Se aplică din", no end date, m4 2): series end at the season end (W10).
- mock grupa-a A7 shows "Anunță părinții pe e-mail" ticked; DEC 2026-10-19 notif-q1-emails sends only when ticked per change: off by default.
- `10-spec.md` 3.6 adds a "Grupă" field to the admin calendar; p4 design "groups own their program": edited on the group page, the calendar opens the group panel.
- DEC 2026-10-26 gaps #2 (empty values blank) vs the approved "Fără antrenor" / "Niciuna" (m4 1, 2): the mockup words are used in those cells.
- mock grupa-a Istoric shows the actor "migrare"; DEC 2026-10-26 3b Q23 shows "Migrare": kept "Migrare".
- mock pauze-a caption "nothing on the website calendar" vs DEC 2026-10-03 (free and cancelled weekends shown): group dates in a break are not shown, the Școala day tile shows "liber" with the break name, as today.
- The P3 spec lists "making a season current" for phase 4; the 2026-10-27 phase 4 scope entry does not: resolved by DEC 2026-10-27 phase 4 spec review (designed now) and phase 4 new season 1 (section 10).
- mock sezon-nou-a A4 tile "Programe copiate ... din 1 oct 2027" assumes the season has not started; a season started mid-way copies from today, as every membership `from` (3.2): W27.
- Mockup toasts and history are feminine ("alocată", "mutată") for synthetic names; no gender is stored: neutral forms (W1). The older aloca-v2 toast "... a intrat în grupa ..." is replaced by the newer grupe-list wording.

## 15. Decided while writing

W1-W21 are approved [DEC 2026-10-27 phase 4 spec review]. W22 onward are for the user to overrule.

- W1 Gender-neutral copy: "Sportiv alocat în <grupă>: <nume>.", "Sportiv mutat în ...", "Mutat în <grupă>: <nume>." instead of the mockups' feminine forms.
- W2 "Mută" carries the row's main flag: from the main row the new group becomes main, from another row the main group stays.
- W3 "Adaugă și în grupă" is a window like the move window; "Adaugă sportivi" uses the athlete search, starts on "Fără grupă", tick several.
- W4 Ending a membership sets `to` to yesterday; one starting today or later is deleted; removing the main group promotes the remaining group with the earliest start.
- W5 Past seasons are read-only on Grupe and the group page; the group page uses the Grupe season.
- W6 "Fără grupă" = Nou or Activ athletes with no current group in the season; proposal = last season's main group if active; "Alocă toți" skips rows without a group; source "Înscriere Școală" or "Adăugat în Sportivi".
- W7 Parent e-mail box off by default, only for Anulează / Mută; jobs held 15 s so the toast can cancel them; one e-mail per address.
- W8 "Program public" on by default and for all migrated groups; null counts as on.
- W9 Group events: type `scoala` (school) or `curs` (Club), title = group name; website Club tiles show the group name.
- W10 Series run from "Se aplică din" to the season end; "Schimbă" splits the series and carries changed dates; "Șterge programul" ends it; one class has "Șterge ședința"; Durată 15 to 240 min by 5, default 50; Lunar adds "Săptămâna din lună".
- W11 "Grupă nouă" / "Editează grupa": Nume, Listă de prețuri, Antrenori, Program public; program added after on the Program tab; "Șterge grupa" only if never used.
- W12 Exception gets `reason`; Anulează writes `anulat`, Mută writes `override` with the series duration; moved dates show "Mutată de la <ora | data>".
- W13 Breaks cancel group dates (single classes too) and old Școala events only; a break date opens read-only; Pauze rows "Editează" / "Șterge".
- W14 Migration copies the old Școala series' days and Liber / Anulat dates to every school group series, then deletes the old series in a separate last step.
- W15 Undo only from the 8 s toast; writes "Anulat: <linia>"; refused after a later change to the same rows.
- W16 School tab label "Școala de patinaj" while one school, section names with 2+; "Fără program" in the Program column.
- W17 Group names unique per section ignoring case and diacritics; short error texts of section 11.
- W18 The general calendar opens group events in the group panel and stops offering "Școala de patinaj" for new events; old calendar routes refuse group events; `program.scheduleGroups` kept as the notebook fallback and rollback source.
- W19 Membri echipă "Predă la" text unchanged; group coaches are edited on the group.
- W20 Notebook from public, active Școala groups, slots by start and end, groups in their order; days not printed; new public route `/api/club/schedule`.
- W21 Website Școala tile per day: "curs" if any public school group holds class, else "anulat" if any is anulat, else "liber"; title "Școala de patinaj".
- W22 "Începe sezonul" is open to any admin (`global::is-admin`, like the other Sezoane routes); no decision limits it to Super Admin.
- W23 The button shows only with a current season and a season labelled one year after it; it can be used at any time, before or after the new season's start month.
- W24 The new season is applied in one transaction (flags, memberships, series, history), not per group, so it never stays half done; undo is one transaction too.
- W25 Main group in the copy: an existing 2027-2028 main group stays; else last season's main group if copied; else the copied group with the earliest `from`, then the group order. A group the athlete already has in the new season is not written twice.
- W26 Unticking a child in "Vezi sportivii" applies to that group only; child boxes are enabled only while the group's "Copiază sportivii" is ticked; "Copiază sportivii" disabled at 0 children; "Copiază programul" disabled with "Fără program" or "Are program în <next>".
- W27 Program copy: only series running on the old season's last day; new series from the later of the new season start and today to its end; title = current group name; exceptions, one-off classes, descriptions and Pauze not copied; biweekly weeks counted from the new start.
- W28 Apply refused with 409 "Sezonul curent s-a schimbat. Reîncarcă pagina." when the current season changed; undo refused with "Nu se mai poate anula. Sezonul s-a schimbat între timp.", also when a registration was filed under the new season after the action.
- W29 Preview and toast: lines and toast parts with 0 left out; number forms as 5.2; the fee part of step 1 left out without a fee; a warning when no school group gets a program (text from mock sezon-nou-b B7).
- W30 "Fără grupă" source line order: "Înscriere Școală" (registration of the season), then "Din <sezon>" (membership in the previous season), then "Adăugat în Sportivi".
- W31 Per-group "Copiază sportivii / programul din <sezon>": no window, copies at once with a toast and "Anulează"; every active member copied; main only when the athlete has no group in the season yet.
- W32 History lines of 10.8: season `Curent: "Nu" -> "Da"` / `"Da" -> "Nu"` and "Copiat din <sezon>: ..."; group "Sportivi copiați din <sezon>: <n>." and "Program copiat din <sezon>: ..."; athlete "Copiat în <sezon>: <grupe>".
- W33 Parent e-mail: "Următoarea ședință" is the group's next held class in the same season, left out when none; the "Motiv" line gets no second period; the payload carries the original start time and the next class.
