# 02. Use cases

Diagrams: `diagrams/02a`..`02h` (overview, Parent, Coach, then Admin by area).
Green «existing» = in the admin panel today; blue = planned (decided); yellow «proposed» = not decided.

## Coverage: today's admin panel

Every club-management page in the panel maps to a use case. Website-content pages
(homepage, page editors, articles, announcements, sponsors, history, menu, media) are out of scope.

| Admin page (today) | Diagram | Use case |
|---|---|---|
| Panou: registrations switch | 02d | Open or close registrations |
| Setări site: season, dates | 02d | Set current season and season dates |
| Prețuri (pricing single type) | 02d | Edit prices and membership fee |
| Calendar și serii | 02d | Manage calendar events and course series; cancel or change a single date |
| Editor formular | 02d | Edit registration form |
| Înscrieri: Google Sheets dialog | 02d | Connect Google Sheets and sync |
| Înscrieri: list, filters, detail | 02e | Browse and filter registrations; change status, add note |
| Înscrieri: bulk, season move, archive, CSV | 02e | Move to season, archive, delete, export CSV |
| Sportivi, Editor sportiv | 02e | Edit public profile and publish |
| Editor sportiv: skate results; Competiții | 02e | Link skate results, import competitions |
| Membri echipă | 02h | Manage team members (coach profiles) |
| Voluntari | 02h | Handle volunteer applications |
| Parteneri (results) | 02h | Handle partner requests |
| Mesaje contact | 02h | Handle contact messages |
| Strapi admin users and roles | 02h | Manage admin users |

## Gaps found in the code (facts, not decisions)

- No e-mail sending and no PDF generation exist yet (registration e-mail, documents are new).
- `calendar-blackout` (global pause ranges) has no admin UI.
- Google Sheets sync exists for contact and partner forms in the backend but has no UI.
- `navigation.pages` switches have no UI (website scope).
- Backend endpoints `archive-season`, `delete-archived-season`, `export-sheets` have no UI.

## To reconcile in the class diagram (step 3)

- Prices: today one `pricing` single type (member / non-member tiers + membership fee).
  Decided 2026-10-02: Skating School has ONE price table (Membri / Non-membri, Avansați Gold as a row).
  Decided 2026-10-10: groups sharing a price list share the subscription.
  These must become one consistent model.
- Season: `currentSeason`, `seasonStartDate`, `seasonEndDate` in site-settings; decided season period field.
- Groups: today free text (`team-member.groups`, `program.scheduleGroups`); decided one Group collection.
