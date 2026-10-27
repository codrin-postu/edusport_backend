# Phase 3C: personal data (export, anonymize, yearly list)

Status: v1.1, approved by the user (2026-10-27): default 5 years, never automatic, a dashboard notification.
Parent: `docs/architecture/10-spec.md` 3.3 and `13-roadmap.md` (phase 3, part C). Builds on `2026-10-26-athletes-registrations-design.md` (3A/3B).
Precedence: a dated entry in `edusport_frontend/docs/portal/DECISIONS.md` wins over this file.
Decisions behind this spec: DEC 2026-10-19 admin-q2-data; DEC 2026-10-27 "phase 3C personal data" (1 to 7 and the Claude low-impact line).

## 1. Purpose and success

Answer a parent's request for their child's data in a few minutes, and let the club remove personal data it no longer needs, without breaking group counts, A.C.S. history or (from phase 5) payment totals. Nothing is ever deleted or anonymized automatically.

Success:
- "Exportă datele" gives one ZIP the admin can send to the parent.
- After "Anonimizează", a database search for the child's name, phone, e-mail or birth date finds nothing; counts per group and season are unchanged.
- Once a year the admin sees how many athletes are inactive past the retention period and can anonymize them from one list.

Out of scope: automatic deletion; anonymizing registrations that never became an athlete (an unlinked registration is handled by the existing registration delete); parents' own portal requests (phase 7); payment data (phase 5 adds its fields to the rule in section 5).

## 2. Data

- `athlete.status` gains `anonimizat` (enum `nou | activ | inactiv | anonimizat`); new field `anonymizedAt` (datetime, null otherwise).
- `site-settings` gains `personalData` (json): `{ retentionYears: number (default 5, min 1, max 20), reviewHiddenUntilSeason: string | null }`. Edited in Setări site as "Ani până la anonimizare" (number). The admin may change it when the lawyer or accountant answers (09-open-items).
- History actions: `data-exported` ("Date exportate"), `data-anonymized` ("Date anonimizate"). Neither line holds personal data; `actor` and `at` as usual.
- No schema change on registrations, e-mail jobs, history entries: anonymization writes null / fixed placeholders into existing fields.

## 3. "Exportă datele" (any admin) [DEC 3C-1, 3C-6]

- Place: the athlete record "..." menu, item "Exportă datele". Not offered for an anonymized athlete.
- Route: `GET /api/club/athletes/:documentId/export`, `global::is-admin`. Answers `application/zip`, file name `date-<slug-of-name>-<YYYY-MM-DD>.zip`. 404 for unknown or anonymized athletes.
- ZIP content:
  - `rezumat.pdf`: built with the existing PDF tools (`src/club/documents/pdf/*`, same fonts and frame as the Acord). Sections: Sportiv (name, birth date, contact name, phone, e-mail, status, notes); Grupe pe sezoane (season, group, main); Membru A.C.S. pe sezoane; Înscrieri (for each linked registration: number, season, school, status, every answer as shown in the panel's Date tab, consents with their values, submitted at); Istoric (date, actor, text, for the athlete and its registrations); generated at, by whom.
  - For each linked registration, its stored PDFs as they are today (Acord, Cerere de adeziune), under `inscrieri/<registration number>/`.
- ZIP built in memory with `fflate` (added as a direct dependency). A registration whose PDF file is missing is listed in `rezumat.pdf` as "Document indisponibil" instead of failing the export.
- After a successful export: history line `data-exported` on the athlete. If the history write fails the export is still delivered (logged).
- Admin UI: the download goes through the detached admin client (same pattern as `downloadPdf`), toast "Datele au fost exportate." on success, the shared error text on failure.

## 4. "Anonimizează" (Super Admin only) [DEC 3C-2, 3C-6, 3C-7, Claude low-impact]

- Place: the athlete record "..." menu, item "Anonimizează", shown only to a Super Admin and only when the athlete is not already anonymized. Also the bulk action in section 5.
- Confirmation (no undo): title "Anonimizezi datele sportivului?"; message lists what is removed and what stays, in short lines: "Se șterg: numele, data nașterii, contactul, telefonul, e-mailul, notele, datele din înscrieri, documentele PDF, adresele din coada de e-mail, valorile vechi din Istoric și profilul public." / "Rămân: grupele pe sezoane, statusul A.C.S. și numărul de înscrieri." / "Acțiunea nu poate fi anulată."; button "Anonimizează".
- Route: `POST /api/club/athletes/:documentId/anonymize`, policy `global::is-super-admin` (new: valid admin JWT whose user has the `strapi-super-admin` role). 404 unknown, 409 already anonymized.
- One transaction, `lockAthlete` first (from the phase 3 polish round), then:
  - Athlete: `name` "Sportiv anonimizat", `firstName`/`lastName`/`birthDate`/`contactName`/`phone`/`email`/`notes` null, `dataIncomplete` false, `status` `anonimizat`, `anonymizedAt` now.
  - Every registration linked to the athlete (any season): `childName` "Anonimizat", `parentName`, `email`, `phone`, `childBirthDate`, `childBirthDateParsed`, `childHeight`, `shirtSize`, `priorExperience`, `expectations`, `relationshipOther`, `sourceOther`, `internalNote`, `lastSeason`, `extra` null; `submissionKey` null. Kept: `registrationNumber`, `season`, `seasonRef`, `section`, `status`, `archived`, `submittedAt`, `level`, `relationship`, `howHeard`/`source`, `membershipAnswer`, `subscriptionChoice`, the consent booleans, `athlete` link, `confirmation` (its stored field values are blanked like history, see below).
  - Registration PDFs: the folder `registrations/<documentId>/` under `PRIVATE_FILES_DIR` deleted for each linked registration. Done after the commit (files are outside the database); a failure is logged and retried by the next anonymize or a startup sweep of registrations whose athlete is anonymized.
  - E-mail jobs of those registrations: `recipient` null; jobs not yet sent set to `cancelled` (new status value if missing).
  - History entries whose subject is the athlete or one of its registrations: inside `changes`, every value under a personal key (the athlete and registration personal fields above, plus `name`, `contactName`, `childName`, `parentName`) replaced by null; other keys, `action`, `actor`, `at` kept. Same for personal values inside each registration's `confirmation` record.
  - Public profile: deleted with both draft and published rows, through the existing delete path; its slug is not added to anyone's `previousSlugs` (the address shows "not found").
  - Possible-duplicate rows involving the athlete: removed.
  - Kept: group memberships, A.C.S. rows, counts; from phase 5, payment totals.
  - History line `data-anonymized` on the athlete.
- After commit: refresh matches via `safely` (the anonymized athlete must never match a new registration; matching skips status `anonimizat`).
- An anonymized athlete: hidden from the Sportivi list unless the status filter "Anonimizat" is on; its record is read-only (no "Editează", no "..." menu); it never appears in confirm-window search or matching; it still counts in per-group and per-season counts.

## 5. "Inactivi de peste N ani" [DEC 3C-3, 3C-4, 3C-5]

- Rule (pure function, tested): an athlete qualifies when its status is not `anonimizat` and its last active season is at least N seasons before the current season, where the last active season is the latest of: seasons with a group membership, seasons of linked registrations. From phase 5, attendance and payment seasons join this list (one place to extend). An athlete with no activity at all qualifies when its record is older than N years (`createdAt`).
- Sportivi list: new filter section "Date personale" with one option "Inactivi de peste N ani" (N from settings), and the status filter gains "Anonimizat". With the inactivity filter on, rows get checkboxes and a bulk bar "Anonimizează (k)" shown only to a Super Admin.
- Bulk: `POST /api/club/athletes/anonymize` body `{ documentIds: string[] }` (max 200), `global::is-super-admin`; each athlete in its own transaction (same steps as section 4); answer `{ anonymized, skipped, failed }`; toast "k sportivi anonimizați." plus counts of skipped/failed when not zero. Confirmation shows k and the same lists as section 4.
- Dashboard: a Notice "N sportivi inactivi de peste N ani." with link "Vezi lista" (opens Sportivi with the filter), shown while the count is not zero and `reviewHiddenUntilSeason` is not the current season; a Super Admin can choose "Ascunde până la sezonul următor" (writes the current season label).

## 6. Access

- New policy `src/policies/is-super-admin.ts`: same JWT check as `is-admin`, then loads the admin user with roles and requires code `strapi-super-admin`.
- Client: the admin UI reads the current user's roles (Strapi admin `useAuth`/`users/me`) to hide Super Admin actions; the server check is the authority.

## 7. Errors and copy

- Shared error text for failures ("Acțiunea nu a reușit. Nimic nu a fost salvat."), via the `guarded` wrappers.
- Romanian copy, no em dash, no middle dot, straight quotes, terse. All strings in one copy module for 3C.

## 8. Tests and proof

- Pure: anonymize planner (every personal field emptied, every kept field untouched, registrations of other athletes untouched), history/confirmation scrubbing, inactivity rule (boundaries: exactly N seasons, no activity, created recently), settings reader (default 3, bounds).
- Store parity: fake and Strapi store implement the new methods identically (lockAthlete reused).
- Routes: source-reading test that export uses `global::is-admin` and both anonymize routes `global::is-super-admin`.
- UI: source-reading tests for menu items, role gating, confirmation copy, bulk bar, dashboard notice.
- Boot check on a throwaway Postgres: export then unzip and read `rezumat.pdf` text; anonymize then a SQL search for the seeded name, phone, e-mail and birth date across all tables returns nothing; PDF folder gone; counts per group and season unchanged; a non-super admin gets 403 on both anonymize routes.

## 9. Open with the club

- The retention period itself (09-open-items): the setting makes the number changeable; the default is 5 (user, 2026-10-27) until the lawyer or accountant answers.
- The public privacy page (`/protectia-datelor`) says nothing about a number of years; aligning it is a copy change for the club, not part of this phase.
