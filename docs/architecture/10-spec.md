# 10. Specification: EduSport club management

Status: draft for review, 2026-10-19.
Sources: every decision in `edusport_frontend/docs/portal/DECISIONS.md` (dated entries win over this summary if they disagree), the UML diagrams in `diagrams/`, and docs 01 to 09 in this folder.
UI copy is Romanian and quoted as it will appear. Code, docs and diagrams are English.

## 0. Scope

In scope: registrations, athletes, seasons and schools, groups, schedules, attendance, individual lessons, subscriptions, payments, documents, notifications, the coach site (antrenor.) and parent site (sportiv.), and login for portal and admin.

Out of scope: website content editing (pages, news, announcements, menus), which stays as it is.

Later (not in this spec): online card payments, discounts, admin roles beyond one, Apple login, redesign of the coach-portal athlete card, a second school's screens (the data model supports it now).

## 1. Actors and where they work

| Actor | Where | Can |
|---|---|---|
| Visitor (new parent) | Website | Submit a registration for a school |
| Parent (or the athlete, 18+) | `sportiv.<domain>` | See own children's attendance history, subscriptions and payments; account and security settings |
| Coach | `antrenor.<domain>` | Groups (all visible, others' marked), attendance, individual lessons, own Club groups' schedule, add a new athlete (flagged "nou"), own hours |
| Admin | Strapi admin panel | Everything a coach can, plus registrations, athletes, groups, schedules, prices, seasons, subscriptions, payments, documents, accounts |

One admin role for now: every admin sees everything. Use cases: `02a`..`02h`.

## 2. Data model

Diagrams `03a`..`03d`, mapping to Strapi in `07-strapi-mapping.md`, glossary in `01-glossary.md`.

Rules that must always hold:

1. Every person who trains has exactly one **Athlete** record (renamed from `sportsperson`). The optional **PublicProfile** is a part of the athlete in its own table; only that table is served to the website.
2. An athlete is on 0..n group lists per season; exactly one is the **main group** (when on any list). Totals count distinct athletes.
3. **Section** is a record: kind school or club, name, slug, location, public page, registrations open. Today: "Școala de Patinaj - AFI Cotroceni" and "Club". Groups, price lists and registrations belong to a section.
4. **Season** is a record (label, start and end month, membership fee, current). Memberships, subscriptions and registrations point to it.
5. Groups on the same **price list** share subscriptions. Today: Standard = Primii Pași, Începători, Intermediari Bronze, Intermediari Silver, Avansați Silver, Avansați Bronze; Avansați Gold has its own list. Club: Profesioniști, Avansați (Andreea Pascu).
6. A group's schedule is 0..n **calendar events** linked to it. Only group-linked events produce sessions. Competitions, holidays and school events stay unlinked.
7. A **subscription** stores the item name and price at purchase, a start date chosen by the admin, slots (6 or 8) and a validity end that free weekends extend. Each Skating School attendance uses one slot of an active subscription on the same price list; used-up or expired subscriptions use none.
8. **Membership (A.C.S.)** is stored per athlete per season (nothing is reset; past seasons stay in history), with three states: Da, Nu, În așteptare. Member prices apply only with Da for that season. When a new season becomes current, last season's members start as În așteptare; everyone else has no value (shown Nu).
9. Every edit, correction, move, merge and send writes a **HistoryEntry** (who, what, when, old and new value).

## 3. Features

### 3.1 Public registration (website)

- Form mirrors the club's current form exactly (questions, wording, options, conditional fields). 3 steps: "Date înscriere", "Abonament", "Finalizare înscriere". One field per row.
- Prices, membership fee, season and period are read from the admin data, never typed into templates. Non-member upsell computed from the prices. Next weekends of the school shown on step 2.
- School: the school page's "Înscrie-te" preselects it; the general link asks "Alege școala" only when 2+ schools are open; the school stays at the top of every step with "Schimbă". Registrations open or close per school.
- On submit: registration number `<season start year>-<4-digit sequence>` (one numbering across schools, unique, server-assigned); PDFs built (Acord always, Cerere de adeziune only if membership = Da); e-mail queued (Brevo, retry, style E1); row synced to the season's Google Sheet tab; matching to existing athletes runs.
- Success screen with number, PDF download, WhatsApp channel link. Copy: "Documentele vor fi semnate la prima ședință de curs."
- Consents stored as two Da/Nu values (GDPR, Regulament) with the submission time.

### 3.2 Registrations in the admin (Înscrieri)

- Existing list, filters, bulk actions, season move, archive, CSV export and Sheets dialog stay.
- List: "Nume sportiv", "Vârstă" column, small "Sportiv existent" line under matched names, fixed row height, filter "Sportiv existent". School column and tabs only with 2+ schools.
- Panel tabs: Date (only editable tab; saving rebuilds the PDF, no e-mail) | Abonament | Documente | Istoric. "Retrimite e-mailul" with confirmation.
- "Confirmă înscrierea": card "Sportiv existent / Sportiv nou" with the last group; "Compară și actualizează" table with per-field "Actualizează" ticks (on by default except name and birth date); "Caută alt sportiv"; main group optional. Creates or updates the athlete (reactivates an inactive one), links the registration. No e-mail. No subscription is created (the form's choice is only the parent's intent).
- An admin can move a registration to another school.

### 3.3 Athletes

- One private list ("Sportivi") with filters (incl. Secțiune). Record tabs: Date | Grupe și abonament | Plăți | Profil public | Documente | Istoric. On phones the record opens as a bottom sheet.
- Statuses: "nou" (added by a coach, reviewed by the admin: merge duplicates, complete data), active, inactive (left; hidden from lists, history kept; reactivated by a confirmed registration or by being added to a group).
- "Date complete" = name, birth date, contact person, phone, e-mail.
- Parent access: "Invită părintele" (manual), access list per athlete (several parents possible; one parent can see several children).
- Personal data: yearly list "Inactivi de peste 3 ani"; buttons "Exportă datele" and "Anonimizează" (removes name, contacts, birth date; keeps counts and payment totals). Periods to confirm with the accountant or a lawyer.
- Existing public profiles (about 60) get athlete records marked "Date incomplete".

### 3.4 Seasons and schools

- Season record; marking a new season current carries all groups over; per group the admin may copy last season's members (typical: Club copied and edited, Skating School left empty and filled from registrations).
- Section records as in section 2. Screens built for one school + Club; a second school is added by the admin and gets its page `/cursuri/<slug>`, a "Cursuri" menu entry, its groups and price lists.

### 3.5 Groups (admin, Grupe)

- Tabs per section (today "Școala de patinaj" and "Club"), columns Grupă, Program, Antrenori, Sportivi; row opens the group; "+ Grupă nouă" in the open tab. Only admins create groups. No capacity limit.
- "Fără grupă" button with a count next to "+ Grupă nouă" (disappears at 0): dropdown with each athlete, source and proposed group (SearchableSelect), "Alocă" per row and "Alocă toți în grupele propuse"; toast with "Anulează".
- Group page: select athletes, "Mută" (changes the main group) or "Adaugă și în grupă" (another list). Move window: Sportiv, Din / În, subscription bar (title, expiry, 8 segments, "5 folosite", "3 rămase"); only Avansați Gold adds "Abonamentul actual rămâne valabil. Următorul, la prețul Avansați Gold." Toast with "Anulează". No "Și în ..." line under names.

### 3.6 Schedules

- Admin calendar (existing Lună / Listă calendar and side panel) gets one field: **Grupă**. Events can repeat weekly, every 2 weeks or monthly; single dates can be cancelled, moved, or marked liber; global pauses exist (need an admin screen).
- Coach app, group tab **Program**: month navigation (Listă / Lună), all regular schedules with "Schimbă", one "+ Adaugă program" with "Se repetă" (on: Cât de des, days, start, duration, De la / Până la; off: one date), per date "Ține / Anulează / Mută" with optional reason and an "Anunță părinții pe e-mail" tick. Times are start + duration.
- Coaches edit only their own **Club** groups. **Skating School group schedules: admin only** (coach Program tab is read-only).
- A session recorded on a day with nothing scheduled is allowed; it shows as "În afara programului" in the group's attendance, not on the website.

### 3.7 Attendance and individual lessons

- Coach flow as approved on 2026-10-01 (coach-mobile.html), with: bottom bar Azi / Grupe / Istoric / Profil; list starts empty (tick who came); subscription status under each name ("3 ședințe rămase" / "Fără abonament"); "Antrenor" field (+ extra coaches); date button to record another day; warning when a session already exists; stand-in for another coach; "Adaugă sportiv" (search first, "Sportiv nou").
- Visitor: "Adaugă doar la ședința asta" (admin) adds an athlete from another group to one session only; their main group shows under the name.
- Corrections: coach until the end of the month, admin any time; every correction in history.
- Admin: menu "Prezență" (all groups, today plus past "nefăcute"; click opens the session panel; "+ Ședință nouă") and the group's "Prezență" tab (month list of sessions: date, "x din y", "nefăcută", "urmează", coach). Admin can browse and correct all attendance and all coaches' individual lessons.
- Individual lessons are separate (coach + one athlete, duration).
- Per coach: coach sees own month in Istoric (group sessions, individual lessons, hours); admin report "Pe antrenori" per month with CSV export. No amounts.

### 3.8 Prices, subscriptions, payments

- Price lists with items (subscription 6 or 8 sessions, single session, individual lesson; member and non-member price; "inclus" flag). The website Prețuri page reads the Skating School lists. Membership fee on Season.
- Adding a subscription (any admin, also from attendance): item, start date, price frozen, and the option to cover earlier Skating School attendances that had no subscription. Validity 4 school weekends; free weekends extend it; unused slots are lost at expiry.
- Membership fee paid for a season (the admin picks it, default current) -> membership Da for that season only.
- Club groups are billed after training (sessions x price of the day), settled per month per athlete: sessions, due, paid, remaining.
- Payments recorded with method Numerar / Card (POS) / Transfer bancar (and "Încasat la patinoar" for school subscriptions). No document generated for these; paper receipts as today.
- No discounts. Online card payments later (then an e-mailed "Confirmare de plată", "Nu este document fiscal").

### 3.9 Documents

- Page "Documente" with tabs "Documente sportivi" | "Documente club" | "Tipuri de documente". Types are data (generated or uploaded; when; blank form; attaches to athlete or club). Uploads PDF/JPG/PNG up to 10 MB. Blank forms menu. ZIP of a selection or the whole filter (server-built, progress, 24 h link). Paging 50 (desktop) / 30 (phone); "select all matching" rules; filter change clears selection.
- Generated: Acord (approved layout) and Cerere de adeziune (only if membership Da); no seal; association details in the footer.

### 3.10 Notifications (e-mail, Brevo)

- Always: registration received (with PDFs), portal invitation, password reset, login code, login from a new device.
- Chosen: "Plată înregistrată" to the parent; schedule change to the group's parents only when "Anunță părinții pe e-mail" is ticked.
- Not sent: at confirmation, on registration edits, subscription reminders, monthly dues, attendance reminders, new-registration alerts.
- E-mails are queued jobs with retry; failures visible to admins.

### 3.11 Coach and parent sites

- Addresses: public website on the main domain, parents/athletes on `sportiv.<domain>`, coaches on `antrenor.<domain>`, admin on the CMS subdomain. One frontend app picks the site by host name. One account per person; a coach who is also a parent logs in on each address separately.

- Coach: as in 3.6 and 3.7; sees parent contact and "Sună" for athletes in own groups.
- Parent: accept invitation, set and change password, attendance history, subscriptions and payments per child; child picker only with 2+ children; an 18+ athlete uses the same account as personal.

### 3.12 Login and security

See `08-authentication.md`. Summary:
- Coach and parent sites: e-mail first; the browser may offer a saved passkey ("Folosește cheia de acces" on the password page); otherwise password; optional two-factor (authenticator app, e-mail code); "Continuă cu Google". Accounts in Strapi (Users & Permissions). Same pages and messages for every e-mail.
- Admin: e-mail + password or "Continuă cu Google" (built by us), then optional two-factor (app, e-mail code, passkey); Google skips two-factor.
- Level AAL1 accepted; AAL2 methods offered. Sessions slide by 7 days, hard maximum 30 days.
- Checklist: attempt limits, single-use 10-minute codes, hashed backup codes, HTTP-only secure cookies with rotation and revocation, passkeys bound to the domain with user verification, encrypted secrets, new-device e-mail, refusal of leaked passwords.

### 3.13 Shared admin UI

Built with the flow, in `src/admin/ui`: BottomSheet (phone) / rich dropdown (desktop); filter dropdown layout; "selected" style E; Toast `action` (for "Anulează"); custom Select and Radio; SearchableSelect for group pickers; Drawer and Modal reused. Admin pages work on phones.

## 4. Data migrations

As in `07-strapi-mapping.md`: seasons, sections (AFI Cotroceni + Club), groups from today's text (fix "Primii Paşi" to "Primii Pași"), athletes from existing public profiles, registration numbers backfilled per season, price lists from today's prices, Skating School calendar events linked to groups.

## 5. Quality

- Every new admin and portal page works at phone width.
- History for every change; nothing private in public endpoints (tests assert it).
- Tests for the rules in section 2 (main group, slot use, membership states, numbering, matching).
- Pen-test checklist from 3.12 verified before launch.
- Strapi version pinned; tests around the custom admin login.

## 6. Needed from outside

- Club: Brevo account, DNS access for scoaladepatinaj.com (SPF, DKIM), e-mail sign-off text.
- Accountant / lawyer: retention periods, fiscal documents.

## 7. Proposed phases (detailed in the implementation plan)

1. Data foundation: new content types, migrations, history, tests for the rules.
2. Registration rebuild: form, numbering, PDFs, e-mail queue, Sheets columns, per-school.
3. Admin Înscrieri + Sportivi + confirmation and matching.
4. Groups and schedules (calendar group link, Grupe page, moves).
5. Attendance, subscriptions and payments in the admin.
6. Login (portal and admin) and the coach portal.
7. Parent portal.
8. Documents page.
Each phase is deployable on its own.
