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
