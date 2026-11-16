# Admin layout audit (read-only)

Worktree: edusport_backend/.claude/worktrees/polish (feat/admin-polish). Measured in the DOM at 1440, 820, 390 on all 25 EduSport pages (script scratchpad/measure.cjs, m2.cjs, m3.cjs, output measure.json). No horizontal page scroll and no element past the viewport edge on any page at any width. The 3 Strapi core pages (_admin*, upload, cloud, content-type-builder) are not EduSport UI and were not measured.
Visual rules: nothing found that uses dashed lines or pills/circles; none of the proposed fixes adds any.

## Root causes

R1. No single horizontal inset. Horizontal padding of the parts that stack in one window is 13 / 14 / 15 / 16 / 18 px, so left edges drift by 1 to 5 px per layer.
- ui-ph 18, ui-body 18, ui-rail 18, table-bar 18, table-pager 18, inbox-head/tools 18 (styles.ts:77,188,189,337,349,374-379)
- ui-sec-h/b/f 13 (styles.ts:181-184), ui-ecard-h/b 14 (styles.ts:442,447), ui-row-b 13, ui-modal 15, ui-drawer/sheet 16, sbt-ph/pb/pa 15 (SubmissionTable.tsx:497-500)
- ui-table th/td 14 (styles.ts:341,346)
- Pages: all. Effect: title at x=275, card border at 275, card content and every input inside at 290 (sec 13+1 border = 15 px deeper); table text at 271 under a toolbar at 275.
- Fix: add token `--ui-inset: 16px` (space-4), `12px` at max-width:640px (space-3, equal to the phone page padding). Use it for ph, body, rail, table-bar, table-pager, inbox-*, sec-h/b/f, ecard-h/b, row-b, modal, drawer, sheet, and every page-local copy (below). Nothing keeps 13/14/15/18.

R2. Table cells are 14 px, bars above and below are 18 px.
- styles.ts:341 and :346 (`.ui-table th/td padding:10px 14px`) vs table-bar/pager 18.
- Pages: Sportivi, Inscrieri, Competitii, Contabilitate, Grupe, Prezenta, Sezoane, Tabele, Membri, Sponsori, Voluntari.
- Measured: first-column text/checkbox 271 vs search/toolbar 275 (4 px); Inscrieri checkbox at 265 (10 px, first td padding-left measures 8).
- Fix: `.ui-table th:first-child,.ui-table td:first-child{padding-left:var(--ui-inset)}` and the same for last-child padding-right, only when the table is flush in a window (`.ui-win > .ui-table-wrap`, `.ui-win > * .ui-table-wrap`), not when inside .ui-body or .ui-sec-b (Sezoane, Grupe tables already sit at 275 via body padding). Remove the 8 px first-cell case in Inscrieri (`.sbt-chk`, SubmissionTable.tsx:490).

R3. Page-local bars re-declare 18 px instead of sharing one toolbar class: `.spv-toolbar/.spv-chips/.spv-banner/.spv-foot/.spv-bulk/.spv-dups` (sportivi/styles.ts:7-34,79), `.sbt-tbB/.sbt-chips/.sbt-bulk` (SubmissionTable.tsx:462-478), `.tbl-controls` 14/18 (tabele/styles.ts:27, phone override 12/16 at :87), `.pz-bar/.pz-legend/.pz-label/.pz-notices` (prezenta/styles.ts:6-53), phone overrides spv 16 (sportivi/styles.ts:85-91).
- Fix: replace all by `padding-inline:var(--ui-inset)` (R1) so phone and desktop come from one place; vertical padding 12 everywhere (now 10/11/12/14). Tabele controls on phone are 16 px vs 12 px page padding.

R4. Tabs have no inset in the window. `.ui-tab{padding:9px 12px}` (styles.ts:318-319) with container padding 0: Prezenta first tab text at 269 (underline starts at the card edge 257) vs title at 275; Inscrieri/Sportivi get 18 only through the local `.ui-tabs.spv-tabs{padding:0 18px}` (sportivi/styles.ts:72), so their text is at 287.
- Fix: `.ui-tabs{padding-inline:var(--ui-inset)}` in styles.ts, delete spv-tabs rule. Pages: Prezenta, Sportivi, Inscrieri, Grupe-style tab pages.

R5. Two card components for the same job. `.ui-sec` (header 10/13, body 13, gap 12) and `.ui-ecard` (header 12/14 with sunken bg + subtitle, body 14, gap 12). Setari and Voluntariat show both on one page: header height and content inset differ by 1 to 2 px, header styles differ.
- Fix: same R1 token for both, header `padding-block:12px`, body gap `var(--ui-space-3)`. Longer term fold ui-sec into EditorCard (ui/EditorCard.tsx, Section.tsx).

R6. Phone gutters stack. `.ui-page` 12 on phone (styles.ts:58) but ph/body/sec keep 18/18/13 (only .ui-dsec and drawer shrink). Inputs sit 46 px from the screen edge on 390 wide (Setari: page 12 + win 1 + body 18 + card 1 + pad 13 + ...; measured input left 46) and the 6 or so nested cards on Anunt-edit, Competitie-edit, Program, Meniu waste 25 percent of the width.
- Fix: R1 phone value 12, plus `.ui-ph`/`.ui-body` inset 12 and `@media(max-width:640px){.ui-sec-b{padding:12px}}`. Input left then 12+1+12+1+12=38.

R7. Rhythm between fields is not one value. Measured sibling-field gap: 16 in `.ui-stack` (Anunt-edit, Program), 12 in `.ui-sec-b`/`.ui-grid2`/`.ui-ofc-grid` (Setari, Voluntariat), 11 via `margin-bottom:11px` `.sbt-fld` (Inscrieri drawer, SubmissionTable.tsx:501), 10 in `securitate/layout.tsx:10` (`gap:10`), `.ui-body` gap 14 (styles.ts:189, off the 4px scale) vs ui-stack 16 vs ecard-b 12. Label to input is 4 everywhere (fine).
- Fix: fields always 12 (`--ui-space-3`), blocks always 16 (`--ui-space-4`). Set `.ui-body{gap:var(--ui-space-4)}`, `.sbt-fld{margin-bottom:0}` inside a flex column gap 12, securitate gap `var(--ui-space-3)`, and in `.ui-stack` that holds fields use the card gap. Also `.ui-ph` bottom padding 16 and `.ui-table-bar` etc padding-block 12.

R8. Date input is 2 px taller than every other control. Native `input[type=date]` renders 36 px vs `.ui-input` 34 px (Setari, Anunt-edit x2, Competitie-edit). Inscrieri `.ui-sel` in toolbars is 30 px (`padding:5px 8px`, `.sbt-ft-l .ui-input`, SubmissionTable.tsx:518) next to 34 px search; inline selects sit on a 4 px lower line.
- Fix: `${R} .ui-input[type=date]{height:34px;box-sizing:border-box}` in styles.ts:170 block. Toolbar selects: use the same 34 px (one size token) or make the whole toolbar 30 px (`.ui-input--sm`), not mixed.

R9. Breakpoints disagree, tablet is a stretched phone. 640 (page, ph, grid2, radios), 720 (ofc-grid), 900 (ui-two, inbox), 1040 (sbt-split, panel), 1100 (fit page). At 820 the rail/list-detail layouts (Meniu, Tabele, Mesaje, Parteneri) already collapse to one column and the rail stacks above the tool (Tabele-t: a 290 px tall near-empty "Tabele salvate" card above the controls), while grids still use 2 columns at 780 px width. Also at 820 the EduSport sidebar drawer is open on load in all tablet shots and covers the left 236 px (shell, not measured as a page defect; check whether the shell state restored from localStorage).
- Fix: use one set: phone 640, tablet 1024, ui-two stacks at 640 only (rail becomes 240 px column on tablet), sbt-split and inbox follow the same 1024.

R10. Dashboard card header actions: "Vezi tot programul" ends 24 px from the card edge vs 14 px for "10 DE REZOLVAT" (scroll container in the events card). Minor, same R1 fix after the scroll box gets `padding-inline` instead of an inner gutter.

## Per page (only what is off)

| Page | Width | What is off | Measured px | Cause |
|---|---|---|---|---|
| Setari | d,t,m | card content and inputs deeper than title; two card types with different header metrics; date field taller | title 275, input 290; date 36 vs 34; phone input at 46 | R1,R5,R6,R8 |
| Voluntariat | d,t,m | same as Setari (ecard 14 inside body 18) | input 301 vs title 275 | R1,R5,R6 |
| Anunt-edit | d,t,m | stack gap 16 vs 12 in grid2 right above; 2 date fields 36 | 16 vs 12; 36 vs 34 | R7,R8 |
| Competitie-edit | d,t,m | sec cards 13 inset, date 36, phone gutters | 36 vs 34; input at 46 on 390 | R1,R6,R8 |
| Program | d,t,m | nested calendar card inside Calendar section, inset 13 + 13 | calendar box at 289 vs section title 289, inner toolbar 302 | R1 |
| Meniu | d,t | rail padding 18 / list items 10 / body 18 mix, rail stacks at 820 | rail inner 10 | R1,R9 |
| Securitate | d,t,m | field gap 10, cards 13 | 10 vs 12 | R7,R1 |
| Setari-like forms (Homepage, Form-editor, Sezoane, Grupe) | d | body 18 gap 14, sec 13 | gap 14 | R1,R7 |
| Sportivi | d,t,m | table text left of toolbar, tabs local 18 | 271 vs 275 | R2,R3,R4 |
| Inscrieri | d,t,m | checkbox 10 px left of toolbar; tab text at 287 vs 275 title; drawer fields gap 11, selects 30 vs 34; header actions stack on phone with 3 left-aligned rows | checkbox 265 vs 275 | R2,R3,R4,R7,R8 |
| Prezenta | d,t,m | tab text 269 vs title 275; table 271 vs bar 275; day head 271 | 6 and 4 | R2,R3,R4 |
| Tabele | d,m | controls 14/18 (16 on phone, page 12); first column 547 vs controls 551; label-less select wraps onto its own row on phone; rail stacks tall at 820 | 4 px; 16 vs 12 | R2,R3,R9 |
| Contabilitate, Competitii, Membri, Sponsori, Voluntari, Mesaje, Parteneri | d,t,m | td 14 vs bar 18; inbox-tools 18 vs td 14 | 4 | R2,R3 |
| Dashboard | d | hero text 277 vs card content 270; event header action 24 vs 14 from edge | 7; 10 | R1,R10 |
| Formulare, Anunturi | d,t,m | clean (list only, ph 18) | 0 | none |
