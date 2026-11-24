# Feature switches (Funcții) design

Status: approved 2026-11-24. Repos: edusport_backend (branch `feat/feature-switches`, based on `chore/env-cleanup`) and edusport_frontend. Mockups: admin canvas https://claude.ai/artifact/Cx3uxTqtnuPWDAuB8vR6ws, boards Functii_B, Functii_B2, Functii_B3 (approved: page B, under Sistem).

## 1. Intent

A club uses only the parts of the platform it needs. A club that only wants a list of athletes, or does not track attendance or money, or does not want the portals, turns those parts off. Nothing else changes: the public site, registrations, athletes, groups and the calendar keep working exactly as today. This serves this club (portals or money unused for a while) and new installs (the install guide already makes the portals optional).

Goals:
- Five switches on one Super Admin page. A disabled feature disappears from the admin menu, the admin pages, the portals and the e-mails, and its server routes refuse.
- Disabling never deletes or changes data. Enabling again shows everything as it was.
- Today's production is unaffected: with no saved choice, every feature is active.

Non-goals:
- No new billing model (no monthly memberships; memberships stay session based).
- No per-role or per-user features; roles stay as they are.
- No switch for the public site, registrations, athletes, groups or calendar.

Anti-goals (a failure even if it works):
- Anything disappearing from the public site, including Program Cursuri, events and breaks.
- Data lost or altered by turning a feature off or on.
- A disabled feature still sending e-mails, or e-mails held back and sent months later when it is enabled again.

## 2. The switches

| Key | Name on screen | Depends on |
|---|---|---|
| `prezenta` | Prezență | |
| `abonamente` | Abonamente și plăți | `prezenta` |
| `portalAntrenori` | Portalul antrenorilor | portal installed |
| `portalParinti` | Portalul părinților | portal installed |
| `parcurs` | Parcurs și insigne | |

Always active: public site, Înscrieri, Sportivi, Grupe, Calendar și serii (with breaks and the public timetable), site content pages, Anunțuri on the site, Securitate.

Dependency rules:
- `abonamente` requires `prezenta`: every membership counts sessions from attendance (`subscription.slots`, `usedSlots`), and the Club monthly charges and lessons are billed from attendance (`presence/billing.ts`, `due/settlement.ts`). Disabling `prezenta` disables `abonamente` in the same save; `abonamente` cannot be enabled while `prezenta` is off.
- Decided by Claude: the coach portal does NOT require `prezenta`. It also serves the schedule, groups, athletes, calendar and competitions (`api/portal/routes/02-coach.ts`). With `prezenta` off, the coach portal hides only its attendance parts.
- `parcurs` stays independent. With `prezenta` off, the attendance-based pins (Antrenamente, perfect months) stop growing because no new attendance is saved; competition, membership and manual pins keep working.

Portals, installed versus active: a portal is installed when the server is set up for it (backend `PORTAL_HOSTS` lists it, frontend `PORTAL_HOST_*` set, DNS and nginx). The switch says whether an installed portal is active. Effective state = installed AND active. A portal that is not installed shows its switch disabled with the line "Portalul nu este instalat pe acest server." The switch never installs anything.

## 3. Storage

- New single type `feature-settings` with one JSON field `features` (`{ prezenta, abonamente, portalAntrenori, portalParinti, parcurs }`, booleans). Not added to `CLUB_ADMIN_UIDS`, so the Content Manager does not expose it to club admins; written only through the new route.
- Pure module `src/club/features/` : `readFeatures(raw, installed)` returns the effective set (missing row or key = active; dependency rules applied; portals ANDed with installed), and `applyChange(current, key, on)` returns the new set plus the list of features switched off with it. Unit tested.
- Routes: `GET /club/features` (area `any`, every admin needs it for the menu) returns `{ features, installed }`; `PUT /club/features` (area `superAdmin`) saves one change, applies the dependency rule, writes history, runs the side effects of section 6.
- Read cost: one `findFirst` per request that needs it, memoised for the request; no process cache, so a change is live on the next request in every container.

## 4. Admin panel

- Page `Funcții`: CUSTOM_PAGES entry, `area: 'superAdmin'`, menu link in group `system` after Securitate. Layout and copy as approved (section 7). Each switch change opens the warning dialog when it turns something off; turning on needs no dialog.
- One hook `useFeatures()` (fetch `GET /club/features` once, like `useAreas`). `EdusportLink` and CUSTOM_PAGES gain an optional `feature`; `visibleLinks` and `gatedLazy` hide and refuse a page whose feature is off (the page shows the existing NoAccess screen).
- Spots that hide, per feature (inventory with file references in `.superpowers/` report, summarised):
  - `prezenta`: menu Prezență and its pages (lessons, coach presence); group tab Prezență; Tabele subjects Prezențe and Ședințe; presence links in Calendar and Grupe panels; presence history inside the athlete record.
  - `abonamente`: menu Contabilitate (and the old Abonamente, Plăți, De încasat, Bani redirects); athlete record tabs Abonament and Plăți (`recordTabs`); Sportivi list column and filter Abonament; Tabele subjects Plăți and Abonamente; money menus in Prezență rows; abonament bar in the group move dialog. Tabele itself hides when none of its subjects is left. The delete refusal for an athlete with payments stays (it protects data).
  - `portalAntrenori`: Cont portal block in Membri echipă and in the group roster.
  - `portalParinti`: Acces portal block in the athlete record, bulk Invită în portal in Sportivi, the Portal sportiv option in Anunțuri (site option stays).
  - `parcurs`: athlete record tab Parcurs.

## 5. Server and portals

- Backend admin routes: `featureRoute(feature, area)` beside `adminRoute` in `src/club/admin-area.ts` adds the feature to the `has-role` policy config; a disabled feature answers 403 with code `featureOff`. Applied to route files 09 (attendance), 10 (subscriptions), 11 (payments), 12 (portal accounts), 13 (tables: per subject), 14 (athlete access) and `05-athletes.ts` parcurs routes.
- Portal API: `portal-session` already answers 404 when portals are off; it uses the effective set per host. Inside an active portal, presence, money and parcurs routes check their feature and answer 404.
- Frontend portals: the portal context payload (`/portal/*/me` or context) carries the effective features; `coachNav` and `sportivNav`, the route allow-lists (`coach-routes.ts`, `sportiv-routes.ts`) and each page check it; a disabled page is a 404. A disabled portal as a whole answers 404 on its host, as with `PORTAL_HOSTS`.
- Public site: untouched.

## 6. E-mails and background work

- Switching a feature off cancels its queued e-mail jobs (status `cancelled`, reason `featureOff`), so nothing is sent later: `payment` for `abonamente`, `portal-invite` for `portalAntrenori`, `portal-access` for `portalParinti`. Jobs already sent are history.
- New jobs of a disabled feature are never queued (their routes are refused).
- Crons `portalNotices` and `portalPurge` take the effective set: notices run only for an active parent portal; purge keeps its non-portal housekeeping always.
- Schedule-change e-mails to parents do not depend on the parent portal and keep being sent. Known limit (today's behaviour): the opt-out lives in the parent portal, so with it off nobody can opt out.
- Every change is written to history (who, when, which features changed).

## 7. Copy (Romanian, approved 2026-11-24 except where marked)

Page title `Funcții`, card title `Funcțiile platformei`.
Intro: "Alege ce părți ale platformei folosește clubul. O funcție dezactivată dispare din panou și din portaluri, dar datele ei se păstrează și revin când o activezi din nou."

- Prezență: "Antrenorii și administratorii completează prezența la fiecare ședință. Din prezență se calculează ședințele rămase din abonament."
- Abonamente și plăți: "Evidența abonamentelor, a plăților și a restanțelor, în Contabilitate. Părinții primesc pe e-mail confirmarea fiecărei plăți."
- Portalul antrenorilor: "Antrenorii au acces la un portal propriu, unde își văd programul, grupele și sportivii și completează prezența de pe telefon." While Prezență is off the line ends at "sportivii" (the clause about attendance is dropped).
- Portalul părinților: "Părinții și sportivii majori au acces la un portal unde urmăresc calendarul, prezența, plățile și rezultatele."
- Parcurs și insigne: "Sportivii primesc insigne pentru antrenamente, concursuri și vechime, iar antrenorii le pot acorda și insigne proprii. Insignele apar în fișa sportivului și în portaluri."
- Dependent and disabled: "Se poate activa doar împreună cu Prezența."
- Portal not installed: "Portalul nu este instalat pe acest server."
- Footer: "Mereu active: site-ul, înscrierile, sportivii, grupele și calendarul."

Warning dialog, one per feature, title "Dezactivezi <funcția>?", buttons Anulează / Dezactivează. Prezență (approved): "Prezența nu mai apare în panou și în portalul antrenorilor. Datele introduse până acum se păstrează și redevin vizibile când activezi din nou funcția." plus "Odată cu Prezența se dezactivează și:" and the list. Others (approved):
- Abonamente și plăți: "Contabilitatea, abonamentele și plățile nu mai apar în panou și în portalul părinților, iar e-mailurile de confirmare a plății care așteaptă să fie trimise se anulează. Datele se păstrează și redevin vizibile când activezi din nou funcția."
- Portalul antrenorilor: "Antrenorii nu mai pot intra în portal, iar invitațiile netrimise se anulează. Conturile lor se păstrează și funcționează din nou când activezi portalul."
- Portalul părinților: "Părinții nu mai pot intra în portal, iar invitațiile netrimise se anulează. Conturile se păstrează și funcționează din nou când activezi portalul. E-mailurile despre schimbările de program se trimit în continuare."
- Parcurs și insigne: "Parcursul și insignele nu mai apar în fișa sportivilor și în portaluri. Insignele acordate până acum se păstrează și redevin vizibile când activezi din nou funcția."

## 8. Tests (behaviour only)

- `readFeatures`, `applyChange`: defaults, dependency rule both ways, portals ANDed with installed.
- Routes: each feature's representative routes answer 403 `featureOff` when off and work when on; `PUT /club/features` refused for non Super Admin.
- Jobs: switching off cancels queued jobs of that kind only.
- Admin pure filters: `visibleLinks`, `recordTabs`, Tabele subjects with features off.
- Portals: nav and route allow-lists drop disabled features; a disabled portal answers 404.

## 9. Rollout

No saved row means all active, so deploying changes nothing for the current club. Backend and frontend deploy together. Needs `chore/env-cleanup` merged first (PORTAL_HOSTS).

## 10. Open items for the user

None. Approved 2026-11-24: the Parcurs line, the coach portal working without Prezență, the four warning texts, and the build details in section 11.

## 11. Build details (decided by Claude after the builder check; the user may overrule any)

1. Portal requests: the frontend learns a portal's state from the backend, no cache of its own. A portal that is installed but inactive answers 404 on its login and API routes (`portal-session`, `portal-auth`); the frontend shows its existing not-found page. Features inside an active portal come with the portal context payload the pages already fetch. If that call fails, the existing error page shows (no fail-open inside a portal).
2. Tabele: the gate sits in the tables controller, per subject. The catalog leaves out subjects whose feature is off; `query` and `export` for such a subject answer 403 `featureOff`. Saved views of a disabled subject stay in the database and are left out of the list. Tabele disappears from the menu when it has no subject left.
3. Always-active flows (new season, group moves, registration confirm, merge, delete) keep working and never touch existing data. While `abonamente` is off they skip any step that would create a membership or a payment; while `prezenta` is off nothing creates attendance. To verify per flow in the plan.
4. Attendance pins: with `prezenta` off they keep their current counts and stay visible while `parcurs` is active.
5. E-mails: two guards. Switching off cancels the queued jobs of that kind, and the sender checks the feature again when it claims a job and cancels it if the feature is off. So no path can send for a disabled feature.
6. Admin loading: `useFeatures()` loads with `useAreas()`; the menu draws when both are loaded. On a fetch error the panel shows everything (fail open), because the server refuses disabled routes anyway. The Funcții link and page exist only for the Super Admin.
7. The full list of places each feature touches, with file references, is in `2026-11-24-feature-switches-inventory.md` next to this file.
8. Frontend work goes on a frontend branch `feat/feature-switches` based on its `chore/env-cleanup`. The public site reads no feature flag; public announcements already use the site flag only, so portal-only announcements never appear on the site.
9. `featureRoute(feature, area)` adds an optional `feature` key to the `has-role` config. Existing area tests keep passing unchanged. The role is checked first (403 `forbidden`), then the feature (403 `featureOff`); the admin shows NoAccess for both.
10. Pages that mix features keep the page and hide only the disabled parts (for example the coach calendar without the Prezență action, the parent home without the membership card). Pages that are wholly one feature (Prezență, Plăți, Parcurs) answer 404 and leave the navigation.
11. The plan lists every cron and checks each against the switches. Known: pins are computed on read and nothing awards them in the background.
12. History: one club-level history entry per change (who, when, what was switched on or off, including the features switched off with it), shown on the Funcții page as the last change; no undo (switching back is the undo). The warning dialog's list comes from the shared pure `applyChange`, imported by the admin page, so the list is known before saving; the server applies the same function and returns the saved set.
