# Admin redesign: Prezență, Contabilitate, Tabele, hidden filters (design)

Status: draft v1, 2026-11-12, for the user's review. Admin side only. No server data model change, one new read endpoint (4.2).

Sources and precedence (highest first):
1. The user's words in the 2026-11-11 session, quoted here as `[U "..."]`.
2. The approved boards of the admin canvas "Panou admin EduSport" (https://claude.ai/artifact/Cx3uxTqtnuPWDAuB8vR6ws), cited `[C <board title>]`. Boards used: "Varianta cu tab-uri: Prezență", "Varianta cu tab-uri: Contabilitate", "Tabele: implicit", "Tabele: Coloane deschis", "Tabele: Aspect Foaie de calcul", "Tabele: Aspect Listă", "Admin: acum și propunere". The "Varianta cu secțiuni pliabile" boards are rejected in favour of the tab boards.
3. Phase 11 spec `2026-11-07-admin-views-design.md` (P11), then P5 `2026-10-27-attendance-payments-design.md`, P4 `2026-10-27-groups-schedules-design.md`. Every rule of those specs not named here stays.
4. `[S n]`: decided by the spec author, low impact, listed in section 9, open to the user's veto.

Copy: Romanian, terse, no em or en dash, no middle dot, straight quotes, no emoji. Amounts "<n> RON", "." for thousands. "Rămas", never "Rest". Visual: no pills or circles (spinner only), no dashed or dotted lines, no eyebrow labels, square tabs and segments, real admin components only (`src/admin/ui`).

## 1. Intent

The user: "my problem is with how the data is displayed, either too complex, split in too many tabs, overcomplicating. I want a lot of that data but i want it to be organised better. in sections which make sense." The "Club și școală" menu today has 7 pages that show the same data in several places (Prezență, Abonamente, Plăți, De încasat, Bani, plus the Tabele tab on Sportivi). Filters sit open on every list ("all the filters are open, or visible it is REALLY loaded"). The table builder is "very hard to navigate and use".

Goals:
- Fewer pages, each with sections named after their content [U "the tab names make no sense ... saptamana is a way of visualising thats it"].
- Every list keeps a list or table view, friendlier [U "i want to still mantain a list or table view"].
- Filters hidden behind one "Filtre" button until wanted.
- A per-group presence table: rows athletes, columns dates [U "I remember requesting being able to see in a table format the prezenta of students"].
- Tabele: a page of its own, simple to use, exports to Excel and CSV.

Non-goals: Pauze, calendar, the athlete "Pentru" list, the Grupe page, the athlete record (each gets its own mock and approval later). No change to money rules, codes, receipt numbers, billing or presence rules. No new roles (6b-3 owns those).

Anti-goals: a tab or section named after a view mode or period ("Săptămâna", "Lunar"). Two places that compute the same figure differently. A filter row open by default.

## 2. Menu

"Club și școală" becomes, in this order [C "Admin: acum și propunere"; C "Tabele: implicit"]:

| Entry | Route | Area | Replaces |
|---|---|---|---|
| Grupe | unchanged | as now | |
| Sportivi | unchanged, the "Listă" / "Tabele" tabs removed | as now | |
| Prezență | unchanged path | as now | |
| Contabilitate | `/plugins/edusport-contabilitate` | none; parts `money` (below) | Abonamente, Plăți, De încasat, Bani |
| Tabele | `/plugins/edusport-tabele` | `money` [S1] | Sportivi > Tabele |

Access stays exactly as today [S1]: Restanțe, Abonamente and Plăți use their current routes with no area (every admin); "Pe scurt" and "Pe grupe" read `/club/money/*`, which is `money`, so an admin without `money` (after 6b) sees Contabilitate without "Pe scurt" and without the "Pe grupe" tab. Tabele routes are already `money` (`13-tables.ts`). Until 6b the shell ignores areas, so today nothing changes for anyone.

The old menu entries (Abonamente, Plăți, De încasat, Bani) are removed. Old routes redirect so bookmarks and in-app links keep working:
- `edusport-abonamente?...` to `edusport-contabilitate?tab=abonamente&...` (filters carried over);
- `edusport-plati?month=` to `?tab=plati&month=`;
- `edusport-de-incasat?month=` to `?tab=restante&month=`;
- `edusport-bani?view=prezentare&month=` to `?month=` (Restanțe tab); `view=contabilitate` to `?tab=pe-grupe`;
- `edusport-sportivi?vedere=tabele&v=<id>` to `edusport-tabele?v=<id>`.
Redirects stay until the deploy after the one that ships this redesign, then go [S2].

## 3. Shared pieces

3.1 Tabs. Prezență and Contabilitate use tabs, overriding P11 "no tabs except Sportivi" [U "i like the tabs"]. The tab row sits inside the page header card, under the title row, as the boards show [U "the tab picker in ths payments one is weirdly placed"; C "Varianta cu tab-uri: Contabilitate"]. Tabs reuse the existing `.ui-tabs` / `.ui-tab` styles of the Sportivi tab row (square, count as `.ui-tab-count`). The active tab is in the URL (`?tab=`), so a reload and the browser back button keep it. On phones the tab row scrolls sideways.

3.2 Hidden filters. Every list of the "Club și școală" pages (Grupe, Sportivi, Prezență, Contabilitate, Tabele) puts its filters behind one "Filtre" button using the existing `FilterPanel` (filters-v3: popover on desktop, BottomSheet on phones, choices apply at once) [U "we should be able to hide it unless fully want to edit some"]. When filters differ from the defaults the button reads "Filtre (<n>)" and a "Resetează" link sits in the panel [S3]. Other admin areas (Înscrieri, Competiții, Mesaje) get the same treatment in a later pass [S20]. The builder lists every list touched in the plan; the controls that stay outside "Filtre" are only the ones named in this spec (period stepper, tab, group picker, primary action).

3.3 Wheel scroll. Over a calendar or a table the mouse wheel scrolls the page (fix b584155: `overscroll-behavior: none` on `html, body` only). It stays.

## 4. Prezență

Page header card: title "Prezență", sub "Ședințe și prezențe pe grupe", then the tabs [C "Varianta cu tab-uri: Prezență"]:

"De completat <n>" | "Toate ședințele" | "Tabel pe grupă"

Default tab: "Toate ședințele" [S4]. Actions "+ Ședință nouă" / "+ Lecție individuală" / "Export CSV" stay on the tab where they belong (P11 5.1) at the right of that tab's control row.

4.1 De completat. The P11 4.1a undone list (unsaved held occurrences from `attendanceStartDate` to yesterday), moved off the day list into its own tab [U "uncompleted lessons on top and right below without any spacing we have by day"]. Columns "Data" | "Ora" | "Grupă" | "Antrenor" | "Stare", newest first, row opens the session panel. The count shows on the tab; at 0 the tab stays, without a number, and shows "Nicio ședință de completat." [S5]. It no longer appears at the top of "Toate ședințele".

4.2 Toate ședințele. The current P11 5.1 screen, without the undone block. Control row: view dropdown "Zi" / "Săptămână" / "Lună", the date with "<" ">", "Azi", the picker "Grupe" / "Lecții individuale" / "Antrenori", the "Listă" / "Grilă" switch (Grupe in Săptămână and Lună), "Filtre" [C "Varianta cu tab-uri: Prezență"]. The sub line of the section is the period label ("9-15 noi"). Everything else of P11 5.1 to 5.3 is unchanged (day header rows, states, grid, panels, coach page).

4.3 Tabel pe grupă (new) [U request above; C "Varianta cu tab-uri: Prezență", third tab]:
- Controls: group Select (all groups of the season, P4 order, Școala and Club), month stepper "<" "Noiembrie 2026" ">" (stops at the current month [S6]), "Descarcă Excel".
- Sub line: "<grupă>, <program>" ("Avansați Gold, Lu și Mi 19:00").
- Columns: one per held occurrence of the group in the month, plus every saved session of the group in the month (`source: added` included). Individual lessons never appear here (header "Lu 2"; a second session the same day "Lu 2, 18:00" [S7]), then "Total". Cancelled dates (Pauză, Anulat) are left out. Today's column carries "azi" under the date. Future columns are faded and their cells shaded, empty.
- A past occurrence with no saved session: header shows "necompletat" in the orange state colour under the date, cells empty, and it is not counted in Total [S8]. Clicking that header opens the session panel to complete it; a saved column header opens its session panel too.
- Rows: athletes with a membership in the group active on any date of the month, A-Z, then visitors who attended a session of the month under "Vizitatori" [S9]. Athlete name opens the record in a new tab (P11 rule). Sticky first column.
- Cell: a green check when present (`grup` ticked); Club sessions with `uscat` ticked show "U" next to the check, or alone [S10]. Absent is empty. No "Absent" state (P5 4.1).
- "Total": "<present>/<completed sessions>" per row ("3/4"); the denominator counts only completed sessions on dates when that athlete's membership was active (joined on the 15th: sessions from the 15th) [S19]. Visitors: "<present>" alone.
- "Descarcă Excel": the same matrix as .xlsx, check as "x", formats of P11 4.9, file `prezenta-<grupă>-<YYYY-MM>.xlsx`.
- Empty: group without occurrences in the month: "Nicio ședință în luna asta.".
- Server: `GET /club/attendance/group-month?groupId&month=YYYY-MM` answers `{ group: { id, name, program }, columns: [{ date, startTime, sessionId | null, state: 'completat' | 'necompletat' | 'urmeaza', occurrenceKey }], rows: [{ athleteId, name, visitor, cells: [{ grup, uscat }] }] }` and `GET .../group-month.xlsx` with the same query. Built from the existing range expansion and one session read (P11 4.1), no read per date. Same area as the Prezență routes.
- Phone: the matrix scrolls sideways inside its box, name column fixed.

## 5. Contabilitate

One page for money, replacing Abonamente, Plăți, De încasat and Bani [U "instead of bani rename to contabilitate"; C "Varianta cu tab-uri: Contabilitate"].

Header card: title "Contabilitate", month switcher "<" "Noiembrie 2026" ">" (stops at the current month, P11 5.6) at the right of the title row. Under it, always visible, "Pe scurt"; then the tabs:

"Restanțe" | "Abonamente" | "Plăți" | "Pe grupe"

URL `?tab=restante|abonamente|plati|pe-grupe&month=YYYY-MM`, default `restante` [S11].

5.1 Pe scurt. The five P11 5.6.1 cards (Încasat, De încasat, Abonamente active, Expiră în 14 zile, Neachitați), same figures, same muted lines, sized to their content instead of square [C board]. A card now switches tab and sets the filter instead of leaving the page (the month is already the header month): Încasat to Plăți with filters reset; De încasat and Neachitați to Restanțe; Abonamente active to Abonamente "Active"; Expiră în 14 zile to Abonamente "Expiră în 14 zile". The rule "card figure equals the linked list's count" (P11 S25) stays.

5.2 Restanțe (the De încasat content, renamed) [U "isntead datorii more like restante"]:
- Two blocks, "Școala de patinaj" then "Club", as P5 5.11 / P11 decided [U "for 2 as decided earlier"]. Columns as today (Școala per abonament: Sportiv, Grupă, Abonament, Preț, Plătit, Rămas; Club per athlete: Sportiv, Grupă, Ședințe, De plătit, Plătit, Rămas), sorted by Rămas descending.
- Each row ends with a "+ Plată" button (opens the payment window with "Pentru" preselected as De încasat does today: the abonament on a Școala row, "Club, <luna>" on a Club row, which is one per athlete, P5 5.10); the row opens the athlete Plăți tab (new tab).
- Each block ends with "Total rămas: <n> RON"; the Club block follows the month, the Școala block is month-independent (P5 4.14), its sub line says so: "Toate abonamentele neachitate integral" [S12].
- "Filtre": Secțiune (Toate, Școala de patinaj, Club; one choice hides the other block), Grupă [U "you can filter by it anyway right"].
- The "groups without a price list" notice stays above the blocks.

5.3 Abonamente: the current Abonamente list (P5 5.9, P11 5.6.4) with "Prelungește abonamentele" and "+ Abonament" in the control row, Stare and Grupă behind "Filtre". The list is not month-bound; the header month does not filter it, and the sub line reads "Școala de patinaj" [C board].

5.4 Plăți: the current Plăți list for the header month, sub "Încasate în <luna> <an>", "Filtre" (Metodă, Tip), "+ Plată", footer "Total încasat: <n> RON". Columns as today including "Nr. chitanță" [S13]. Edit, cancel, undo unchanged.

5.5 Pe grupe: the P11 5.6.2 breakdown (switch "Secțiune și grupă" / "Metodă" / "Scop", the muted note) followed by the P11 5.6.3 block (figures Numerar, Card (POS), Transfer bancar, Anulate, and "Export contabil" .xlsx / .csv). The "Plăți din lună" list of 5.6.3 is dropped here because tab Plăți shows the same rows [S14]; "Export contabil" content is unchanged (P11 5.6.5). Sub line "Datorat și încasat pe secțiuni, grupe și metode de plată".

The P11 "Prezentare" / "Contabilitate" picker of Bani goes.

## 6. Tabele

A page of its own [U "its a powerful tool may as well be a separate tab"]. Same server (P11 4.7, 4.9, 6: catalog, query, export, saved views, limits, 5.000-row refusal, read only). What changes is the screen [U "the constructor is ... ugly improve the UX"; C "Tabele: implicit", "Tabele: Coloane deschis", "Tabele: Aspect Listă", "Tabele: Aspect Foaie de calcul"].

6.1 Layout. Header card: title "Tabele", actions "Salvează" and "Exportă". Below, two columns: left rail "Tabele salvate" (260 px), right the table card. On phones the rail becomes a Select "Tabel salvat" above the card [S15].

6.2 Rail "Tabele salvate", groups:
- "Gata făcute" (system views, read only): "Plăți pe grupă luna aceasta" (default), "Prezență pe grupă", "Restanțe", "Abonamente care expiră", "Date de contact" [C "Tabele: implicit"]. "Restanțe" is the P11 "Rămas de plată" view renamed (label only, the id `rm-*` stays so old links work). "Prezență pe grupă" and "Abonamente care expiră" are the existing P11 views unchanged. "Date de contact" is new: Sportivi, columns Sportiv, Grupă, Părinte, Telefon, E-mail, sorted by Grupă then Sportiv. The P11 views "Sportivi activi" and "Sportivi pe grupă, cu plăți" are dropped from the rail; their ids still resolve if opened by link [S16].
- "Ale mele": saved views whose author is the current admin.
- "Ale colegilor": other admins' saved views, author name muted under the title, shown only when not empty [S17].
- The open view is marked (left bar and tint, as the board). Hover on an own view shows a "..." menu: "Redenumește", "Duplică", "Șterge" (8 s undo as P11).

6.3 Control row (one row, wraps on narrow screens), in order [C "Tabele: implicit"; U "why not a dropdown picker"]:
- "Tabel: Sportivi ▾" (bold), options "Sportivi", "Plăți", "Abonamente", "Prezențe". Replaces "Subiect" / "Un rând este".
- Season "2026-2027 ▾", period "Noiembrie 2026 ▾" (months of the season or "Tot sezonul"), "Secțiune: Toate ▾", "Grupă: Toate ▾", "+ Filtru" (the P11 filter lines, one popover each, a set filter shows as a button "<coloană>: <valoare>" with an "x").
- Separator, "Grupează: Grupă ▾" ("Fără", "Grupă", "Secțiune", "Lună", "Antrenor" per P11).
- "Coloane (<n>) ▾": popover with a search field "Caută coloană", "Afișate, în ordine" (ticked, drag to reorder) and "Ascunse" (unticked) [C "Tabele: Coloane deschis"].
- At the end, "Aspect:" "Listă" | "Foaie de calcul" (segment).
- No "Vizualizare", no "Subiect", no "Sfera", no builder block.

6.4 Table:
- Count line above: "<n> de sportivi" (plăți, abonamente, prezențe).
- Sort by clicking a header (asc, desc, off), arrow on the sorted header. Sorting inside groups. Replaces the "Sortare" control.
- Group rows collapsible (P11), subtotals and "Total" as P11.
- "Aspect: Listă": the current clean table, no row numbers, no cell borders.
- "Aspect: Foaie de calcul": cell borders, a "#" row-number column (empty on group and subtotal rows), sticky header and first column, zebra rows. Row numbers only here [U "no just in table is fine"].
- The aspect is remembered per admin in browser storage and is not part of the saved view or the export [S18].
- Athlete rows open the record in a new tab (P11).

6.5 Saving and export:
- "Salvează": on an own view, saves over it (enabled when changed). On a ready-made or a colleague's view it opens the "Vizualizare nouă" modal (field "Nume") and saves a new own view. Toasts as P11 5.5.
- "Exportă": menu "Excel (.xlsx)", "CSV", with a muted line on top "Exact ce vezi: <r> rânduri, <c> coloane, cu filtrele aplicate" [C "A: Exportă direct din listă"]. Files as P11 4.9.
- URL `edusport-tabele?v=<id>`; an unsaved change keeps the definition in the URL state as today.

## 7. What stays exactly as it is

All P5 and P11 money and presence rules, including: Completat / Necompletat / Urmează; present-only rows; amounts and "Rămas"; athlete names open in a new tab; codes and receipt numbers never reused; "Ședința x/y" one colour; payments cancelled never deleted, 8 s undo; no overpay; Tabele read only with catalog keys; the 5.000-row cap; `attendanceStartDate`; Club and Școala billed and shown separately; the Bani "Încasat" card versus breakdown note.

## 8. Tests (behaviour only, no visual tests)

- Old routes redirect to the right tab and keep month and filters.
- Tab in the URL survives reload; Pe scurt card click switches tab and filter, and its figure equals the list count.
- De completat count equals its rows; Toate ședințele no longer lists undone sessions.
- `group-month`: columns skip break-cancelled dates; unsaved past occurrence is `necompletat` and not in Total; visitor rows; a two-session day yields two columns; future month refused (400) [S6]; xlsx matches the JSON.
- Restanțe Secțiune filter hides the other block; totals equal the sum of rows.
- Tabele: switching "Tabel" resets columns to that subject's defaults; header sort cycles; "Salvează" on a ready-made view creates a new one; "Ale colegilor" lists others' views; export equals the screen.
- "Filtre (<n>)" count on every page touched.

## 9. Decided by the spec author (low impact)

- S1 Access unchanged: areas follow the routes each tab reads today; Tabele stays `money` as its routes already are.
- S2 Old-route redirects kept until the deploy after this one.
- S3 "Filtre (<n>)" and "Resetează" in the panel.
- S4 Prezență opens on "Toate ședințele"; the count on "De completat" draws the eye.
- S5 "De completat" with 0: tab stays, empty line "Nicio ședință de completat.".
- S6 Tabel pe grupă month stepper stops at the current month (same as Istoric on the coach portal).
- S7 Two sessions of one group on one day: two columns, the time in the header.
- S8 Unsaved past occurrence: header "necompletat", not counted in Total; its header opens the panel.
- S9 Rows: group members active in the month A-Z, then "Vizitatori".
- S10 Uscat shown as "U" in the cell.
- S11 Contabilitate opens on "Restanțe".
- S12 Școala block sub line "Toate abonamentele neachitate integral".
- S13 Plăți keeps the "Nr. chitanță" column (the board dropped it; the number is a P11 requirement and is useful when a parent quotes it).
- S14 "Pe grupe" drops the duplicate payments list of P11 5.6.3.
- S15 Phone: the Tabele rail becomes a Select.
- S16 Ready-made views follow the board: "Restanțe" and "Date de contact" in, "Sportivi activi" and "Sportivi pe grupă, cu plăți" out.
- S17 Colleagues' views in a third rail group "Ale colegilor".
- S18 Aspect stored per admin in browser storage, not in the view or the export.
- S19 Tabel pe grupă Total counts only sessions while the athlete was a member; added sessions are columns too; no lessons.
- S20 Hidden filters this round only on the Club și școală pages.

## 10. Rules this spec overrides

- P11 header and 5.1 "no tabs except Sportivi": tabs on Prezență and Contabilitate; the Sportivi "Listă" / "Tabele" tab goes.
- P11 5.1 undone block on top of the list: moved to tab "De completat".
- P11 5.5 Tabele screen (Vizualizare select, builder block, Subiect segment, Sfera, Sortare, six download buttons): replaced by section 6. Server and limits unchanged.
- P11 5.6 Bani page and its picker; P5 5.9, 5.10, 5.11 as separate pages: merged into Contabilitate.
- P11 "Rămas de plată" (renamed from "Restanțe" in av5): back to "Restanțe" [U "isntead datorii more like restante"].

## 11. Left to the builder

Component split, file layout, whether the old page components are reused inside the tabs or moved, the exact list of pages that get "Filtre" (3.2, listed in the plan), how the matrix renders many columns, test file layout.

## 12. Open for the user

None. The builder check (2026-11-12) raised access, redirects, ready-made ids, the Filtre scope, the group table's columns and Total, card links and the Club "+ Plată" target; all are answered above or settled as S1, S2, S16, S19, S20.
