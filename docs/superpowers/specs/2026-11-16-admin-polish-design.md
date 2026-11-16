# Admin polish package (2026-11-16)

User approved items 1, 4-8 and 10 on 2026-11-15/16. Items 2, 3, 9 were approved in principle ("for everything else I approve"); their shape below is decided by Claude and shown to the user before build.

Repos: edusport_backend (admin, server, e-mails), edusport_frontend (site registration form, portals copy). Behaviour tests only, no visual tests. Copy: Romanian, diacritics, no em/en dash, no middle dot, no emoji.

## 1. Înscrieri phone

- Validation with `libphonenumber-js` (default country RO), on the site form (live error, existing text "Numărul de telefon nu este valid.") and on the server (`registration-input.ts`: invalid phone refused with the same text). Load the library only in the registration form bundle.
- Store normalized E.164 (`+40722123456`); display international format (`+40 722 123 456`).
- Existing registrations: never rewritten. A number that does not parse shows a warning icon (tooltip "Număr de telefon invalid") in Înscrieri.
- Înscrieri detail panel (DateTab phone field) and spreadsheet phone cell: number + copy icon (toast "Copiat.") + WhatsApp icon. WhatsApp opens `https://wa.me/<digits>?text=<message>` in a new tab.
- Message: `COPY NEEDED` (user writes it; placeholders `{parinte}`, `{copil}`). Keep the template in one copy constant.
- Pressing WhatsApp on a registration with status "Nou" sets it to "Contactat" (same path as the existing Contactat button). Other statuses unchanged.
- Approaches considered: libphonenumber both sides (picked: same rules everywhere, normalized storage needed by wa.me); hand regex (refuses foreign numbers or passes wrong lengths); normalize only at display (bad data still saved).

## 2. Prețuri and Grupe link (Claude's shape)

Data already links them: `group.priceList` (manyToOne price-list). Show it both ways:
- Grupe list and group page: the group's price list name as a link to Prețuri (opens that list's card).
- Prețuri: each price-list card lists the groups using it, each a link to that group. A list no group uses says nothing extra.
- No data model change.

## 3. Tabele: one column per session (Claude's shape)

- New Tabele subject "Prezență pe ședințe": rows = athletes, one column per session in the scope, cell = present mark, plus a total column. Scope requires one group and a period (like the Prezență grid: group + month); the period can be any range.
- Built from the existing group-matrix builder (`src/club/presence/attendance/group-matrix.ts`), not a second implementation. Export (XLSX) works like other subjects.
- The fixed column catalogue stays for the other subjects; this subject's session columns are generated from the scope.

## 4. Shorter messages (admin + portals)

Apply the audit (scratchpad copy-audit-admin.md, copy-audit-portals.md) by five rules:
1. No hints under inputs; required fields get a star; "Opțional" goes.
2. No subtitle that restates the heading.
3. A rule/limit becomes a lock or info icon with the words in its tooltip.
4. One short form per repeated message: "Nu se poate anula.", "Nu s-a salvat. Verifică datele.", "Nicio X.", "Copiat.".
5. Dialogs keep one line: what happens and whether it can be undone.
Server-matched strings (portal `PRESENCE.archived`, `LOST_ATHLETE`, `STATES.noAccess`) change on both sides together. Fix MesajePage missing diacritics.

## 5. One dropdown look (admin)

Every dropdown trigger (MenuButton: Status, Nivel, Alte filtre, Formulare goale, Export, and any other) takes the Select look: same height, border, weight, chevron. One shared change.

## 6. Phone top bar (admin)

At phone width hide Strapi's own top bar items (Home, Content Manager, Media Library, account, Strapi burger). Show the EduSport logo left and the EduSport menu right. The pages stay reachable by URL.

## 7. E-mails always light

In the shared e-mail frame (`registration-template.ts` HEAD / `emailPage`): `color-scheme` and `supported-color-schemes` meta set to light only, `:root{color-scheme:light only}`, white backgrounds also set as `background-image:linear-gradient(#ffffff,#ffffff)` so Gmail apps do not invert. Outer area white (was #f3f4f6).

## 8. Connected devices (admin and portal)

- A device not seen for 30 days is no longer listed and is treated as ended (revoked) when touched.
- A new login from a browser with no live device cookie reuses an ended or stale row with the same label instead of adding one.
- The new-device e-mail goes only for a label (device type + browser) never seen on that account in the last 30 days.
- 2FA "Ține minte dispozitivul" unchanged.

## 9. Program calendar filters (Claude's shape)

The legend pills above the admin Program calendar are filters, which is not obvious. Replace with a row labelled "Arată:" of checkboxes (the kit Checkbox) with the same colour mark per type. Unticked types hide from the calendar. Same behaviour, clear purpose.

## 10. Input text size on phones

On phones text inputs are 16px (stops iOS zoom on focus) but select triggers stay 13px. Make select/menu triggers 16px at phone width too, so all fields match. (Decided by Claude.)

## Amendments 2026-11-16

User-approved after the first version. Layout root causes: `2026-11-16-layout-audit.md`. Plan tasks 17 to 26.

- A. Layout: one `--ui-inset` token (16px, 12px at max-width 640px) for header, body, cards, modal, drawer, table bars, tabs, table first and last cell and the page-local toolbars; one card component; field gap 12, block gap 16; all controls 34px; one breakpoint set (phone 640, tablet 1024) so a tablet gets two columns. Before/after screenshots of Înscrieri, Sportivi record and Setări at 1440, 820 and 390 are approved by the user before the remaining layout changes.
- B. Sportivi record Date tab: section header row "Date" with "Editează" at the right edge (Salvează and Renunță there in edit mode); same in the Înscrieri detail panel. "Obligatorii pentru complet" hint removed (star on required fields). "Membru A.C.S. <season>" is a normal field. "Acces portal": header row, e-mail, flat square badge (FĂRĂ ACCES, INVITAT, ACTIV), button at the right edge, "Fără acces în portal." removed, on phone the button takes its own full-width line.
- C. Sportivi list: filter popup left list and right content scroll independently; "Sortare" select only on phone.
- D. Grupe group page: coaches leave the subtitle; one labelled row "ANTRENORI" with names as links (still open the portal account block); subtitle keeps section, price list link, athlete count.
- E. Adaugă abonament: "Membru A.C.S. <season>" checkbox on top (ticked when already member) switching the item list between member and unaffiliated prices; saving with it ticked makes the athlete a member; optional "Adaugă cotizația (<fee> lei)" when membership turns on; each option shows its price right-aligned. Wording: "preț nemembru" to "preț neafiliat", "Preț non-membri" to "Preț neafiliați", "Non-membri" to "Neafiliați".
- F. Sportivi record "Competiții" tab (summary tiles and list from the portals' results source, newest first, season filter); Competiții page gains "Podiumuri" and "Cel mai bun loc" columns. Labels beyond these words are `COPY NEEDED`.
- G. Tabele page rework to the approved mockup `2026-11-16-tabele-mockup.html` (design authority; its data is sample only): rail collapsible from a header button (remembered per browser, slide-over at 900px and below), title is the table name, header only "Salvează tabelul" and a split "Descarcă Excel" (Excel, CSV), segmented type picker including "Prezență pe ședințe", one period select, filter chips plus a "Filtru" popover of unused fields, grouping select per type, "Coloane" popover (search, checkboxes, up and down), count with the type's noun, collapsible group rows, totals only with money columns and "Total general", header click sorts, row opens the athlete. The "Aspect: Listă / Foaie de calcul" toggle is removed (decided by Claude, mockup approved by the user). "Restanțe" uses a removable chip "Doar cu rest de plată". Plan tasks 28a to 28c.
- H. Coach portal calendar: tapping a session opens one sheet: Prezență, Anulează (optional reason), Mută, Șterge. Group session reuses the Program DateSheet; an individual lesson gains "Anulează" (stays in the calendar marked cancelled with the reason, athletes see it cancelled and get a Mesaje notice like group cancellations); "Șterge" stays for mistakes. Plan Task 27 (backend work only if the first verification step finds it missing).
- Strict user rule for G and H: no helper text anywhere (no descriptions on buttons, menu items, toggles or options, no row labels such as "Arată" or "Filtre", no hints, no explanatory notes); controls carry only their name or an icon with a tooltip naming it.
