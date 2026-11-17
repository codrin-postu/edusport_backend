# Parcurs badges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the metal-tier Parcurs badges with one felt pin per milestone, add coach/admin awarded badges and athlete-to-athlete friendship pins, shown in the athlete portal, the coach portal and the admin Sportivi record.

**Architecture:** Counted pins stay computed on read (pure rule in `src/club/parcurs/`). Awards, friendship grants and friendship pins are three new Strapi content types behind one `ParcursStore` (Strapi impl + fake with parity). One read model `Parcurs` feeds all three screens; admin and coach variants add ids and giver names.

**Tech Stack:** Strapi 5 TS backend (Vitest), Next.js frontend (node --test, Playwright e2e mock), Strapi admin React.

**Spec:** `docs/superpowers/specs/2026-11-16-parcurs-badges-design.md` (incl. "Builder check answers"). Mockup: https://claude.ai/artifact/BaA2vTrJfDm4qAN33zHkvr

**Repos / base:** backend worktree `.claude/worktrees/polish` branch `feat/admin-polish` (or `main` once merged) -> new branch `feat/parcurs-badges`; frontend `.claude/worktrees/polish` `feat/polish` -> `feat/parcurs-badges`.

## Global Constraints

- Copy Romanian with diacritics; no em/en dash, no middle dot, no emoji, straight quotes. No helper text, no descriptions under buttons/options, no row labels.
- No rounded pills/circles, no dashed lines. Tests are behaviour only (no layout/colour/screenshot tests).
- No metal tiers anywhere: remove `Tier`, `tierWord`, tier aria texts, `--portal-tier-*` vars, the hexagon SVG in `Badge.tsx`.
- Count of a repeatable badge is shown as a plain number under the pin, only when > 1. Never "x N", never "de N ori".
- Earned pins in colour with date (dd/mm/yyyy, existing `date-format`); not earned: `filter: grayscale(1) opacity(.32)`.
- Names of other athletes shown as first name + last initial: "Ana P."; anonymised athlete shown as "Fost sportiv".
- Recipient gets no notification (no mail, no notice).
- Store pattern with fake parity; lock order per `CLAUDE.md` L19 (registrations > seasons > athletes > groups > events ...; each set sorted by id; re-read after lock).
- Competition source rule: skate-results if the profile has a slug, else hand-entered; never merged (`CompetitionResults` in `src/club/skate/pick.ts`).
- Admin area for routes: `adminRoute('club')`. Coach scope: athlete with a current-season membership in one of the coach's groups (`ownGroupIds` + `ownAthlete`, `src/club/portal/coach/ownership.ts`).
- Friendship grants (user, 2026-11-17): 2 pins per active athlete per month, only in months inside a season; unused pins lost at month end; created lazily for the current month, never for past months.
- Prezență only counts from `PARCURS_FROM = '2026-12-01'` (no backfill) (decided by Claude; edit the const at release if the release date differs).
- Vitest with `--maxWorkers=3`; Playwright `-c playwright.e2e.config.ts --workers=1`.

## Review Focus

1. Merge where the kept athlete had received a pin from the removed one (or the reverse): the pin would become self-given; expected: dropped. Test in Task 7.
2. Two concurrent "give" requests on the last remaining pin of a grant: expected exactly one succeeds, the other 409 `NO_PINS_LEFT`. Test in Task 5 (lock + re-read; fake test simulates the second call after the first commits).
3. Profile has no skate-results slug and no hand results, or results source down (`null`): counted pins Concursuri/Locul 1/Podium show 0, page still renders. Test in Task 2.
4. Coach awards a badge to an athlete who left the coach's groups (or on a past-season membership): expected 403. Test in Task 6.
5. Removing an explicit 2S when 1S was also explicitly given keeps 1S earned with its own date; removing 2S when 1S was only implied leaves 1S not earned. Test in Task 4.

---

## File Structure

Backend (`src/club/parcurs/`, new):
- `catalog.ts`: pin ids, labels, families, jump codes, friendship messages (static data).
- `counted.ts`: pure counted-pin rule (replaces `portal/sportiv/badges.ts`).
- `facts.ts`: gathers counted inputs from stores (moved out of `portal/sportiv/path.ts`).
- `store.ts`, `strapi-store.ts`, `__tests__/fake-store.ts`: awards, grants, pins.
- `awards.ts`: give/remove award, jump implication.
- `grants.ts`: ensure grants, remaining pins, give/delete friendship pin.
- `read.ts`: assembles `Parcurs` / `ParcursAdmin`.
- `lifecycle.ts`: delete, merge, export rows.
- `api-types.ts`: shared response types.

Content types (new): `src/api/badge-award`, `src/api/friendship-grant`, `src/api/friendship-pin`.

Frontend: `public/parcurs/*.png`; `src/lib/portal/parcurs.ts` (types + aria); `src/components/portal/parcurs/` (`ParcursView.tsx`, `PinCell.tsx`, `PinZoom.tsx`, `GiveDialog.tsx`, `AwardDialog.tsx`).

---

### Task 1: Pin catalog and counted rule

**Files:**
- Create: `src/club/parcurs/catalog.ts`, `src/club/parcurs/counted.ts`, `src/club/parcurs/api-types.ts`
- Test: `src/club/parcurs/__tests__/counted.test.ts`
- Delete after Task 2 switches callers: `src/club/portal/sportiv/badges.ts` and its test

**Interfaces:**
- Produces:
  - `type PinId = string` (equals the PNG basename, e.g. `'antrenamente-25'`, `'saritura-2lz'`, `'prietenie-07'`)
  - `type JumpCode = 's'|'t'|'lo'|'f'|'lz'|'a'`; `type JumpLevel = 1|2|3`
  - `const FRIENDSHIP_MESSAGES: readonly string[]` (15, index = design - 1)
  - `pinLabel(id: PinId): string`
  - `type CountedInput = { presenceDates: string[]; results: { date: string; placement: number|null }[] | null; firstMembershipStart: string|null; perfectMonths: string[]; firstPinGivenOn: string|null; today: string }`
  - `type PinView = { pin: PinId; label: string; earnedOn: string|null; count: number }`
  - `countedPins(i: CountedInput): { antrenamente: PinView[]; concursuri: PinView[]; membru: PinView[]; insigne: PinView[] }`

- [ ] **Step 1: Write failing tests** in `counted.test.ts`:
  - 0 presences: `antrenamente` = 5 pins (`prima-lectie`, `antrenamente-25/50/100/250`) all `earnedOn: null`.
  - 30 presence dates: `prima-lectie.earnedOn` = oldest date, `antrenamente-25.earnedOn` = 25th date sorted, `antrenamente-50.earnedOn` null.
  - results `null`: `concursuri-1..25` unearned; `locul-1` and `podium` count 0.
  - results placements `[1, 3, 2, null, 5]` with dates: `locul-1.count` 1, `podium.count` 3, `podium.earnedOn` = latest podium date; `concursuri-5.earnedOn` = 5th date.
  - `firstMembershipStart: '2023-09-15'`, `today: '2026-11-17'`: `membru-1..3` earned (dates `2024-09-15`, `2025-09-15`, `2026-09-15`), `membru-4` not; 20 years ago: 15 earned, no `membru-16`.
  - `perfectMonths: ['2026-10','2026-12']`: `prezenta.count` 2, `earnedOn` = `'2026-12-31'`.
  - `firstPinGivenOn: '2026-12-05'`: `manusi` earned on that date.
  - labels: `pinLabel('membru-1') === 'Membru 1 an'`, `pinLabel('membru-2') === 'Membru 2 ani'`, `pinLabel('saritura-2lz') === 'Dublu Lutz'`, `pinLabel('manusi') === 'Prima prietenie'`.
- [ ] **Step 2:** Run `npx vitest run src/club/parcurs --maxWorkers=3`, expect FAIL (module missing).
- [ ] **Step 3: Implement.** Labels (exact): `Prima lecție`, `25 de antrenamente`, `50 de antrenamente`, `100 de antrenamente`, `250 de antrenamente`, `Primul concurs`, `2 concursuri`, `5 concursuri`, `10 concursuri`, `25 de concursuri`, `Membru N an/ani`, `Locul 1`, `Podium`, `Prezență 100%`, `Prima prietenie`, `Steaua antrenorului`, `Test promovat`, jumps `Simplu|Dublu|Triplu` + `Salchow|Toe loop|Loop|Flip|Lutz|Axel`. Friendship messages verbatim from spec section 3. Insigne order: `locul-1, podium, prezenta, steaua, test, manusi` (steaua/test filled in Task 8; here `countedPins` returns the counted four).
- [ ] **Step 4:** Run tests, expect PASS.
- [ ] **Step 5:** Commit `feat(parcurs): pin catalog and counted pins`.

### Task 2: Counted facts from stores, sportiv path switched

**Files:**
- Create: `src/club/parcurs/facts.ts`
- Modify: `src/club/portal/sportiv/path.ts` (drop `seasonFacts`, call `countedFacts`), `src/club/portal/sportiv/api-types.ts` (`SportivPath.badges` removed; `parcurs: Parcurs` added in Task 8, here temporarily `counted`), delete `badges.ts` + test
- Test: `src/club/parcurs/__tests__/facts.test.ts`, update `src/club/portal/sportiv/__tests__/path.test.ts`

**Interfaces:**
- Consumes: `countedPins`, `CountedInput` (Task 1); `CompetitionResults.one(ref)` (`skate/pick.ts`), `skaterOf(c, athleteId)` (`portal/sportiv/competitions.ts`); `PresenceStore.sessions/attendances/lessons`; `mainGroupOn` (`presence/attendance/roster.ts`).
- Produces: `countedFacts(d: FactsDeps, athleteId: string, today: string): Promise<Omit<CountedInput,'firstPinGivenOn'>>` where `FactsDeps = { club: ClubStore; presence: PresenceStore; results: (athleteId: string) => Promise<{ date: string; placement: number|null; eventId: string }[] | null> }`.

- [ ] **Step 1: Failing tests** (seed with `sportiv-seed.ts` fakes):
  - presence dates: attendances with `grup || uscat` + lessons `state==='saved' && present` (same as today's `path.ts`).
  - `firstMembershipStart`: earliest `from` over the athlete's memberships, ignoring rows with `to < from` (cancelled) (decided by Claude: memberships have no cancelled flag).
  - perfect month rule: month counts when (a) month ended before `today`, (b) month >= `PARCURS_FROM` month, (c) main membership on the 1st of the month (`mainGroupOn` on `YYYY-MM-01`) and its `from <= YYYY-MM-01`, (d) main group has >= 4 saved sessions in the month, (e) athlete has a `grup` attendance at every one. Cases: 4 sessions all present -> counts; 3 sessions -> no; one absent -> no; joined on the 5th -> no; current month -> no.
  - results source returns `null` -> `results: null` (Review Focus 3).
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement; `PARCURS_FROM` lives in `src/club/parcurs/catalog.ts`. `path.ts` keeps `now/next/before`.
- [ ] **Step 4:** `npx vitest run src/club/parcurs src/club/portal/sportiv --maxWorkers=3` PASS; `npx tsc --noEmit -p .` ok.
- [ ] **Step 5:** Commit `feat(parcurs): counted facts, sportiv path uses pins`.

### Task 3: Content types and ParcursStore

**Files:**
- Create: `src/api/badge-award/content-types/badge-award/schema.json` (+ standard `controllers/routes/services` stubs like `src/api/lesson-cancellation`), same for `friendship-grant`, `friendship-pin`
- Create: `src/club/parcurs/store.ts`, `src/club/parcurs/strapi-store.ts`, `src/club/parcurs/__tests__/fake-store.ts`
- Test: `src/club/parcurs/__tests__/store.test.ts` (fake) and, if a PG test harness exists for stores (`*_PG_TEST`), a parity test alongside the notices one.

**Interfaces:**
- Schemas (all `draftAndPublish: false`, content-manager hidden):
  - `badge-award`: `athlete` (manyToOne athlete), `kind` enum `steaua|test|jump`, `jump` string nullable, `level` integer nullable, `givenByTeamMember` (manyToOne team-member, nullable), `givenByAdmin` (manyToOne `admin::user`, nullable), `givenOn` date.
  - `friendship-grant`: `athlete`, `source` string (`m:YYYY-MM`), `size` integer (2), `createdOn` date, `expiresOn` date.
  - `friendship-pin`: `grant` (manyToOne friendship-grant), `giver` (manyToOne athlete), `recipient` (manyToOne athlete), `design` integer 1..15, `givenOn` date.
- Row types: `AwardRow = { id; athleteId; kind: 'steaua'|'test'|'jump'; jump: JumpCode|null; level: JumpLevel|null; givenBy: { teamMemberId: string } | { adminId: string }; givenOn: string }`; `GrantRow = { id; athleteId; source; size; createdOn; expiresOn }`; `PinRow = { id; grantId; giverId; recipientId; design; givenOn }`.
- `ParcursStore`: `transaction<T>(fn: () => Promise<T>): Promise<T>`; `lockAthlete(id: string): Promise<void>`; `awards({ athleteId? })`; `addAward(row without id)`; `deleteAward(id)`; `grants({ athleteId })`; `addGrant(...)`; `pins({ giverId?, recipientId?, grantId? })`; `addPin(...)`; `deletePin(id)`; `dropForAthlete(athleteId)` (awards + grants + pins given or received); `moveForMerge(keptId, removedId)` (raw repoint, dedupe in Task 7).

- [ ] **Step 1:** Fake-store tests: add/list/delete for each row kind; `dropForAthlete` removes pins where athlete is giver OR recipient; filters work.
- [ ] **Step 2:** Run, FAIL. **Step 3:** Implement fake + Strapi store (UIDs as consts like `notices/strapi-store.ts` L5-6; `lockAthlete` = `SELECT ... FOR UPDATE` on athletes row, same helper as `athletes/locks.ts`). **Step 4:** PASS + tsc. **Step 5:** Commit `feat(parcurs): award, grant and pin storage`.
- [ ] **Step 6:** Restart backend (`restart-be.sh`) so Strapi registers the schemas; check the three tables exist.

### Task 4: Awards rule

**Files:** Create `src/club/parcurs/awards.ts`; Test `src/club/parcurs/__tests__/awards.test.ts`

**Interfaces:**
- `giveAward(s: ParcursStore, input: { athleteId; kind: 'steaua'|'test'|'jump'; jump?: JumpCode; level?: JumpLevel; by: AwardRow['givenBy']; today: string }): Promise<{ ok: true; id: string } | { ok: false; code: 'BAD_JUMP' }>`
- `removeAward(s, id): Promise<{ ok: true } | { ok: false; code: 'NOT_FOUND' }>`
- `awardPins(awards: AwardRow[]): { insigne: PinView[]; sarituri: PinView[][] }`: `insigne` = `steaua`, `test` (count + latest date); `sarituri` = 3 rows (level 1..3) of 6 jumps in order `s,t,lo,f,lz,a`.

- [ ] **Step 1: Failing tests:** jump without code/level or level outside 1..3 -> `BAD_JUMP`; steaua x3 -> count 3, latest date; explicit 2S on D -> `saritura-1s` and `saritura-2s` earned, 1S date D; Review Focus 5 both cases (remove explicit 2S with explicit 1S on E -> 1S earned on E; with 1S implied only -> 1S not earned); 3A implies 2A and 1A; explicit 1S on E plus 2S on D (D > E) -> 1S date E (own record wins).
- [ ] **Step 2-4:** FAIL, implement, PASS. **Step 5:** Commit `feat(parcurs): awarded badges and jump levels`.

### Task 5: Friendship grants and giving

**Files:** Create `src/club/parcurs/grants.ts`; Test `src/club/parcurs/__tests__/grants.test.ts`

**Interfaces:**
- `ensureGrants(s: ParcursStore, d: { athlete: { id; status; anonymizedAt }; seasons: SeasonRow[]; today: string }): Promise<void>`: only when the athlete is active (status `nou|activ`, not anonymised) and `today`'s month lies inside a season (`seasonBounds`, `src/club/groups/series.ts`): inside `s.transaction` + `lockAthlete(id)`, re-read grants; add one grant `source: 'm:YYYY-MM'`, `size: 2`, `createdOn` = 1st of month, `expiresOn` = last day of month, unless it exists. Idempotent; never creates past months.
- `pinsLeft(grants: GrantRow[], pins: PinRow[], today: string): number` (sum over unexpired grants of `size - pins on grant`).
- `givePin(s, input: { giverId; recipientId; design: number; today: string; activeIds: Set<string> }): Promise<{ ok: true; id } | { ok: false; code: 'SELF' | 'BAD_RECIPIENT' | 'BAD_DESIGN' | 'NO_PINS_LEFT' }>`: lock giver athlete, re-read; pick oldest unexpired grant (by `createdOn`, then id) with room and no pin to this recipient; none -> `NO_PINS_LEFT`.
- `deletePin(s, pinId): Promise<{ ok: true } | { ok: false; code: 'NOT_FOUND' }>` (the pin returns to its grant automatically through `pinsLeft`).
- `recipients(club: ClubStore, giverId): Promise<{ id: string; name: string }[]>`: athletes with status `nou|activ`, not anonymised, not the giver, name `"Ana P."`, sorted by name.

- [ ] **Step 1: Failing tests:** grant created once on repeated calls in the same month; new grant in the next season month; month outside every season (summer gap) -> no grant; inactive or anonymised athlete -> no grant; previous month's unused pins not counted in `pinsLeft` (grant ended); giving to self -> `SELF`; second pin to same recipient within one grant goes to next grant, or `NO_PINS_LEFT` when none; design 0 or 16 -> `BAD_DESIGN`; oldest grant used first; Review Focus 2: two sequential `givePin` on a grant with 1 left -> second `NO_PINS_LEFT`; after `deletePin` on unexpired grant the same recipient can receive again.
- [ ] **Step 2-4:** FAIL, implement, PASS. **Step 5:** Commit `feat(parcurs): friendship grants and pins`.

### Task 6: Read model and routes

**Files:**
- Create: `src/club/parcurs/read.ts`; Test `src/club/parcurs/__tests__/read.test.ts`
- Modify: `src/club/portal/sportiv/path.ts`, `src/club/portal/sportiv/api-types.ts`, `src/api/portal/controllers/sportiv.ts`, `src/api/portal/routes/04-sportiv.ts`, `src/club/portal/coach/athletes.ts` (or new `coach/parcurs.ts`), `src/api/portal/routes/02-coach.ts`, coach controller, `src/api/club/routes/05-athletes.ts`, `src/api/club/controllers/athletes.ts`
- Test: controller/route tests next to existing sportiv/coach/club ones

**Interfaces:**
- Types in `parcurs/api-types.ts`:
  - `type Parcurs = { antrenamente: PinView[]; concursuri: PinView[]; membru: PinView[]; insigne: PinView[]; sarituri: PinView[][]; received: ReceivedPin[]; pinsLeft: number }`
  - `type ReceivedPin = { id: string; design: number; message: string; from: string; givenOn: string }`
  - `type ParcursStaff = Parcurs & { awards: { id; pin: PinId; givenOn; givenBy: string }[]; given: (ReceivedPin & { to: string })[] }` (coach and admin; giver names full).
- `readParcurs(deps, athleteId, today): Promise<Parcurs>`: runs `ensureGrants`, then merges counted + award pins; `manusi` from earliest pin given by the athlete; `from` = `"Ana P."` or `"Fost sportiv"`.
- `readParcursStaff(deps, athleteId, today): Promise<ParcursStaff>`.
- Routes:
  - sportiv: `GET /athletes/:athleteId/path` returns `parcurs: Parcurs` in place of `badges`; `GET /athletes/:athleteId/pin-recipients`; `POST /athletes/:athleteId/pins` body `{ recipientId, design }` -> 201 `{ id }` / 409 code / 400 code.
  - coach: `GET /portal/coach/athletes/:athleteId/parcurs`; `POST /portal/coach/athletes/:athleteId/awards` body `{ kind, jump?, level? }`; `DELETE /portal/coach/athletes/:athleteId/awards/:awardId`. Gate: `visibleAthlete` + `ownAthlete` current season (Review Focus 4: 403).
  - admin: `GET /club/athletes/:documentId/parcurs`, `POST /club/athletes/:documentId/awards`, `DELETE /club/athletes/:documentId/awards/:awardId`, `DELETE /club/athletes/:documentId/pins/:pinId` (all `adminRoute('club')`, fixed paths before `/:documentId`).
  - Removing an award / pin of another athlete through a mismatching `:athleteId` -> 404.

- [ ] **Step 1: Failing tests:** sportiv holder without the athlete -> 403 (existing `withAthlete`); POST pins as athlete A of an account to A -> 400 `SELF`; coach on non-own athlete -> 403; coach awards and removes own award; admin deletes pin; response for an anonymised giver shows `"Fost sportiv"`.
- [ ] **Step 2-4:** FAIL, implement, PASS; tsc both configs. **Step 5:** Commit `feat(parcurs): parcurs read and routes for portal, coach, admin`. **Step 6:** restart backend.

### Task 7: Athlete lifecycle

**Files:** Create `src/club/parcurs/lifecycle.ts`; Modify `src/club/athletes/delete.ts` (`deleteInTransaction`), `src/club/athletes/merge.ts` (`applyMerge`), `src/club/personal-data/export-service.ts`; Test `src/club/parcurs/__tests__/lifecycle.test.ts` + extend delete/merge tests.

**Interfaces:**
- `dropParcurs(s, athleteId)`: called in delete after `removePresenceRows`.
- `mergeParcurs(s, keptId, removedId)`: called in merge after `mergePresenceRows`. Moves awards and grants; grants with the same `source` collapse into the kept grant (pins repointed); pins with `giverId === recipientId` after the move are deleted (Review Focus 1); duplicates (same giver, recipient, grant) dropped.
- Anonymise: no write (read shows "Fost sportiv").
- Export: `parcurs` section listing awards (pin label, date) and pins given/received (design message, other athlete "Ana P.", date).

- [ ] **Step 1: Failing tests** for each case above, including Review Focus 1. **Step 2-4:** FAIL, implement, PASS. **Step 5:** Commit `feat(parcurs): delete, merge and export cover parcurs rows`.

### Task 8: Pin assets and admin Parcurs tab

**Files:**
- Create: `public/parcurs/*.png` (backend, served by Strapi at `/parcurs/<id>.png`)
- Modify: `src/club/sportivi/record-view.ts` (`RecordTab` + `'parcurs'`, `TAB_IDS`; not in `ANONYMIZED_TABS`), `src/admin/dashboard/sportivi/AthleteRecordPage.tsx`, `src/admin/dashboard/sportivi/api.ts`
- Create: `src/admin/dashboard/sportivi/ParcursTab.tsx`
- Test: `record-view` test for the tab list.

- [ ] **Step 1:** Copy the 64 PNGs from `/private/tmp/claude-501/-Users-codrin-Documents-Programming/7f5c4386-1f07-4c19-944f-a16f49a53ebd/scratchpad/badges/pins/` resized to max 256 px long edge (`sips -Z 256`); total size must drop well under 3.9 MB; check `ls public/parcurs | wc -l` = 64.
- [ ] **Step 2:** Failing test: `recordTabs` includes `parcurs` for a normal athlete, not for an anonymised one.
- [ ] **Step 3:** Implement tab: sections in the order Antrenamente, Concursuri, Membru, Insigne, Sărituri (3 rows), Prietenie (Primite / Date). Actions: "Acordă" (Select: Steaua antrenorului, Test promovat, Săritură; jump + level Selects when Săritură), remove icon button (trash, tooltip "Șterge") on each award and pin. Same pin cell look as the mockup (img 96 px high, date under, count number only when > 1).
- [ ] **Step 4:** PASS, tsc, `npm run build` of admin ok. **Step 5:** Commit `feat(admin): Parcurs tab on the athlete record`.

### Task 9: Frontend shared Parcurs view

**Files:**
- Create: `public/parcurs/*.png` (same 64 resized files), `src/lib/portal/parcurs.ts` (types mirroring Task 6, `pinAria(p: PinView): string`), `src/components/portal/parcurs/{ParcursView,PinCell,PinZoom}.tsx`
- Delete: `src/lib/portal/sportiv-badges.ts` + `scripts/portal/sportiv-badges.test.mjs`, tier SVG in `(sportiv)/.../parcurs/_parts/Badge.tsx`, `BadgeZoom.tsx`, `--portal-tier-*` vars in `src/styles/portal-theme.css`
- Test: `scripts/portal/parcurs.test.mjs`

**Interfaces:** `ParcursView({ data: Parcurs | ParcursStaff, actions?: ReactNode, onRemove?: (kind: 'award'|'pin', id: string) => void })`.

- [ ] **Step 1: Failing tests** (`node --test`): `pinAria({label:'Podium', count:3, earnedOn:'2026-11-07'})` -> `'Podium, 3'`; unearned -> `'<label>, blocat'`; count 1 shows no number.
- [ ] **Step 2-4:** FAIL, implement per mockup (sections Antrenamente, Concursuri, Membru, Insigne, Sărituri 3x6 grid on desktop / 3 columns on phone, Prietenie; zoom dialog with pin, label, count, date; friendship zoom shows message and "from, date"; Esc and backdrop close). PASS; `npx tsc --noEmit`.
- [ ] **Step 5:** Commit `feat(portal): shared felt-pin Parcurs view`.

### Task 10: Athlete portal Parcurs page and giving

**Files:** Modify `src/app/(sportiv)/sportiv/(app)/[athleteId]/parcurs/page.tsx`, `src/lib/portal/sportiv-types.ts`, `src/lib/portal/sportiv-routes.ts` (+ `GET ${A}/pin-recipients`, `POST ${A}/pins`), `scripts/portal/sportiv-routes.test.mjs`, `tests/e2e/mock-sportiv.mjs`; Create `src/components/portal/parcurs/GiveDialog.tsx`; e2e spec `tests/e2e/sportiv-parcurs.spec.ts`.

- [ ] **Step 1: Failing tests:** route allowlist accepts both new routes and rejects `DELETE ${A}/pins/x`; e2e: button "Dă o insignă (2)" visible with 2 left, hidden with 0; give flow: pick design 5, recipient "Ana P.", "Trimite" -> button shows "(1)".
- [ ] **Step 2-4:** FAIL, implement (dialog per mockup: 15 designs in a 5-column grid, message under, recipient Select with placeholder "Selectează", buttons "Renunță" / "Trimite"; on 409 show the server code mapped to one short line: `NO_PINS_LEFT` -> "Nu mai ai insigne."), PASS.
- [ ] **Step 5:** Commit `feat(sportiv): Parcurs with felt pins and friendship giving`.

### Task 11: Coach portal Parcurs and awarding

**Files:** Modify `src/app/(antrenor)/antrenor/(app)/sportiv/[id]/AthleteCard.tsx`, `src/lib/portal/coach-routes.ts` (+ `GET /athletes/${ID}/parcurs`, `POST /athletes/${ID}/awards`, `DELETE /athletes/${ID}/awards/${ID}`), `scripts/portal/coach-routes.test.mjs`, `tests/e2e/mock-portal.mjs`; Create `src/components/portal/parcurs/AwardDialog.tsx`; e2e `tests/e2e/coach-parcurs.spec.ts`.

- [ ] **Step 1: Failing tests:** allowlist cases; e2e: coach opens athlete, Parcurs section shows received friendship pins; "Acordă" -> Săritură, Lutz, Dublu -> `saritura-2lz` and `saritura-1lz` earned; remove award returns them to grey.
- [ ] **Step 2-4:** FAIL, implement (collapsible section header like the competitions block, `CollapseHeader`), PASS.
- [ ] **Step 5:** Commit `feat(antrenor): athlete Parcurs with awards`.

### Task 12: Clean-up and full check

- [ ] Grep both repos for `tierWord|bronze|platinum|Sezon complet|portal-tier` -> no hits outside git history.
- [ ] Backend `npx vitest run --maxWorkers=3`, both tsc configs; frontend `npx tsc --noEmit`, `node --test scripts/**/*.test.mjs`, e2e touched specs with `--workers=1`.
- [ ] Manual pass on desktop/tablet/phone for the three screens (screenshots to the user before merge).
- [ ] Commit any fixes `chore(parcurs): remove tier leftovers`.
