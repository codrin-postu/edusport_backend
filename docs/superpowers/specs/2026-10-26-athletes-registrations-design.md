# Phase 3A + 3B: Înscrieri confirmation and Sportivi (design)

Status: v2, all decisions folded in; approved by the user to build ("let's begin work", 2026-10-26); renders reviewed after implementation.

Parent spec: `docs/architecture/10-spec.md` (phase 3, split into 3A / 3B / 3C in `13-roadmap.md`). Precedence: a dated entry in `edusport_frontend/docs/portal/DECISIONS.md` wins over this file and over the parent spec; a later dated entry wins over an earlier one; prototype v5 wins over older mockups [DEC 2026-10-26 phase3a-r5 m1; 3b Q31].

Citation keys:
- `[r1 q10]` etc.: DECISIONS 2026-10-26 entries phase3a-r1, r1b (inside r1), r2, r2b, r3, r3b, r4, r5, with the item code.
- `[3b Q20]`: DECISIONS 2026-10-26 "phase3b, decided by Claude (low impact)", question number. These were also decided by Claude.
- `[3b s4]`: DECISIONS 2026-10-26 "phase3b-important" (user), item code.
- `[DEC 2026-10-26 gaps #8, decided by Claude]`: DECISIONS 2026-10-26 "phase3ab spec gaps, decided by Claude (low impact)", numbered by the gap list of draft v1.
- `[DEC 2026-10-26 d17]`: DECISIONS 2026-10-26 "phase3ab-spec-important" (user), item code.
- `[pattern, decided by Claude]`: applied in this draft by following an existing rule or pattern; each one is listed in section 13.
- `[DEC <date> <screen>]`: older DECISIONS entries.
- `[SPEC x.y]`: `10-spec.md`. `[P2 x.y]`: `2026-10-19-registration-rebuild-design.md`. `[RB2 n]`: `docs/architecture/12-phase2-deploy-runbook.md`, step n.
- `[proto v5]`: `mockups/screens/prototype-registrations-v5.html` + `mockups/proto_js.js`; screenshots in `mockups/screens/phase3a-ref-v1/` and `phase3b-ref-v1/`.
- `[cs <screen> <option>]`: companion screen in `edusport_backend/.superpowers/brainstorm/80180-1792422211/content/`, chosen option.
- `[map 3A Rn]` / `[map 3B Dn]`: `.superpowers/phase3a-decision-map.md` / `phase3b-decision-map.md` (code facts only).

Copy convention: in quoted copy, "->" is the arrow "→" the UI shows, as in the existing Istoric lines [DEC 2026-10-06 open-questions-v1 Q1; pattern, decided by Claude]. Empty values are left blank everywhere (comparison table, Vârstă, Contact, Istoric); no em dash [DEC 2026-10-26 gaps #2, decided by Claude]. No middle dot in any copy [DEC 2026-10-26 gaps #1, decided by Claude].

## 0. Goal and scope

An admin opens a registration, sees whether the child is already in the club, confirms it in one window (existing or new athlete, group, A.C.S. status) and lands on one private athlete record. The admin keeps one private list of every athlete, with the website profile as a tab of the record.

In scope:
- 3A Înscrieri: matching, list, panel tabs, Editează, confirmation window, move to another school [13-roadmap; SPEC 3.2].
- 3B Sportivi: private list, athlete record with tabs Date | Profil public | Documente | Istoric, Marchează inactiv / activ, delete, merge, possible duplicates, Adaugă sportiv, menu section [13-roadmap; SPEC 3.3; 3b s1 to s12; DEC 2026-10-26 d12, d39].
- Shared admin UI used by both [r1 q29; SPEC 3.13].
- Website: birth date picker on /inscrieri [r5 m3]; redirect of a profile address removed by a merge [DEC 2026-10-26 d39].
- Phase 2, 3A and 3B go live in ONE deploy window, so record links work from day one [r3 c3; DEC 2026-10-26 d19].

Out of scope:
- 3C personal data: "Inactivi de peste 3 ani", "Exportă datele", "Anonimizează" [13-roadmap; DEC 2026-10-19 admin-q2-data].
- Parent access, "Invită părintele", access list: phase 6 [13-roadmap; DEC 2026-10-18 flows-v1].
- Review of "nou" athletes (added by coaches): phase 6 [3b s7].
- Groups page, "Fără grupă" button, moves, schedule text next to groups, making a season current: phase 4 [SPEC 3.4, 3.5, 3.6; DEC 2026-10-26 gaps #28, decided by Claude].
- Record tabs "Grupe și abonament" and "Plăți", subscriptions, payments, A.C.S. "Da" after the fee: phases 4 and 5 [SPEC 3.8; 3b s4].
- Document uploads, Documente page: phase 8 [3b s11; SPEC 3.9].
- E-mail at confirmation: not sent [DEC 2026-10-06 open-questions-v2 Q3; SPEC 3.10].
- Google Sheet and CSV: unchanged [r2 l8].
- Bulk confirm: not offered [r4 e4].
- Sportivi list export: none in 3B (export of one athlete is 3C) [3b Q28].

## 1. Data model changes

### 1.1 Athlete: one full-name field
- `athlete.firstName` (required) + `lastName` are replaced by ONE full-name field, labelled "Nume și prenume" [r3 c4; proto v5 record Date tab]. Technical field name: plan.
- Migration of existing athletes (about 60, all created from public profiles in phase 1, split by `splitPersonName`, last word = lastName): full name = `firstName + " " + lastName`, trimmed, repeated spaces collapsed [r3 c4; map 3B D1]. Idempotent, dry run first [DEC 2026-10-19 build-q3-final-review (1)].
- The old first/last values must still be readable when this migration runs at deploy (11, step 7); the plan picks how [pattern, decided by Claude].
- Code that writes or reads first/last changes: `src/club/migrate/plan.ts::planAthletes`, `names.ts::splitPersonName` use for athletes, tests `names.test.ts`, `plan.test.ts` [map 3B D1].
- No "Calitate" on the athlete; it stays on each registration [3b Q19].
- Fields stay: `birthDate`, `contactName`, `phone`, `email`, `status`, `dataIncomplete`, `notes`, `publicProfile`.
- `dataIncomplete` is recomputed on every save and at confirmation: complete = name, birth date, contact person, phone AND e-mail [DEC 2026-10-06 open-questions-v2 Q6; 3b Q20; r4 e7].
- Possible-duplicate flag: a pair of athletes flagged at deploy, removed for good by "Nu e același copil", by a merge of the pair or by deleting either athlete [DEC 2026-10-26 d12; pattern, decided by Claude]. Storage: plan.

### 1.2 Public profile name and address
- The public profile (`sportsperson`) keeps its own table; only it is served to the website; contact data and birth date never go there [SPEC 2 rule 1; DEC 2026-10-11 athlete-model-v1].
- The profile name always follows the athlete name; the web address (`slug`) never changes after creation, so old links keep working [3b s2].
- A name change updates the profile name directly, without touching other unpublished draft changes of the profile [DEC 2026-10-26 gaps #38, decided by Claude].
- When a merge deletes the second public profile, its web address redirects to the kept profile's address [DEC 2026-10-26 d39]. Storage of the old address: plan.
- Website pages, sitemap, competition links and homepage spotlight keep reading `sportsperson.name` / `slug`; Competiții and Pagina principală pickers keep picking public profiles [map 3B D2; 3b Q27].

### 1.3 Registration
- `athlete` relation (exists, manyToOne) is set on confirm, removed by undo and by deleting the athlete, and moved by merge [SPEC 3.2; r4 e1, e6].
- Match result is saved on the registration so the list line and filter need no recomputation [r1 q6]. It holds at least whether there is a "Sportiv existent" match (Sigur or Probabil) and the candidate athlete for the card and the window. Field names: plan.
- `status`: "Confirmat" is set only by "Confirmă înscrierea"; "Contactat" by its footer button or the status menu; "Nou" and "Respins" by the status menu; old "Confirmat" rows without an athlete keep the status and still show "Confirmă înscrierea" [r2 l6; DEC 2026-10-26 gaps #20, decided by Claude].
- `section` is rewritten by "move to another school"; the number never changes (one numbering across schools) [r4 e12; DEC 2026-10-19 multi-school-registration-v1]. The frozen `subscriptionChoice` stays as it is (it is the parent's wish) [DEC 2026-10-26 gaps #27, decided by Claude].
- `childBirthDate` stays a text field. New website registrations store the picked date as ZZ.LL.AAAA [r5 m3; DEC 2026-10-26 gaps #43, decided by Claude]. Older free-text values are readable in these forms: ZZ.LL.AAAA, Z.L.AAAA, ZZ/LL/AAAA, ZZ-LL-AAAA, AAAA-LL-ZZ, "14 martie 2016" [DEC 2026-10-26 gaps #24, decided by Claude]; any other value is unreadable and blocks confirmation (4.7) [r4 e11].
- Edits to a registration after confirmation are not copied to the athlete [DEC 2026-10-26 gaps #26, decided by Claude].
- `submissionKey` (phase 2): a repeat of the same draft within 10 minutes creates no new registration, so it is never matched or confirmed twice [DEC 2026-10-24 phase2-q7 d2]. Later repeats are separate registrations and match the same athlete (rule in 4.5) [r4 e5].

### 1.4 Group membership and A.C.S. status written at confirmation
- `group-membership` (athlete, group, season, isMain, from): written only when a group is picked and the registration's season is still running (4.3) [r3 c9, r3b c9; SPEC 3.2].
- `from` = the confirmation date, or the season start when confirmed before the season starts [DEC 2026-10-26 gaps #29, decided by Claude].
- `isMain`: the picked group is main when the athlete has no group that season; otherwise main only if "Grupă principală" is ticked [r3b c8; cs phase3a-r3b A]. Exactly one main group per athlete per season stays true [SPEC 2 rule 2].
- `acs-membership` (athlete, season, state): wish "Da" on the form writes "În așteptare" for the registration's season; "Da" only when the fee is paid (phase 5) [r1 q1b; DEC 2026-10-19 money-q1-member, membership-season-v1].
- Wish "Nu" writes nothing; an existing A.C.S. status for that season is never lowered by a confirmation [DEC 2026-10-26 gaps #30, decided by Claude].
- Nothing is written twice: a group or A.C.S. status already present for that athlete and season is left as it is [r4 e5].
- No subscription is created; the form's abonament choice is only the parent's intent [DEC 2026-10-05; SPEC 3.2].

### 1.5 Athlete status
- Values `nou` / `activ` / `inactiv`, shown as "Nou", "Activ", "Inactiv" [3b Q14].
- Inactive athletes are hidden from lists unless the Status filter asks for them, history kept; reactivated when a registration is matched and confirmed [DEC 2026-10-18 states-v2; SPEC 3.3; 3b s6].
- A matched "nou" athlete becomes "activ" on confirmation [r4 e7].
- Created by "Sportiv nou" in the window: "activ" [SPEC 3.3; DEC 2026-10-18 states-v2]. Created by "Adaugă sportiv": "Activ" [3b s10].
- "Marchează inactiv" on the record sets "inactiv" (asks to confirm); "Marchează activ" on an inactive record sets "activ" [3b s6; DEC 2026-10-26 gaps #36, decided by Claude].
- At deploy: "Activ" only if registered this season or with a public page; all others "Inactiv" [3b s6]. "Registered this season" = a current-season registration linked to the athlete or matched "Sigur" to it [DEC 2026-10-26 gaps #18, decided by Claude]. "With a public page" = the profile's page is on (`showPublicPage`) [pattern, decided by Claude].

### 1.6 History
- Every edit, correction, move, merge and send writes a `history-entry` (who, what, when, old and new) [SPEC 2 rule 9].
- One line per change, old -> new; actor shown by name (e-mail if no name); rows written by the migration shown as "Migrare"; tab label "Istoric (n)"; a registration's history stays on the registration [3b Q23].
- A read route for history (registration and athlete) is new; none exists today [map 3A R14].
- History entries of a deleted athlete are kept for audit and are not shown anywhere in 3B [DEC 2026-10-26 gaps #40, decided by Claude].
- Events and their lines:
  - registration submitted: "Înscriere înregistrată", written at submit from now on; for older registrations shown from `submittedAt` without a stored row [r4 e10];
  - registration field edit (panel or full table): `<etichetă>: "<vechi>" -> "<nou>"`, then "Document refăcut" when the PDF was rebuilt [DEC 2026-10-05; r2 l5; proto v5];
  - e-mail resent (exists) [DEC 2026-10-05];
  - confirmation, on the registration: "Confirmat. Fișa existentă folosită (<nume>); grupa <grupă>." / "Confirmat. Sportiv nou creat; fără grupă." [proto v5];
  - confirmation, on the athlete: "Înscriere confirmată: <nr>, grupa <grupă>" [DEC 2026-10-26 gaps #3, decided by Claude]; without a group: "Înscriere confirmată: <nr>" [pattern, decided by Claude];
  - athlete field updated from a registration: `Telefon: "<vechi>" -> "<nou>" (din înscrierea 2026-0142)` [DEC 2026-10-06 open-questions-v1 Q1];
  - group added: "Adăugat în grupa <grupă>"; A.C.S. status written: "Membru A.C.S. <sezon>: <vechi> -> <nou>"; reactivation: "Reactivat" [DEC 2026-10-26 gaps #4, decided by Claude];
  - undo of a confirmation: "Confirmare anulată", on the registration and on the athlete (both records the confirmation wrote to) [r4 e1; DEC 2026-10-26 gaps #4, decided by Claude; pattern, decided by Claude];
  - confirmed registration deleted, on the athlete: "Înscriere ștearsă: <nr>" [r4 e3; DEC 2026-10-26 gaps #4, decided by Claude];
  - move to another school, on the registration: "Mutată la <școală>" [r4 e12; DEC 2026-10-26 gaps #4, decided by Claude];
  - athlete created at deploy from a public profile: "Fișă creată din profilul public existent" [DEC 2026-10-26 gaps #3, decided by Claude]; from past registrations: "Fișă creată din înscrierile anterioare" [DEC 2026-10-26 gaps #4, decided by Claude]; both with actor "Migrare" [3b Q23];
  - athlete field edits: old -> new per field [3b Q20]; status change: "Status: <vechi> -> <nou>" [DEC 2026-10-26 gaps #4, decided by Claude];
  - public profile: "Profil public creat" [DEC 2026-10-26 gaps #4, decided by Claude]; page on / off: "Pagina publică pornită" / "Pagina publică oprită" [proto v5];
  - merge, on the kept athlete: "Unit cu <nume>"; delete: "Sportiv șters: <nume>" (kept for audit, above) [DEC 2026-10-26 gaps #4, #40, decided by Claude].

## 2. Matching

### 2.1 Rules and levels
- Compared: child name, birth date, contact phone, e-mail [DEC 2026-10-05].
- Normalising: phone digits only, a leading +40 or 0040 becomes 0; e-mail trimmed and lower case [DEC 2026-10-26 gaps #14, decided by Claude].
- Name comparison ignores diacritics and word order and allows one wrong letter per name word ("Dumitrescu" = "Dumitresu") [DEC 2026-10-05; r1 q7b; cs phase3a-r1b A].
- Levels [cs phase3a-r1-foundations block 3; r1 q7]:
  - Sigur: same name + same birth date;
  - Probabil: same birth date + same phone or e-mail + at least one name word in common after normalising [DEC 2026-10-26 gaps #13, decided by Claude];
  - Alt copil (sibling): same phone or e-mail, other birth date.
- Sigur and Probabil show "Sportiv existent"; Alt copil shows nothing and creates no link [r1 q7].
- Several candidates: the highest level wins, then the most recently updated athlete; the others appear in "Caută alt sportiv" [DEC 2026-10-26 gaps #15, decided by Claude].
- The "Sportiv existent" line and filter apply only to unconfirmed registrations [DEC 2026-10-26 gaps #16, decided by Claude], meaning registrations with no athlete linked; old "Confirmat" rows without an athlete therefore keep the line, consistent with r2 l6 [pattern, decided by Claude].
- Levels are never shown as words in the list [DEC 2026-10-06 registrations-list-v1 + match-words-v4].
- Inactive athletes are included [diagram 05b; DEC 2026-10-18 states-v2].
- Never auto-merge; the admin always confirms [DEC 2026-10-05].

### 2.2 When it runs
- At submit, saved; refreshed when the registration is edited or an athlete is created or changed (merge and delete included) [r1 q6].
- Registrations existing at deploy are matched once at deploy (11) [r1 q6].

### 2.3 Deploy data: athletes, matching, duplicates, status
- Athletes from past registrations [r1 q10; DEC 2026-10-26 d17]:
  - registrations of ALL past seasons, archived ones included, "Respins" skipped (whether the current season's registrations count: Open 1);
  - one athlete per child, grouped by same name + birth date across seasons; "same name" uses the Sigur name rule of 2.1 [pattern, decided by Claude];
  - newest contact data wins (contact person, phone, e-mail, and the name as written, from the newest registration) [DEC 2026-10-26 d17; pattern, decided by Claude];
  - unreadable birth date: the athlete gets no birth date and "Date incomplete"; such a registration is not grouped with others and forms its own athlete, which the duplicate flagging below then catches [DEC 2026-10-26 d17; pattern, decided by Claude];
  - marked "Date incomplete"; no past groups exist, so the card shows "Ultima înscriere: <sezon>" [r1 q10; DEC 2026-10-26 gaps #5, decided by Claude];
  - the past registrations stay UNLINKED and keep their status; matching finds them, and the admin links a child when it registers again [DEC 2026-10-26 d17].
- The idempotent athlete migration (`migrateAthletes`) re-runs, so every public profile, drafts included, has an athlete marked "Date incomplete" [3b Q33].
- Matching backfill: every registration without a linked athlete is matched once by 2.1 and the result saved [r1 q6].
- Possible duplicates: no automatic merge; pairs are flagged for the admin to merge by hand [3b s8; DEC 2026-10-26 d12]. A pair is flagged when the 2.1 rules give Sigur or Probabil between two athletes, or when one of them has no birth date and the names agree under the 2.1 name rule (this catches a public-profile athlete and a past-registration athlete for the same child). Flags are computed once, at deploy [pattern, decided by Claude]. Display in 6.6.
- Status at deploy by the 1.5 rule, after the matching backfill (it needs the "Sigur" matches) [3b s6; DEC 2026-10-26 gaps #18, decided by Claude].

## 3. Înscrieri (3A)

### 3.1 List
- Columns exactly as prototype v5, with the wish column renamed [r2 l1, r2b l2; proto v5]: "Nr." | "Trimis la" | "Nume sportiv" | "Vârstă" | "Status" | "Completat de" | "Dorește să fie membru".
- "Nume copil" becomes "Nume sportiv" everywhere, also in the full table view and the filter builder [r2 l1].
- "Vârstă": age today, cell "<n> ani", sortable [DEC 2026-10-06; r3 c6]; blank when the birth date is missing or unreadable [DEC 2026-10-26 gaps #23, decided by Claude]. No birth date under the name [DEC 2026-10-06].
- Matched unconfirmed rows: one small blue line "Sportiv existent" with a person icon, tight under the name (line-height about 1.2, about 1px gap); no details, no levels [DEC 2026-10-06 registrations-list-v1 + match-words-v4; DEC 2026-10-26 gaps #16, decided by Claude].
- Every row the same height (about 50px); rows without the line keep the second line empty [DEC 2026-10-06 row-height-v2].
- Filter "Sportiv existent": "Da" / "Nu", added to the current toolbar; Înscrieri keeps its toolbar (no filters-v3 redesign there) [DEC 2026-10-06; DEC 2026-10-26 gaps #22, decided by Claude].
- Search placeholder "Caută după nr. înscriere, nume, părinte, email sau telefon..." (replaces today's "Caută după nume, număr, părinte, e-mail sau telefon...") [r5 m2].
- Existing list, filters, bulk actions (season move, archive, delete), CSV export, Sheets dialog and "Formulare goale" stay [SPEC 3.2; P2 4.1]. Bulk actions add "Mută la altă școală" with a school picker, only with 2+ schools (3.6) [r4 e12; DEC 2026-10-26 gaps #8, decided by Claude].

### 3.2 Full table view
- Cell editing stays; every cell edit writes old -> new to the registration Istoric and rebuilds the PDF when needed; never sends an e-mail [r2 l5].
- "Vârstă" is also a column here, blank when the birth date is missing or unreadable [DEC 2026-10-26 gaps #23, decided by Claude].
- "Confirmat" cannot be set from a cell or menu [r2 l6].

### 3.3 Panel
- Header (fixed): name, status badge, "Nr. 2026-0142", "Trimis 3 oct 2026, 14:22" [DEC 2026-10-05 registration-tabs-v2; proto v5].
- Status menu keeps "Nou", "Contactat", "Respins" (no "Confirmat") [DEC 2026-10-26 gaps #20, decided by Claude; r2 l6].
- "..." menu: "Anulează confirmarea" (only on a registration confirmed through the window; asks to confirm), "Mută la altă școală" (3.6), "Șterge înscrierea" (moved here from the footer) [DEC 2026-10-26 gaps #8, #21, decided by Claude].
- Match card (above the tabs, only while unconfirmed): initials, "Sportiv existent", the last group, or "Ultima înscriere: <sezon>" when the athlete has no group; the line "În formular: nu a participat sezonul trecut." when the form says so [r1 q10; DEC 2026-10-26 gaps #5, decided by Claude]. "Compară" / "Ascunde" opens an in-place table with columns "În fișă" / "În înscriere" and rows "Nume", "Data nașterii", "Părinte", "Telefon", "E-mail"; differences highlighted with a light background only, no count text, no last-season answer, no ticks; empty cells blank; link "Deschide fișa completă" opens the record in the same tab [DEC 2026-10-06 pending-decisions-v2; proto v5; DEC 2026-10-26 gaps #2, #33, decided by Claude].
- Tabs (existing `src/admin/ui/Tabs.tsx`): "Date" | "Abonament" | "Documente (n)" | "Istoric (n)" [DEC 2026-10-05; proto v5].
- Labels use the form's wording, as in prototype v5; old registrations (before the new form) show their own questions the same way [r2b l3; cs phase3a-r2-list-panel 3A].
  - Date: "Adresă de e-mail", "Persoana care completează", "Calitatea față de sportiv", "Telefon de contact", "Numele copilului", "Data nașterii copilului", "Înălțimea copilului (cm)", "Măsura bluză", "Sezonul trecut a participat la cursurile ACS EduSport?", "Nivel de experiență / Elemente cunoscute", "Așteptări de la cursurile de patinaj" [proto v5].
  - Abonament (read-only): "Dorește să fie membru" ("Da, doresc să devin membru" / "Nu, optez pentru tarife neafiliați"), "La primul modul", "De unde ați aflat", "Acord GDPR", "Acord Regulament" [r2b l2, l4; proto v5].
  - Documente: the PDFs and the e-mail block built in phase 2 (`RegistrationDocuments.tsx`, `RegistrationEmail.tsx`) move here, with "Retrimite e-mailul" and its confirmation [DEC 2026-10-05; DEC 2026-10-24 phase2-q8b].
  - Istoric: newest first, date, time, who, text [DEC 2026-10-05; 3b Q23].
- Footer (fixed) before confirmation: "Contactat" (hidden when already Contactat) and "Confirmă înscrierea" (hidden for "Respins" and archived registrations); after confirmation: "Deschide fișa sportivului" [r2 l6; proto v5; DEC 2026-10-26 gaps #20, decided by Claude].
- Code today: the panel is one flat list (`InscrieriPage.tsx::renderDetail`) with a status select, a delete button in the footer and in-place edits of Calitate and Membru A.C.S. (`EditableAnswer`); the in-place edits are replaced by the tabs and Editează, the status select keeps the three values above, delete moves to the "..." menu [map 3A R9, R10; DEC 2026-10-26 gaps #20, #21, decided by Claude].

### 3.4 Editează (Date tab)
- One "Editează" link on the first field row, no extra row; opens all answers for editing, "Salvează" / "Anulează" [DEC 2026-10-05 edit-registration-v1; proto v5].
- All answers are edited here, including Calitate and the A.C.S. wish; the Abonament tab stays read-only [r2b l4]. The wish is the last field of the form, under "Abonament" [DEC 2026-10-26 gaps #25, decided by Claude].
- "Data nașterii copilului" uses the zi / lună / an picker and is saved as ZZ.LL.AAAA [DEC 2026-10-26 gaps #24, #43, decided by Claude]; same three selects and year range as the website (9), a stored year outside the range stays selectable [pattern, decided by Claude].
- Nr. înscriere and Trimis la never change; consents are not editable [DEC 2026-10-05].
- Saving rebuilds the PDF(s) (new file first, then delete the old one), writes old -> new per field and "Document refăcut", never sends an e-mail and shows no resend prompt [DEC 2026-10-05 (two entries)].
- Toasts: "Salvat. Documentul a fost refăcut." / "Nicio modificare."; rebuild failure: yellow warning "Salvat. Documentul PDF nu a putut fi refăcut." [proto v5; DEC 2026-10-24 phase2-q7 p4].
- Saving refreshes the match (2.2) [r1 q6]. After confirmation, edits stay on the registration only [DEC 2026-10-26 gaps #26, decided by Claude].

### 3.5 Status
- "Confirmat" only via "Confirmă înscrierea"; "Contactat" as a footer button and in the status menu; "Nou" and "Respins" in the status menu [r2 l6; DEC 2026-10-26 gaps #20, decided by Claude].
- "Respins" and archived registrations cannot be confirmed [DEC 2026-10-26 gaps #20, decided by Claude].
- Old "Confirmat" rows without an athlete keep the status and show "Confirmă înscrierea" [r2 l6].
- After an undo the status returns to what it was before the confirmation (4.6) [DEC 2026-10-26 gaps #32, decided by Claude].

### 3.6 School column, tabs, move to another school
- "2+ schools" counts sections of kind school with a public page; column and tabs are built now and hidden until a second school exists [r2 l7].
- Tabs "Toate (n)", "<școală> (n)"; column "Școala" [cs multi-school-registration-v1 A; DEC 2026-10-19 multi-school].
- Move to another school: "Mută la altă școală" in the panel "..." menu and in bulk actions with a school picker; only with 2+ schools; only before confirmation; PDFs not rebuilt; the frozen subscription choice stays; logged "Mutată la <școală>"; number unchanged [r4 e12; DEC 2026-10-19; DEC 2026-10-26 gaps #8, #27, decided by Claude].
- Hidden today (one school + Club).

## 4. Confirm window

### 4.1 Layout and states
- Title "Confirmă înscrierea <nr>"; section "Sportiv"; footer "Anulează" + "Confirmă înscrierea" [proto v5; DEC 2026-10-06 open-questions-v2 Q4].
- Match found: card of the proposed athlete (initials, name, the last group or "Ultima înscriere: <sezon>", "Vezi fișa"), then two choice cards [DEC 2026-10-06 open-questions-v2 Q2; r1 q10; proto v5; DEC 2026-10-26 gaps #5, decided by Claude]:
  - "Sportiv existent", "Înscrierea se adaugă la această fișă";
  - "Sportiv nou", "Se creează o fișă nouă: <nume>".
- Proposed athlete with several candidates: as 2.1 (highest level, then most recently updated) [DEC 2026-10-26 gaps #15, decided by Claude].
- "Sportiv existent" is preselected only for a Sigur match; for Probabil none is selected and "Confirmă înscrierea" stays disabled with the hint "Alege "Sportiv existent" sau "Sportiv nou"" [r3 c1; proto v5].
- When the form says the child did not attend last season: line "În formular: nu a participat sezonul trecut." in the "Sportiv existent" card [r3 c2, r3b c2b].
- No match: card "Sportiv nou", "Se creează o fișă nouă: <nume>, <data nașterii>", link "Caută un sportiv existent" [proto v5].
- "Caută alt sportiv": search replaces the card in place (no second window); placeholder "Nume, data nașterii, părinte sau telefon"; "Anulează"; the proposed athlete stays first, the other candidates follow; result rows on two lines, the name, then birth date, last group and parent separated by commas; nothing found: "Niciun sportiv găsit pentru "<text>"." plus a "Sportiv nou" row [DEC 2026-10-05; DEC 2026-10-06 open-questions-v2 Q2; proto v5; DEC 2026-10-26 gaps #1, #15, decided by Claude].
- "Vezi fișa" opens the record in the same tab [DEC 2026-10-26 gaps #33, decided by Claude].
- Radio-like choice uses the new admin Radio styling [DEC 2026-10-06 open-questions-v2 Q8].

### 4.2 Compară și actualizează
- Link "Compară și actualizează" ("Ascunde" when open) shows the comparison table with a per-field "Actualizează" tick [DEC 2026-10-06 compare-label-v1 C].
- Ticks on by default for every differing field except name and birth date; those two can be ticked by hand, off by default [DEC 2026-10-06 open-questions-v1 Q1; r3 c5].
- If the table is never opened the default ticks still apply [DEC 2026-10-06 open-questions-v1 Q1].
- Empty cells blank [DEC 2026-10-26 gaps #2, decided by Claude].
- Each applied change is logged on the athlete (1.6). A name change also renames the public profile; the address stays [3b s2].

### 4.3 Season, groups, main group
- The registration's season is written only while that season is running (up to its end month) [r3 c9].
- After the end month: the confirmation links the athlete only, writes no group and no A.C.S. status, and the window shows "Sezonul 2026-2027 s-a încheiat. Se leagă doar fișa sportivului." [r3b c9].
- A registration without a season reference uses its season text; if no season matches it, it is treated like an ended season (link only) [DEC 2026-10-26 gaps #31, decided by Claude].
- Group picker (`SearchableSelect`) offers that school's groups plus Club groups [r3 c7; SPEC 3.13], listed under the section name (school first, then Club), in the groups' own order; group names only, no suggestion, no schedule text [DEC 2026-10-26 gaps #28, #1, decided by Claude].
- Group is optional: "Fără grupă deocamdată" [DEC 2026-10-06 pending-decisions-v2].
- Real group names only (Primii Pași, Începători, Intermediari Bronze, Intermediari Silver, Avansați Bronze, Avansați Silver, Avansați Gold; Club: Profesioniști, Avansați); mockup names "Adulți", "Performanță Juniori" were invented [DEC 2026-10-19 data-q1-groups].
- When the athlete already has a group this season: the line "Grupă principală acum: <grupă> (<secțiune>)" above the picker and a "Grupă principală" tick under it, off by default; otherwise the picked group becomes main [r3b c8; cs phase3a-r3b A; DEC 2026-10-26 gaps #6, decided by Claude].
- The membership starts at the confirmation date, or at the season start when confirmed before it (1.4) [DEC 2026-10-26 gaps #29, decided by Claude].

### 4.4 A.C.S. status and wish
- Shown separately: the athlete's status "Membru A.C.S. 2026-2027" and the form's wish line "Dorește să fie membru (formular): Da" [r1 q1b; DEC 2026-10-26 gaps #7, decided by Claude].
- Confirming with wish "Da" sets the status "În așteptare" until the fee is paid; the status line shows the change in the style "Nu -> În așteptare", read-only [r1 q1b; cs phase3a-r1b 5A; DEC 2026-10-26 gaps #7, decided by Claude].
- Wish "Nu" writes nothing; an existing status for the season is never lowered [DEC 2026-10-26 gaps #30, decided by Claude].
- No prices or membership fee in the window [DEC 2026-10-05].
- The form's abonament is shown as the parent's intent under "Abonament dorit (din formular)": "<abonament>, doar intenția părintelui; abonamentul se adaugă când e cumpărat" [proto v5; DEC 2026-10-05; DEC 2026-10-26 gaps #1, decided by Claude; pattern, decided by Claude].

### 4.5 What confirming writes
- Sportiv existent: links the registration; applies the ticked fields; reactivates an inactive athlete; a "nou" athlete becomes "activ"; recomputes "Date incomplete" [SPEC 3.2; r4 e7; DEC 2026-10-18 states-v2].
- Sportiv nou: creates the athlete from the registration (full name, birth date, contact person, phone, e-mail), status "activ", links the registration [SPEC 3.2; r3 c4; 3b Q19].
- Group membership and A.C.S. as in 1.4.
- Registration status "Confirmat"; history on both records (1.6).
- No e-mail, no subscription [DEC 2026-10-06 open-questions-v2 Q3; DEC 2026-10-05].
- A second registration for the same child matches as "Sportiv existent"; confirming it adds nothing twice [r4 e5].

### 4.6 After confirming
- Toast "Înscriere confirmată: <nume>" for 8 seconds with the action "Anulează" only (needs Toast `action`, section 8) [r3 c10; r4 e1; DEC 2026-10-10 aloca-v2 (a); DEC 2026-10-26 gaps #32, decided by Claude].
- The panel shows "Confirmat", hides the match card and offers "Deschide fișa sportivului" [proto v5].
- Undo: the toast "Anulează", or later "Anulează confirmarea" in the panel "..." menu, which asks to confirm (dialog copy: Open 3) [r4 e1; DEC 2026-10-26 gaps #8, decided by Claude].
- Undo reverts everything the confirmation wrote: the link, the group added, the A.C.S. status written, the athlete field updates and the reactivation; the registration status returns to what it was; a newly created athlete is removed only if it has nothing else (no other registration, group or A.C.S. status); logged "Confirmare anulată" [r4 e1; DEC 2026-10-26 gaps #32, #4, decided by Claude].
- Linking to a different athlete = undo, then confirm again; no separate re-link action [r4 e2].
- Deleting a confirmed registration is allowed; the athlete's data, groups and A.C.S. status stay; the athlete Istoric notes "Înscriere ștearsă: <nr>" [r4 e3; cs phase3a-r4-edges 3A; DEC 2026-10-26 gaps #4, decided by Claude].

### 4.7 Errors, concurrency, blocked states
- All or nothing: athlete, link, group and A.C.S. are saved together or not at all; on failure "Confirmarea nu a reușit. Nimic nu a fost salvat." [r4 e9].
- Second concurrent confirm: "Înscrierea a fost deja confirmată de alt administrator." and the panel refreshes [r4 e8].
- A birth date outside the readable formats (1.3) blocks confirmation until fixed via Editează: "Data nașterii nu poate fi citită. Corectați-o în Date." [r4 e11; DEC 2026-10-26 gaps #24, decided by Claude].
- "Respins" and archived registrations offer no confirmation (3.5) [DEC 2026-10-26 gaps #20, decided by Claude].
- One registration at a time; no bulk confirm [r4 e4].

### 4.8 Phone
- Full-height bottom sheet; the two choice cards stacked; the comparison table scrolls sideways [r3 c11].
- A phone render is shown to the user before build [r3 c11].

## 5. Sportivi list (3B)

- Takes the "Sportivi" menu entry, replacing today's public-profile list (`SportiviPage.tsx`) [3b s1].
- Header: title "Sportivi", subtitle "Toți sportivii clubului. Doar în panou, nu sunt publici.", button "Adaugă sportiv" [proto v5; 3b s10]. No "Export" [3b Q28], no "Coloane" [3b Q9].
- Toolbar: search, season selector "Sezon 2026-2027", filters, sort [proto v5].
- Columns: "Sportiv" | "Vârstă" | "Grupa <sezon>" | "Contact" | "Membru A.C.S." | "Profil public"; no "Abonament" until phase 5 [3b s4; proto v5].
  - Vârstă: age today, "<n> ani"; blank without a birth date [r3 c6; proto v5; DEC 2026-10-26 gaps #2, decided by Claude].
  - Grupa: main group of the selected season; "Fără grupă" when none [3b s4; proto v5].
  - Contact: contact person, phone under it; missing values blank [proto v5; DEC 2026-10-26 gaps #2, decided by Claude].
  - Membru A.C.S.: three states "Da" / "Nu" / "În așteptare"; no value shown as "Nu" [3b s4; DEC 2026-10-19 money-q1-member, membership-season-v1].
  - Profil public: "Public" / "Ascuns" [proto v5].
  - Missing data marker under the name "date lipsă" with tooltip "Lipsesc: <câmpuri>" [proto v5].
- Season selector only changes the Grupa and A.C.S. columns; everyone is listed [3b s5].
- Inactive athletes hidden unless the Status filter asks for them [DEC 2026-10-18 states-v2; 3b s6].
- Filters (filters-v3 layout: sections left with their value, options right in 36px rows, live total "<N> sportivi", "Șterge tot", "Gata"; search inside a section only above 8 options) [3b Q9; DEC 2026-10-06 filters-v3]:
  - Secțiune: the athlete's groups in the selected season, else its registrations of the selected season, else "Fără secțiune" [3b s5; DEC 2026-10-10 aloca-v2 (b); DEC 2026-10-26 gaps #35, decided by Claude];
  - Grupa; Fără grupă; Membru A.C.S.; Profil public ("Public" / "Ascuns"); Date ("Complete" / "Incomplete") [3b Q9; proto v5];
  - Status ("Nou", "Activ", "Inactiv") [3b s6, Q14];
  - "Posibile dubluri" [DEC 2026-10-26 d12];
  - no Abonament filter until phase 5 [3b Q9].
- Sort: "Nume A-Z" (full name as written), "Vârstă", "Grupă"; sortable headers [3b Q5; proto v5].
- Search: name, parent, phone, e-mail, registration number; diacritics, word order and one typo ignored like matching; server-side [3b Q29]. Placeholder "Caută după nume, părinte, telefon, e-mail sau nr. înscriere..." [DEC 2026-10-26 gaps #9, decided by Claude].
- Banner "N sportivi au date incomplete." + "Arată-i"; with one athlete "1 sportiv are date incomplete." [3b Q21; DEC 2026-10-26 gaps #10, decided by Claude].
- Paging 50 per page on desktop; empty "Niciun sportiv nu corespunde filtrelor."; count "<n> din <m> sportivi" [DEC 2026-10-06 documents-bulk-v1; proto v5].
- Row and record links open the record in the same tab [DEC 2026-10-26 gaps #33, decided by Claude].
- Phone: cards (name, age, main group, "Date incomplete" marker), 30 at a time with "Încarcă încă 30", filters and sort in a bottom sheet (drill-in sections, "‹ Filtre", footer "Arată N sportivi", singular "Arată 1 sportiv"); controls one height; every action labelled [3b Q30, Q9; DEC 2026-10-06 filters-v3, documents-mobile-club-v1; DEC 2026-10-26 gaps #37, #10, decided by Claude].

## 6. Athlete record (3B)

### 6.1 Page and header
- Full page on desktop with back link "Sportivi" [3b s3; proto v5]. Phone: full-height bottom sheet, scrolling tab bar, "Salvează" in a sticky footer; phone render shown before build [3b Q7].
- Header: name; sub-line "<data nașterii>, <grupa principală>" (or "data nașterii lipsește"); badge "Date incomplete" when incomplete [proto v5; 3b Q24; DEC 2026-10-26 gaps #1, decided by Claude].
- Header "..." menu: "Marchează inactiv" / "Marchează activ", "Unește cu alt sportiv", "Șterge sportivul" [DEC 2026-10-26 gaps #8, decided by Claude].
- Possible-duplicate line (6.6) under the header, above the tabs [DEC 2026-10-26 d12; pattern, decided by Claude].
- Tabs in 3B: "Date" | "Profil public" | "Documente" | "Istoric (n)"; the record opens on "Date" [SPEC 3.3; 3b Q23; DEC 2026-10-26 gaps #34, decided by Claude].

### 6.2 Date
- Fields "Nume și prenume", "Data nașterii", "Persoana de contact", "Telefon", "E-mail"; no "Calitate" [proto v5; r3 c4; 3b Q19].
- Edited through "Editează" like the Înscrieri panel; Istoric writes old -> new per field; birth date with the zi / lună / an picker; "Date incomplete" recomputed on every save [3b Q20]. Picker: same three selects and year range as the website (9), a stored year outside the range stays selectable [pattern, decided by Claude].
- A missing required field shows "lipsește" after the label, on its own line; hint "Obligatorii pentru "complet": nume, data nașterii, persoana de contact, telefon, e-mail." [proto v5; DEC 2026-10-06 open-questions-v2 Q6; DEC 2026-10-26 gaps #1, decided by Claude].
- Toasts "Salvat. Mai lipsesc: <câmpuri>." / "Salvat. Datele sunt complete." [proto v5].
- A name change renames the public profile; its address stays [3b s2].
- A.C.S. status of the selected/current season, read-only: "Membru A.C.S. <sezon>: <stare>" [3b Q24; DEC 2026-10-26 gaps #11, decided by Claude].
- Block "Înscrieri": rows "<nr>, <sezon>, <status>", each opening the Înscrieri panel [3b Q25; DEC 2026-10-26 gaps #11, decided by Claude].

### 6.3 Profil public
- The whole current profile editor (`SportivEditPage.tsx`: Identitate, Poveste, Echipă și discipline, Mișcări și hobby-uri, Obiectiv de carieră, Rezultate competiții with skate-results link and import, Galerie, Programe pe sezon; Fotografie, Slug, Activ din, visibility) moves into this tab with today's controls, its visibility control included; nothing is lost [3b s1; cs phase3b-important 1A; DEC 2026-10-26 gaps #38, decided by Claude].
- The name shows read-only with "Numele se schimbă în Date."; it follows the athlete name, without touching other unpublished draft changes [3b s2; DEC 2026-10-26 gaps #38, decided by Claude].
- Slug shows read-only once the profile exists (today's editor lets it be typed), since the address never changes after creation [3b s2; pattern, decided by Claude].
- No profile yet: "Creează profil public" creates one with the page off; logged "Profil public creat" [3b Q3; DEC "Decided" Q7; DEC 2026-10-26 gaps #4, decided by Claude].
- Switching the page off only sets `showPublicPage` off, as today [3b Q3].
- Note shown: "Datele de contact și data nașterii nu ajung niciodată aici." [proto v5].
- Competiții and Pagina principală pickers keep picking public profiles [3b Q27].

### 6.4 Documente
- Only the PDFs of the athlete's registrations, opened through the existing admin-guarded routes: rows "Acord <sezon> (înscrierea <nr>)" and "Cerere de adeziune <sezon> (înscrierea <nr>)", each with "Vezi" and "Descarcă"; empty "Niciun document încă." [3b s11; proto v5; P2 4.1; DEC 2026-10-26 gaps #11, decided by Claude].
- Uploads come with phase 8 [3b s11].

### 6.5 Istoric
- As 1.6: newest first, one line per change, actor by name, "Migrare" for migration rows [3b Q23].

### 6.6 Inactive, possible duplicates, delete, merge
- "Marchează inactiv" (asks to confirm, dialog copy: Open 3) and "Marchează activ" on inactive records, in the header "..." menu [3b s6; DEC 2026-10-26 gaps #36, #8, decided by Claude].
- Possible duplicates (flagged at deploy, 2.3): a line on both records "Posibil același copil cu <nume>" with "Unește" / "Nu e același copil"; "Nu e același copil" removes the flag for good; the "Posibile dubluri" filter in Sportivi lists them [DEC 2026-10-26 d12]. "Unește" opens the merge with the other athlete already chosen [pattern, decided by Claude].
- Delete ("Șterge sportivul"): always allowed; registrations unlinked (they show "Confirmă înscrierea" again); groups and A.C.S. rows removed; public profile deleted too, with its competition participations; history kept for audit [3b s9; r4 e6; DEC 2026-10-26 gaps #40, decided by Claude]. Confirmation: "„<nume>” se șterge definitiv, împreună cu profilul public, rezultatele și sezoanele. Înscrierile rămân, fără legătură. Acțiunea nu poate fi anulată." [DEC 2026-10-26 gaps #8, decided by Claude].
- Merge ("Unește cu alt sportiv", or "Unește" on a duplicate line) [3b s8; DEC 2026-10-26 gaps #8, decided by Claude; DEC 2026-10-26 d39]:
  - the admin picks which record is kept and, for each differing field, which value is kept;
  - everything moves to the kept athlete: registrations, groups, A.C.S., history, profile [3b s8; r4 e6];
  - two public profiles: the kept record's profile stays, the other is deleted and its web address redirects to the kept one (1.2); like a delete, the deleted profile's competition participations go with it [DEC 2026-10-26 d39; pattern, decided by Claude];
  - only one record has a profile: that profile is kept [3b s8];
  - A.C.S. rows of the same season: the higher state stays (Da > În așteptare > Nu);
  - the same group twice is kept once;
  - one main group per season: the kept record's; if the kept record has no group that season, the other record's main group stays main [DEC 2026-10-26 d39; pattern, decided by Claude];
  - no undo; a clear confirmation first (copy: Open 3); logged "Unit cu <nume>" on the kept athlete [DEC 2026-10-26 d39, gaps #4, decided by Claude];
  - the merge screen (desktop and phone) is shown to the user before build [3b s8; DEC 2026-10-26 d39].

### 6.7 Adaugă sportiv
- Search first; the "Sportiv nou" form only if not found; created "Activ" [3b s10].
- The search works like "Caută alt sportiv" in the confirm window (4.1): same placeholder, two-line result rows, "Niciun sportiv găsit pentru "<text>"." plus a "Sportiv nou" row [pattern, decided by Claude].
- Form: "Nume complet" and "Data nașterii" required; "Persoana de contact", "Telefon", "E-mail" optional; without them the record is marked "Date incomplete" [DEC 2026-10-26 gaps #41, decided by Claude].

## 7. Menu and dashboard
- New sidebar section "Club și școală", now with Sportivi only, placed above "Sportivi și echipă"; Grupe and Prezență join later [3b s12; DEC 2026-10-10 aloca-v2 (c); DEC 2026-10-26 gaps #42, decided by Claude].
- Sportivi leaves "Sportivi și echipă" (`menu.tsx` group `team`); Membri echipă, Competiții, Discipline stay there [3b s12; map 3B R26].
- The old editor route `/plugins/edusport-sportiv-edit` redirects to the athlete record [DEC 2026-10-26 gaps #42, decided by Claude].
- Dashboard tile "Sportivi" counts active athletes (today it counts public profiles in `DashboardPage.tsx`) [3b s12].

## 8. Shared admin UI (built in 3A, reused in 3B)
All in `src/admin/ui`, added to the UI reference page [r1 q29; SPEC 3.13; DEC 2026-10-06 bottom-sheet-v1].
- Custom Select with chevron, rewritten admin-wide (today `Select.tsx` is a native `<select>`); every page using Select switches at once [r1 q29; DEC 2026-10-06 open-questions-v2 Q8].
- Radio, admin style [DEC 2026-10-06 open-questions-v2 Q8].
- Toast `action` option (label + handler), used for "Anulează"; today `ToastOptions` has only `title` and `duration` [DEC 2026-10-10 aloca-v2 (a)].
- BottomSheet: on phones slides up, rounded top corners, grab handle, title + X, scrolling body (max 85% height), sticky footer, safe-area padding, closes on X / overlay / swipe down / Escape, same focus trap and layer stack as Modal / Drawer; on desktop the same content renders as a rich dropdown anchored under its button (arrow, soft shadow, 8px corners, live count, "Șterge tot", "Gata", no overlay) [DEC 2026-10-06 bottom-sheet-v1/v2]. Full-height variant for the confirm window and the record [r3 c11; 3b Q7].
- Filter dropdown layout filters-v3 (5) [DEC 2026-10-06 filters-v3].
- Selected style E: solid primary fill, white text, 6px corners, no left bar, no outline, 4px inset in lists; replaces `.ui-inbox-item[aria-current="true"]` in `styles.ts` [DEC 2026-10-06 selected-state-v2].
- Birth date picker (three selects zi / lună / an), shared by Editează and the record Date tab (the website has its own, 9) [3b Q20; r5 m3].
- `SearchableSelect` for group pickers; Drawer, Modal and `ConfirmDialog` reused [SPEC 3.13].
- Every new admin screen works at phone width [SPEC 5; DECISIONS "Decided" (CMS admin on mobile)].

## 9. Website change
- On /inscrieri the field "Data nașterii copilului" becomes three selects zi / lună / an, differing from the club's script form; years from 25 years ago to 2 years ago; stored as ZZ.LL.AAAA; error "Alegeți data nașterii."; the free-text placeholder "ex: 25 decembrie 2018" goes [r5 m3; DEC 2026-10-26 gaps #43, decided by Claude; frontend `src/app/inscrieri/_types.ts`, `_ConfigStep.tsx`].
- Older free-text dates keep the e11 rule (4.7) [r5 m3].
- Public profile pages unchanged, except that an address removed by a merge redirects to the kept profile's address [DEC 2026-10-26 d39].

## 10. Diagrams and docs
- Update the three drifted diagrams with 3A [r5 m4; map 3A Q30]:
  - 03a: Athlete one full name, statuses nou / activ / inactiv, remove `isMember` (A.C.S. is per season) [3b Q32; SPEC 2 rule 8];
  - 05b: matching at submit (saved), not on open; season-ended branch; all or nothing [r1 q6; r3b c9; r4 e9];
  - 02e: move registration to another school; add, merge (d39 rules), delete, mark inactive / active athlete; possible duplicates [r4 e12; 3b Q32; DEC 2026-10-26 d12, d39].
- `13-roadmap.md` status lines for phase 2, 3A and 3B as they move [13-roadmap header].

## 11. Deploy
- ONE deploy window for phase 2, 3A and 3B together [DEC 2026-10-26 d19; r3 c3]. The phase 2 steps follow `docs/architecture/12-phase2-deploy-runbook.md` ("Before the window" items 1 to 13 are done first); the backend and frontend refs deployed are the ones holding phase 2 + 3A + 3B.
- Every 3A+3B migration: dry run by default, `--apply` to write, idempotent, re-runnable, no big transaction; the user approves each step on production [DEC 2026-10-19 build-q3-final-review (1); P2 5; 13-roadmap, phase 2 go-live practice].
- Order (each step needs the previous one):
  1. "Înscrieri deschise" off, so no registration arrives during the migrations [RB2 1].
  2. Backup of the database, uploads and the private PDF folder [RB2 2; P2 4.1].
  3. Deploy the backend; the restart applies the phase 2 schema and the 3A+3B schema (athlete name field, match result, duplicate flag, history) [RB2 3; map 3B D1].
  4. Private documents volume check [RB2 4].
  5. Phase 2 copy script, dry run then apply: registration seasons rewritten and numbers assigned, which matching and the season rules rely on [RB2 5, 6].
  6. Phase 2 admin checks (seasons, prices, WhatsApp link) [RB2 7].
  7. Athlete one-name migration: first + last become the full name for the existing athletes (1.1) [r3 c4].
  8. Re-run `migrateAthletes`: every public profile without an athlete (drafts included) gets one, "Date incomplete", "Fișă creată din profilul public existent" [3b Q33; DEC 2026-10-26 gaps #3, decided by Claude].
  9. Athletes from past registrations, unlinked: one per child, "Date incomplete", "Fișă creată din înscrierile anterioare"; registrations keep their status (2.3) [r1 q10; DEC 2026-10-26 d17].
  10. Matching backfill: every registration without a linked athlete matched and the result saved (2.3) [r1 q6].
  11. Duplicate flagging: possible duplicates flagged for the "Posibil același copil cu <nume>" line and the "Posibile dubluri" filter (2.3) [3b s8; DEC 2026-10-26 d12].
  12. Deploy-time status rule: "Activ" if registered this season (linked or matched "Sigur") or with the public page on, otherwise "Inactiv" (1.5) [3b s6; DEC 2026-10-26 gaps #18, decided by Claude].
  13. Deploy the frontend (phase 2 form with the new birth date picker) [RB2 8].
  14. Test registration and its removal as in the runbook, then "Înscrieri deschise" on [RB2 9, 10].
- Steps 13 and 14 come after the 3A+3B migrations so registrations reopen only on the finished data.

## 12. Testing
- Unit tests for the rules [SPEC 5]:
  - matching levels (Probabil = same birth date + phone or e-mail + one common name word); diacritics, word order, one wrong letter per word; phone and e-mail normalising; several candidates order; Alt copil shows nothing; line only while unconfirmed [2.1];
  - readable birth date formats and the unreadable block [1.3; r4 e11];
  - preselection only for Sigur [r3 c1];
  - age today, blank without a readable date [r3 c6; gaps #23];
  - season running vs ended; registration without season reference [r3b c9; gaps #31];
  - main group: first group main, tick otherwise, one main per season; membership from date [r3b c8; SPEC 2 rule 2; gaps #29];
  - A.C.S.: wish Da -> "În așteptare"; wish Nu writes nothing; never lowered; nothing written twice [r1 q1b; r4 e5; gaps #30];
  - all or nothing; concurrent confirm; undo reverts exactly what was written and restores the status; new athlete removed only if unused [r4 e1, e8, e9; gaps #32];
  - status menu values; no confirm for Respins and archived [gaps #20];
  - school move keeps the subscription choice, number unchanged [r4 e12; gaps #27];
  - "Date incomplete" recompute [3b Q20];
  - name migration (first + last -> one field) [r3 c4];
  - profile name follows without touching draft changes, slug unchanged [3b s2; gaps #38];
  - deploy: athletes from past registrations (Respins skipped, grouping, newest contact, unreadable date, registrations unlinked), duplicate flagging, status rule [DEC 2026-10-26 d17, d12; 3b s6; gaps #18];
  - Secțiune derivation, search normalisation [3b s5, Q29; gaps #35];
  - delete and merge effects (kept record, field choice, profile deleted with redirect, A.C.S. higher state, group once, one main group) [3b s8, s9; DEC 2026-10-26 d39];
  - history written for every change, with the 1.6 lines [SPEC 2 rule 9];
  - website picker: range, stored format, error [gaps #43];
  - nothing private in public endpoints [SPEC 5].
- Browser tests: confirm flows (Sigur, Probabil, none, search, season ended, undo), Editează, Sportivi list filters (incl. "Posibile dubluri"), record tabs, duplicate line, merge, delete, Adaugă sportiv, old editor route redirect, website birth date picker.
- Renders shown to the user before build: confirm window on phone [r3 c11], athlete record on phone [3b Q7], merge screen on desktop and phone [3b s8; DEC 2026-10-26 d39].

## 13. Decided by Claude (overrule if needed)

Gap answers from DECISIONS "phase3ab spec gaps, decided by Claude" (gap number: where it lives):
- 1 no middle dots: 4.1 search rows, 4.3 group options, 4.4 abonament hint, 6.1 sub-line, 6.2 "lipsește".
- 2 empty values blank: copy convention (top), 3.3, 4.2, 5.
- 3 neutral history lines: 1.6, 11 step 8.
- 4 history lines: 1.6, 3.6, 4.6, 6.3, 6.6.
- 5 "Ultima înscriere: <sezon>", "nu a participat" line in the panel card: 2.3, 3.3, 4.1.
- 6 "Grupă principală acum": 4.3.
- 7 A.C.S. and wish lines: 4.4.
- 8 "..." menus, school move in bulk, delete text: 3.1, 3.3, 3.6, 6.1, 6.6.
- 9 Sportivi search placeholder: 5.
- 10 singular forms: 5.
- 11 Date tab A.C.S. line, "Înscrieri" block, Documente rows: 6.2, 6.4.
- 13 Probabil rule: 2.1.
- 14 phone and e-mail normalising: 2.1.
- 15 several candidates: 2.1, 4.1.
- 16 line and filter only unconfirmed: 2.1, 3.1.
- 18 "registered this season": 1.5, 2.3, 11 step 12.
- 20 status menu, hidden buttons: 1.3, 3.3, 3.5, 4.7.
- 21 "Șterge înscrierea" in the "..." menu: 3.3.
- 22 Înscrieri toolbar filter: 3.1.
- 23 "Vârstă" in the full table, blank cases: 3.1, 3.2.
- 24 readable date formats, Editează picker: 1.3, 3.4, 4.7.
- 25 wish edited last under "Abonament": 3.4.
- 26 no copy to the athlete after confirmation: 1.3, 3.4.
- 27 school move keeps the subscription choice: 1.3, 3.6.
- 28 group picker order, no suggestion: 0, 4.3.
- 29 membership "from": 1.4, 4.3.
- 30 wish Nu, never lowered: 1.4, 4.4.
- 31 registration without season reference: 4.3.
- 32 undo scope, toast: 3.5, 4.6.
- 33 same-tab links: 3.3, 4.1, 5.
- 34 record opens on Date: 6.1.
- 35 Secțiune: 5.
- 36 "Marchează activ", confirm for inactive: 1.5, 6.6.
- 37 phone card: 5.
- 38 Profil public controls, read-only name: 1.2, 6.3.
- 40 deleted athlete history, competition participations: 1.6, 6.6.
- 41 Adaugă sportiv form: 6.7.
- 42 old route redirect, menu position: 7.
- 43 website date picker: 1.3, 9.

Applied in this draft by following an existing rule (marked `[pattern, decided by Claude]`):
- P1 "->" in quoted copy is the UI arrow "→" (top).
- P2 abonament hint with a comma instead of the middle dot, wording otherwise as prototype v5 (4.4).
- P3 athlete history line without a group: "Înscriere confirmată: <nr>" (1.6).
- P4 "Confirmare anulată" written on both records (1.6).
- P5 old first/last values readable until the name migration has run (1.1).
- P6 "unconfirmed" = no athlete linked, so old "Confirmat" rows without an athlete keep the "Sportiv existent" line (2.1).
- P7 deploy grouping by the Sigur name rule; name and contact from the newest registration; an unreadable-date registration forms its own athlete (2.3).
- P8 duplicate rule: Sigur or Probabil between athletes, or name agreement when one has no birth date; computed once at deploy; flag cleared by "Nu e același copil", merge or delete (1.1, 2.3).
- P9 "with a public page" = page on (1.5, 11 step 12).
- P10 duplicate line under the record header; "Unește" opens the merge with the other athlete chosen (6.1, 6.6).
- P11 merge: the deleted profile's competition participations go with it, as on delete; the other record's main group stays main when the kept record has none that season (6.6).
- P12 slug read-only in Profil public once the profile exists (6.3).
- P13 Adaugă sportiv search works like "Caută alt sportiv" (6.7).
- P14 admin birth date pickers use the website's selects and range, a stored year outside it stays selectable (3.4, 6.2, 8).

Earlier low-impact answers cited `[3b Qn]` were also decided by Claude (DECISIONS "phase3b, decided by Claude").

## Open (resolved, decided by Claude 2026-10-26)

1. Current-season (2026-2027) registrations submitted before the deploy do NOT create athletes at deploy; they get a record when confirmed (as "Sportiv nou" or linked to an existing athlete). Athletes are created only from seasons before the current one. [DEC 2026-10-26 open #1, decided by Claude]
2. Matching adds one case for athletes without a birth date: the same normalized full name (word order and one typo per word ignored) counts as "Probabil" (never preselected, "Sportiv existent" line shown). [DEC 2026-10-26 open #2, decided by Claude]
3. Confirmation dialogs (existing `ConfirmDialog`):
   - "Anulează confirmarea": title "Anulezi confirmarea?", message "Se anulează legătura cu fișa, grupa adăugată și statusul A.C.S. scris la confirmare.", confirm "Anulează confirmarea".
   - "Marchează inactiv": title "Marchezi sportivul ca inactiv?", message "Nu mai apare în liste. Istoricul rămâne.", confirm "Marchează inactiv".
   - Merge: title "Unești cele două fișe?", message "Rămâne fișa „<nume>”. Cealaltă se șterge. Acțiunea nu poate fi anulată.", confirm "Unește".
   [DEC 2026-10-26 open #3, decided by Claude]
