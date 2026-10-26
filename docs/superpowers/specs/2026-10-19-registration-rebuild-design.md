# Phase 2: Registration rebuild (design)

Status: approved in conversation 2026-10-19, section by section. Parent spec: `docs/architecture/10-spec.md` (phase 2 in section 7). Decisions with dates and companion screens: `edusport_frontend/docs/portal/DECISIONS.md` (entries up to 2026-10-19). Where this file and a dated decision disagree, the dated decision wins.

## 0. Goal

A parent registers online for the right school. Every registration gets a number. The family gets a correct PDF by e-mail. The club sees the registration in Înscrieri and in the Google Sheet. Season, period, membership fee and prices come from one place, the new Sezoane and Prețuri admin screens, which the website reads too.

Out of scope (later phases): confirming registrations and matching athletes (phase 3), groups and making a season current (phase 4), subscriptions and payments (phase 5), the Documente page (phase 8), forwarding to the club owner's Apps Script (blocked until the script can be edited).

## 1. Data and numbering (backend)

### 1.1 Registration fields
`registration-submission` gets the fields of the club's script form:

| Field | Type | Values |
|---|---|---|
| `relationship` | enum | `parinte`, `tutore`, `alta` (labels: Părinte, Tutore Legal, Alta (Vă rugăm specificați)) |
| `relationshipOther` | string | free text when `alta` ("Specificați calitatea (ex: Bunic, Frate)") |
| `childHeight` | integer | cm |
| `lastSeason` | enum | Nu a participat, Începători, Intermediari, Avansați |
| `membershipAnswer` | enum | `da` (Da, doresc să devin membru), `nu` (Nu, optez pentru tarife neafiliați); label "Membru A.C.S." |
| `subscriptionChoice` | json | `{ priceItemName, price, member }` frozen at submit |
| `source` | enum | Facebook, Instagram, Recomandare, Căutare Google, Altele |
| `sourceOther` | string | free text when Altele ("Vă rugăm să specificați de unde ați aflat de noi") |
| `gdprConsent`, `regulationsConsent` | boolean | shown as "Acord GDPR", "Acord Regulament" (Da/Nu) |

Existing fields stay. Old registrations keep and show their old values; new ones use only the new set. Option lists and wording are read from the live script form (2026-10-20); the form-config registry `inscriere` is rewritten to match.

### 1.2 Numbering at submit
- `registrationNumber` = `<season start year>-<4-digit sequence>`, using `formatRegistrationNumber` from `src/club/registration-number.ts`.
- Next number = highest existing sequence for that start year across all registrations, plus 1. The unique constraint on `registrationNumber` rejects a clash; the server retries with the next number, up to 5 times, then returns an error.
- Never edited; a registration moved to another season keeps its number; numbers are never reissued.

### 1.3 Season and school
- `seasonRef` = the Sezon with `isCurrent = true`. The legacy `season` text field is also set to its label, so the existing Înscrieri filters keep working.
- `section` = the school from the form link (`?scoala=<slug>`); with one school open, that school.
- If no current Sezon exists, submission is refused with a clear error, and the form shows registrations as closed.

### 1.4 Prices and notes
- `club.price-item` gets `tooltip` (text, optional).
- `section` gets `priceNotes` (json list of paragraphs, label "Notițe subsol").
- Prices are offered per audience, as in the script form: members see items with a member price, non-members see items with a non-member price (members: Abonament 6, Abonament 8, Abonament Avansați Gold 8; non-members: Abonament 6, Abonament 8, 1 ședință grup). An item with both prices missing is incomplete and hidden everywhere. The website and the form show every price list of the school.

### 1.5 One-time copy from old data
A script in the style of `migrate:club` (dry run by default, `--apply`, idempotent):
- tooltips from `pricing.tiers` onto matching price items (by name);
- the note "Disponibil doar pentru prima ședință" becomes the tooltip of "1 ședință grup" (notes become tooltips; the note field is dropped);
- `pricing.footerNotes` onto the Școala section's `priceNotes`;
- season period and fee: checked against the current Sezon; differences are reported, not overwritten.

### 1.6 Retired storage
`pricing` (Cursuri / Prețuri) and the season fields of `site-settings.registration` stay in the database, unread, editors removed. Deleted in a later cleanup. "Înscrieri deschise" (`site-settings.registration.open`) stays and keeps gating the form.

## 2. Admin screens

Approved designs: `phase2-designs-v1` and `phase2-card-band` (companion).

- **Prețuri** (replaces today's page; sidebar "Pagini site").
  - Tabs per school ("Școala de patinaj", "Club").
  - One EditorCard per price list.
  - Table columns: Nume, Tip, Ședințe, Membri, Non-membri. A `*` marks items with a tooltip.
  - Row click opens a Drawer with Nume, Tip, Ședințe, Preț membri, Preț non-membri, Tooltip ("Opțional" only as the hint, never as a placeholder) and "Șterge" (with confirmation).
  - "+ Adaugă preț" per card; "+ Listă nouă" (name and school).
  - An item with both prices missing: notice "Preț incomplet" (title only) and "Lipsă" badges. A single missing price is normal (shown as "-").
  - "Notițe subsol" card at the bottom of each school tab.
  - Club tab with no lists: "Nicio listă de prețuri" plus "+ Listă nouă".
- **Sezoane** (new; sidebar "Sistem", next to Setări site).
  - Table: Sezon, Perioadă, Taxă de membru, Curent.
  - Row opens a Drawer with Sezon, Început, Sfârșit (month and year) and Taxă de membru (RON).
  - "+ Sezon nou" creates a non-current season. Making a season current is phase 4.
- **Setări site**: the Înscrieri card keeps only "Înscrieri deschise".
- **EditorCard**: the band on the left of the header is removed everywhere (`box-shadow: inset 3px 0 0 var(--theme-primary)` in `src/admin/ui/styles.ts`).
- Every price, list, note or season change writes a history entry (who, when, old -> new). Prices already paid never change.
- Any admin can use these screens.
- New routes are admin-guarded with `global::is-admin`; content types keep `only: []` core routes.

## 3. Website and form

### 3.1 Public read
One public endpoint, read-only and cacheable, returns:
- the current season label and period;
- the membership fee;
- per school with a public page: name, slug, every price list with its items that have at least one price (name, kind, sessions, member and non-member price, tooltip), and `priceNotes`.

It returns no private data. Cursuri, the homepage, Regulament, Program and Înscrieri switch to it, with the same look as today.

### 3.2 Form
The 3 steps approved in `form-3steps-v1` option B, with the same questions, wording, order and options as the club's script form:
1. **Date înscriere**: the person filling in, then the child.
2. **Abonament**:
   - next month's dates from the school's calendar;
   - Membru A.C.S. Da/Nu;
   - the price box, member or non-member, from the public price lists, plus the annual membership fee in the member box;
   - an upsell for non-members, with savings computed from the prices;
   - the abonament choice, whose options depend on membership.
3. **Finalizare înscriere**: "De unde ați aflat", Acord GDPR, Acord Regulament, submit.

The honeypot stays. Fields only in today's website form are removed (Nivel, free-text Cum a aflat, the membership checkbox, extra CMS questions).

### 3.3 School choice
- The link takes `?scoala=<slug>`.
- With one open school, no choice is shown.
- "Alege școala" appears only with 2+ schools that have a public page, and the chosen school stays pinned across steps.

### 3.4 Success screen
- Shows the Nr. înscriere and "Documentele vor fi semnate la prima ședință de curs." (singular "Documentul va fi semnat ..." with only the Acord).
- Offers a PDF download and the WhatsApp channel link.
- The download uses a secret per-registration token that expires after 24 hours; after that, the PDF is in the e-mail.

## 4. PDFs, e-mail, Sheet

### 4.1 PDFs (pdfkit)
- Acord for every registration; Cerere de adeziune when `membershipAnswer = da`. Layouts are the approved `document-v4` and `adeziune-v2`, with text word for word, including the 2026-10-05 typo fixes and the 4-column legal footer.
- Values come from the registration, the Sezon (season, period, fee) and the association details.
- The Inter font is bundled under the OFL license.
- Before approval, each PDF is rendered and shown next to its approved mockup in the companion.
- Storage is a private folder outside `public/uploads`. The file name is `Nume_Prenume_Tip-document_Sezon.pdf` (no diacritics). It opens only through admin-guarded routes or the 24-hour token. `scripts/backup.sh` is extended to include the folder.
- Saving an edit to a registration rebuilds and replaces its PDF: the new file is written, then the old one deleted. No e-mail is sent.
- "Formulare goale" button in the Înscrieri page header: blank Acord and Cerere with season, period and fee printed, until the Documente page exists.

### 4.2 E-mail (Brevo)
- `email-job` content type: recipient, subject, kind, registration, status (`queued`, `sent`, `failed`), attempts, lastError, sentAt.
- The first attempt runs right after submit. The hourly cron retries. After 5 attempts the job is marked `failed` and a GlitchTip alert fires.
- Sent with the Brevo HTTPS API. The template and copy live in our code: design E1, table-based HTML plus a plain-text part, PDF(s) attached. Subject: "Înscriere înregistrată: <copil> (nr. <nr>)".
- Înscrieri panel: e-mail status, and "Retrimite e-mailul" with a confirmation that names the recipient and the documents, logged in history.
- With no Brevo key configured, jobs stay queued and nothing is lost.
- Outside production, every e-mail goes to one test address (setting), never to real parents.

### 4.3 Google Sheet
- The column plan is computed per season tab (`src/sheets/format.ts`, `matrix.ts`).
- The 2026-2027 tab gets Nr. înscriere, Școală, the new questions, Acord GDPR, Acord Regulament and Document (a link to the registration in the admin).
- Older tabs are untouched.
- The label "Membru A.C.S." is kept.

## 5. Rollout and tests

Waves:
1. Data, numbering, the public read, and the copy script.
2. In parallel: admin screens, the form, PDFs, Sheet.
3. E-mail.

Deploy as in phase 1: backup, dry run of the copy script, then apply.

Tests:
- concurrent numbering (clash and retry);
- hiding incomplete prices;
- the public read contains no private fields;
- per-tab Sheet columns;
- e-mail job states and retries;
- PDF text content;
- the 24-hour token (valid, expired, wrong registration);
- a browser test of the 3-step form;
- a visual check of each PDF against the mockup.

## 6. Needed from outside

- Brevo account and API key; DNS access for SPF and DKIM on the club domain; deliverability test (mail-tester 9/10 or better).
- The association's legal numbers for the footer (C.I.F., C.I.S., registry number, IBAN and bank branch).
- The WhatsApp channel link.
- The real Avansați Gold prices (entered in the new Prețuri screen).
