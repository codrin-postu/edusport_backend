# Admin UI standardisation (2026-09-29)

Decisions (user, companion screens 101-102):
- Badges/pills: square, 4px radius (StatusBadge, Chip).
- Square-rule exception (approved 2026-09-30): the save bar keeps Strapi's 8px bar radius, 12px top corners as a phone bottom sheet, and its round status dot and spinner. Tokens `--ui-radius-savebar`, `--ui-radius-savebar-sheet`, `--ui-radius-savebar-dot`, allowed by the checker; use them nowhere else.
- Button default variant is `primary` (2026-09-30). Outlined buttons say `variant="secondary"`, text-only ones `variant="ghost"`.
- Save: one save bar for the whole admin (2026-09-30, user request): every custom edit page uses the same floating bar as the native content-manager pages (e.g. Setări site), see "Save bar" below. It slides in only while there are unsaved edits, a save is running or Renunță is asking; "Modificări nesalvate", Renunță (two-step inline confirm) + Salvează, Cmd/Ctrl+S, Esc, leave guard. A successful save raises a "Modificările au fost salvate." toast (general, short-lived feedback = Toast, not the bar itself, see below). Delete stays in the header via ConfirmDialog. Autosave pages (tables, inboxes) keep autosave with a "Salvat" toast (`toastAutosaved()`, phase 2).
- Booleans: Switch for on/off settings, Checkbox only for picking options.
- Theme: design tokens (like the website), light + dark sets, following Strapi's theme; any future theme = one more token set.
- Base look: the existing .eduf look (navy #2138b8 accent, 4px corners, system font).

## Phases
- [x] 1. Tokens + shared components in src/admin/ui/ (+ token checker script)
- [x] 2a. Move list pages: Sportivi, Competiții, Anunțuri, Sponsori, Membri echipă
- [x] 2b. Move edit pages: SportivEdit, CompetitieEdit, AnuntEdit, HomepageEdit, ProgramEdit, VoluntariatEdit (Navigation done in phase 1)
  - [x] SportivEdit, CompetitieEdit, AnuntEdit + ParticipantsEditor / QuickCreateSportspersonModal (2026-10-01, branch p2-edit1)
- [x] 2c. Move the rest: SubmissionTable (Înscrieri, Voluntari), Mesaje + FormResults (shared InboxLayout), Formulare, FormEditor, Dashboard, calendar editor (ProgramOverviewEditor, onto the `--theme-cat-*` tokens), MobileNav/BlocksToolbarExtra theme hook (SaveBar done, see below)
  - [x] SubmissionTable (Înscrieri, Voluntari) + SheetsDialog (2026-10-01, p2-inbox)
  - [x] Mesaje + FormResults (Parteneri) on InboxLayout (2026-10-01, p2-inbox)
  - [x] Finishing pass (2026-10-01, branch finish): see "Finishing pass" below
- [ ] 3. Meniu site page switches (needs the hidden-page decisions) + frontend support

Inventory: docs/admin-ui/INVENTORY.md

### Finishing pass (2026-10-01, branch finish)
- Form tiles (Formulare, Acasă feed): `formDefs` names a tile colour (`tileColor`, `feedTileColor`: blue | green | teal | amber; renamed from `color` / `feedColor`), rendered with `tileStyle()` as `--theme-tile-<name>` + `-fg`. Amber takes navy text (white on #e08a00 was 2.7:1); blue and green are lifted in dark. Part of `--contrast`.
- Page stack gap: `.ui-root.ui-stack` now matches the AdminPage root itself (the rule only matched a nested `.ui-stack`, so a page's top-level blocks had no gap; Acasă's top cards touched). Acasă KPI tiles use the same 16px.
- ScheduleGroupsInner (Program, Serii): RepeatableList (reorder, ConfirmDialog delete), Field, two TimeInputs, TagsInput for the groups; `.esg` CSS gone; stored shape unchanged.
- GalleryGrid `confirmRemove?: boolean | string` (default false), on the Voluntariat, Sportiv, Realizări and homepage competition galleries.
- `RelationMultiSelect` {value: documentIds, onChange(ids, chosen), options? | loadOptions?, labels?, placeholder?, emptyLabel?, max?, disabled?} in src/admin/ui: chips + SearchableSelect, keyed by documentId, labels remembered per id. Replaces the local copies in SportivEdit (discipline, antrenori, coregrafi) and CompetitieEdit (participanți); QuickCreateSportspersonModal no longer maps names back to ids (two people with the same name resolved to the first).
- InboxLayout gains `InboxRow`, `InboxReaderHead` (was ReaderHead) and `groupByDay` from dashboard/inboxShared.tsx (classes `.inbx-*` -> `.ui-inbox-row*`, `.ui-inbox-rh`, ...). inboxShared keeps relTime, snippet and the toolbar / reader-body CSS, which only the two inbox pages use.
- Legacy removed: dashboard/edusportUi.ts (EDU_CSS unused; PROGRAM_TYPES, LEVEL_OPTIONS, yearOf -> dashboard/constants.ts) and dashboard/MediaPicker.tsx (MediaModal unused).
- EdusportShell on `--palette-*` / `--ui-radius-*` (declared on the shell's own roots, it renders outside `.ui-root`); new palette groups `shell` and `auth` (login page), `teal` (Contact tile). loginBranding and app.tsx read PALETTE values (Strapi DOM). Visible change: the shell's 8px corners are 6px, its round avatar and pill switch button are 4px squares (square rule).
- Admin tsc 14 -> 0, no behaviour change. Dead props removed: Typography `fontStyle` (5 plugin editors) and the plugin EditorCard's `borderBottom*` / `borderLeft*` are not DS props, so the italic empty states and the header accent never rendered; CalendarEventsInner read the global `window.name` as its id prefix (now explicit, same value).
- Checker: total 190 -> **0** (files 0); colour rule 0 hits in 114 files (every dashboard page and helper on the shared set, constants, EdusportShell, SaveBar, nativeFormBridge, MobileNav, BlocksToolbarExtra, ConfirmDialog, and the six moved component-preview editors, scanned for the colour rule only); legacy 0. Contrast: light 43 pairs, dark 52, all AA (tightest tile-teal 4.52). `--strict` would now pass.

### Remaining
- [ ] Articole (api::article.article): ArticolePage / ArticolEditPage are placeholders linking to the Strapi editor; `redirect: false` in CUSTOM_PAGES. Needs its own rich-text editor (Strapi's blocks editor cannot be imported), draft / publish and preview. Last, its own step (CUSTOM-PAGES.md).
- [ ] Phase 3: Meniu site page switches (hidden-page decisions) + frontend support.
- [ ] component-preview content-manager fields still on Strapi DS (outside the checker's src/admin scan): the banner / info editors (PageBanner, CursuriPage*, ProgramPageInfo, TeamPageInfo, HistoricPageInfo, RealizariPageBanner, CourseRegsBanner, SiteSettings*, Partners*, Volunteer*, FooterNotes), RulesTable, PricingTiersEditor, VideoEmbedEditor, CalendarEventsEditor (registered, no layout shows it), plus their components/ (EditorCard, MediaPicker, MarkdownEditor, TimePicker, ...) and the plugin TagsInput. Move them onto src/admin/ui or drop the ones no layout shows any more.
- [ ] CI: run `node scripts/admin-ui-check.mjs --strict --contrast`.

### Phase 2c inbox/table result (2026-10-01)
- SubmissionTable (Înscrieri, Voluntari): .insp gone. AdminPage/Window/PageHeader, .ui-table for the compact list and the spreadsheet (page-local `.sbt-*` token CSS for selection, sticky header, frozen column, detail panel), Popover menus (quick filters, Alte filtre, Coloane, Export), Chip, Checkbox, useDragReorder for the column order, SegmentedControl, Pager, Modal (move whole season), ConfirmDialog. Status colours stay config-driven (`StatusDef` color/soft/border, now --theme-* tokens) and render through StatusBadge `custom`. TableApi: `tagClassOf` -> `statusOf`; detail panels use the exported `DetailHeader` / `DetailBody` / `DetailField` / `DetailFooter`. Inline edits autosave + `toastAutosaved()`; the .insp-msg banner became toasts.
- SheetsDialog: on Modal + Field/Input/Select/Button/Notice, history on .ui-table; action results are toasts, a failed status load is a Notice.
- Mesaje and FormResults (Parteneri) on InboxLayout; shared row / reader head / date helpers + CSS in `dashboard/inboxShared.tsx`. Reason chips on StatusBadge: six groups on tones, parteneriat on the burgundy calendar token pair, feedback on page variables backed by the blue palette (light 600/50/100, dark 200/900/800). Status + note autosave with `toastAutosaved()`.
- Checker: 993 -> 600; SubmissionTable, SheetsDialog, Mesaje, FormResults, Înscrieri, Voluntari, ParteneriRezultate at 0. Admin tsc 41 -> 36 (the five SubmissionTable errors).

### Phase 2a result (2026-09-30)
All five list pages (Sportivi, Competiții, Anunțuri, Sponsori, Membri echipă) on
AdminPage/Window/PageHeader; Sportivi and Sponsori on DataTable (client search,
pageSize 25, sortable columns, EmptyState); Competiții keeps DataTable for the
main list and its expanded per-competition result set, plus a Section for the
skate-results import box. Anunțuri and Membri echipă keep their bespoke lists
(grouped drag-reorder rows, and a draggable card grid) rather than DataTable:
neither fits a generic sortable/paginated table (the order itself is
hand-dragged data, and Anunțuri splits into three named groups while Membri
echipă cards carry a photo + wrapping tag list). Sponsori and Membri echipă
modals moved onto Modal + Field/Input/Textarea/Select + ImagePicker +
useSaveState; deletes stay on ConfirmDialog. Booleans/levels on StatusBadge,
messages on adminToast/Notice. Checker: 27 files/1093 hits -> 22 files/993 hits.

### Phase 2c result: Acasă, Formulare, FormEditor, MobileNav, BlocksToolbarExtra, plugin buttons (2026-10-01)
- [x] Dashboard (Acasă): AdminPage + Section cards, KPI tiles on the new shared `StatTile` {label, value, caption?, tone?} (+ `.ui-stats` grid) in src/admin/ui, season switch = Switch, Deschise / Închise = StatusBadge, event filters = SegmentedControl (5 options, wrapping), feed empty state = EmptyState, event colours = `--theme-cat-*`. The greeting band and the analytics card keep their navy look on solid `--palette-*` colours (no translucent white; every text pair 5.7:1 or more on both gradient ends). Registration switch keeps saving at once, now with toastAutosaved / adminToast.error.
- [x] Formulare: AdminPage + Window + PageHeader, rows in the Window, Tabel / Inbox and În curând on StatusBadge, Button for the actions.
- [x] FormEditor: steps = Section (collapsible), questions = RepeatableList (reorder within the step, expandable, delete through ConfirmDialog for every question, not only sensitive ones), options = nested RepeatableList (reorder, Switch activ / ascuns, remove only where allowed), Field / Input / Textarea / Select / Switch, required = Field's asterisk, floating SaveBar (dirty against the loaded config, Renunță restores it) + UnsavedGuard, toasts replace the page toast.
- [x] MobileNav, BlocksToolbarExtra: copied theme readers and palettes gone; each renders inside its own `.ui-root` on `--theme-*` tokens (theme via ensureAdminUi / useAdminTheme sync). MobileNav keeps reading Strapi's main nav: on phones the burger replaces that nav, whose entries differ from EDUSPORT_LINKS.
- [x] component-preview AddListButton = shared AddButton in a `.ui-root`; InlineStringList reuses it, delete buttons on danger tokens.
- Checker: 22 files / 993 hits -> 17 files / 648 hits; all six admin files at 0 and in MIGRATED (colour rule).

## Phase 1 result

Everything lives in `src/admin/ui/`, imported through the barrel `src/admin/ui/index.ts`.
Reference page with every component in every state (light, dark, theme preview switch):
`/admin/plugins/edusport-ui`, registered with `app.router.addRoute` in menu.tsx, so it is in no sidebar.

### Tokens and theme
- Two colour layers, like the website (2026-09-30). tokens.ts is the only file in src/admin with raw colours.
  - `PALETTE` (primitives), emitted on `.ui-root` as `--palette-<name>-<step>`: `blue` 50-950 (the old primary #2138b8 = 600; the current primary is `steel` 500), `grey` 0-1000 (every neutral: the light surfaces and text, Strapi's dark neutrals, black for shadows; fine steps such as 25 / 125 / 375 keep today's values exact), `green`, `amber`, `red`, plus `sky` (info) and `indigo` (Strapi's primary, save bar only), and `brand` with the website colours: `navy` #0e1a3c, `burgundy` #6e4256, `orange` #ea7233, `silver` #9ca3af, `rust` #be3330, `cream` #fbf8f1 (`--palette-brand-navy`), and `navyOnDark` / `burgundyOnDark` / `rustOnDark`.
  - The semantic themes `light` and `dark` reference `PALETTE` entries (`P.grey[150]`); shadows and the overlay use `alpha(P.x[n], a)`. Pages keep using the semantic variables.
  - Only change of value: two dark save bar tokens merged into the nearest grey step (`savebar-surface-hover` #1a1a2e -> #1a1a2b, `savebar-line` #2a2a3e -> #2a2a40), not visible.
- Calendar categories, shared with the website: `--theme-cat-scoala` (navy), `--theme-cat-antrenament` (burgundy), `--theme-cat-eveniment` (orange), `--theme-cat-liber` (silver), `--theme-cat-anulat` (rust), each with `-fg`: cream on navy / burgundy / rust, navy on orange / silver. In dark, navy, burgundy and rust would vanish into the dark surfaces (1.1 to 2.8:1), so they use the lifted `*OnDark` fills (3:1 on raised, cream text still 4.5:1); orange and silver stay. `CALENDAR_CATEGORIES`, `CalendarCategory` exported.
- `tokens.ts`: `light`, `dark` (`AdminTheme` objects: `surface`, `text` (incl. `onPrimary`), `line`, `primary`, `status` keyed by `StatusTone` success|warning|danger|info|neutral, `focus`, `shadow`, `savebar`, `category`), `THEMES`, `ThemeName`, `THEME_ATTR` (`data-theme`), plus `radius` (none 0, sm 4px, md 6px; no pill), `space` (4px steps), `type` roles (pageTitle 19/800, sectionTitle 11/800 upper, label 10.5/700 upper, body 13, bodySm 12.5, caption 11), `font`, `motion` (fast 150ms). `themeVars()`, `paletteVars()`, `scaleVars()`, `tokensCss()` generate the CSS custom properties.
- CSS variables (renamed 2026-10-01, see "Token naming"):
  - theme colours `--theme-*`: `bg`, `surface`, `surface-subtle`, `surface-sunken`, `overlay`, `text`, `text-secondary`, `text-muted`, `text-disabled`, `on-primary`, `border`, `border-subtle`, `border-strong`, `primary`, `primary-hover`, `primary-soft`, `primary-soft-line`, `{success,warning,danger,info,neutral}` + `-bg` + `-border`, `focus`, `shadow-{sm,md}`, `savebar-*`, `cat-<name>` + `-fg`, `color-scheme`;
  - palette `--palette-<name>-<step>`;
  - component-library scales `--ui-*`: `radius-{none,sm,md,savebar,savebar-sheet,savebar-dot}`, `space-*`, `fs-/fw-/lh-/ls-<role>`, `font`, `font-mono`, `motion-fast`, `easing`; component-local `--ui-badge-{fg,bg,border}`, `--ui-notice-{fg,bg,border}`, `--ui-toast-fg`, `--ui-modal-w/-z`, `--ui-rail-w`, `--ui-inbox-list-w`, `--ui-gal-cols`.
  - Scope: all of them are defined on `.ui-root` only (an outermost root; nested roots inherit), never on `:root`, so nothing leaks into Strapi's own UI. Every surface we render carries `.ui-root`: page roots, the Modal / Popover / Toast portals, the save bar, and component roots used inside content-manager fields.
- WCAG AA checked for both sets (`node scripts/admin-ui-check.mjs --contrast`): text 4.5:1 on every surface, status colour on its `-bg`, on-primary on primary; `border-strong` (control borders) and `focus` 3:1; save bar text and button labels 4.5:1; each calendar category and form tile fg on its fill 4.5:1, and in dark the fill 3:1 on raised. Light 43 pairs, dark 52 pairs, all pass (2026-10-01, with the tiles).
- Form tiles (2026-10-01): `--theme-tile-{blue,green,teal,amber}` + `-fg` (`TileColor`, `TILE_COLORS`), light blue 600 / green 700 / teal 600 / amber 500 (navy text), dark blue 400 / green 600 / teal 600 / amber 500. `border` / `border-subtle` are decorative dividers. Pair names in the output use the CSS names without `--theme-` (e.g. `text-muted on bg`). Control borders are darker than the old `#d0d0d0` field border on purpose (that one was 1.5:1).
- A new theme = one more `AdminTheme` object in `THEMES`.
- `useAdminTheme()` hook, `getAdminTheme()`, `subscribeAdminTheme(fn)`, `startAdminThemeSync()`: the one Strapi theme reader (STRAPI_THEME + prefers-color-scheme + storage event + 1.5s poll). It sets `<html data-theme="light|dark">` (Strapi sets no `data-theme` of its own, checked 2026-10-01). Theme blocks: `:where(:root[data-theme=X]) .ui-root` (outermost), and, winning over `<html>`, a `.ui-root[data-theme=X]` or any `[data-theme=X]` inside a root (theme preview).
- `styles.ts`: `UI_CSS` (component classes, `ui-` prefix, scoped under `.ui-root`, colours only `var(--theme-*)`, scales `var(--ui-*)`), `ensureAdminUi()` (injects tokens + classes once, starts the theme sync). Called from the app.tsx bootstrap; AdminPage and Modal call it again as a safety net.
- `.ui-root` (AdminPage, Modal portal, the save bar itself) is also skipped by the global SaveBar tagger in app.tsx, like `.pce`.

### Components (props, briefly)
- `AdminPage` {stack?}: page root (background, padding, `.ui-root`), replaces `.eduf`.
- `Window`: bordered card. `PageHeader` {title, subtitle?, actions?, back?: {to?|onClick?, label?}}.
- `Section` {title?, aside?, footer?}. `TwoColumn` {rail, railWidth?=280, railLabel?, railClassName?}.
- `Button` {variant: primary (default)|secondary|danger|ghost, size: sm|md, loading?, icon?, iconOnly + aria-label (required by type), disabled?}.
- `StatusBadge` {tone: success|warning|danger|info|neutral|primary, custom?: {fg,bg,line?}, size: sm|md}. `Chip` {onRemove?, removeLabel?}, `ChipList`.
- `Switch` {checked, onChange(next), label?, description?, disabled?, aria-label?}: role="switch", Space/Enter. `Checkbox` {checked, onChange(next), label?, indeterminate?}.
- `Field` {label, hint?, error?, required?, id?, hideLabel?} + `Input`, `Textarea`, `Select` {options?, placeholder?, onChange(value)}, `DateInput` {value: string|null, onChange(v|null), withTime?}; ids, aria-describedby, aria-invalid, required wired through context. `FieldRow` two columns.
- `SaveBar` {dirty, saving, saved?, error?, onSave, onDiscard?, saveLabel?, discardLabel?, extra?, disabled?, shortcut?=true}: the custom-page wrapper of `SaveBarView`, see "Save bar". Shows dirty/saving/confirm/error text only; a successful save is a Toast, not bar text.
- `useSaveState()` -> {dirty, saving, saved, error, status, bar, markDirty, setDirty, reset, setError, run(fn, errorMessage?)}; `saved` lasts 2s (`SAVED_MS`, used for bar styling only); `run()` also fires the save-result toast (success or error).
- `useUnsavedGuard(dirty, {title?, message?})` -> dialog element; `<UnsavedGuard when={dirty} />`. react-router `useBlocker` (Strapi runs a data router), capture-phase interception of links in the EduSport sidebar / mobile nav (outside the router), beforeunload. Confirms through ConfirmDialog.
- `Notice` {tone: success|warning|danger|info, title?, action?}: persistent, page-bound message (e.g. a load error blocking a section). `EmptyState` {icon?, action?}. `Spinner` {size?, label?}, `Loading` {text?}.
- `Toast`: general, short-lived feedback (a save result, a background warning), not persistent and not page-bound, that's what stays with `Notice`. `adminToast` {success|info|warning|error(text, opts?: {title?, duration?}), dismiss(id)} (`warn` stays as an alias of `warning`); `ToastTone` success|info|warning|danger: a module-level event emitter, no React provider needed, callable from any of the admin's several React roots. `useToast()` returns the same API as a hook. `toastAutosaved()` fires the "Salvat" success toast for autosave pages (phase 2). `<ToastViewport/>` is mounted once for the whole admin from the app.tsx bootstrap (`mountToastViewport`, next to mountSaveBar/mountEdusportShell), portals to `document.body`. Top-right, below Strapi's header, full width on phones; square 4px radius, raised surface, 3px tone-coloured left edge, shadow md. success/info auto-dismiss 3s, warning 5s, error stays until closed; hover pauses the timer; at most 3 visible, a new one pushes the oldest out. `useSaveState.run()` raises the save-result toast itself, so `SaveBar` no longer shows its own "Salvat" text.
- `Modal` {open, onClose, title, footer?, headerExtra?, size: sm|md|lg, dismissable?, initialFocusRef?, role?, zIndex?}: portal, Esc, backdrop, focus trap, focus return, stack aware. `ConfirmDialog` now renders on it, same props.
- `Drawer` {open, onClose, title, lead?, subheader?, footer?, width?=420, dismissable?, initialFocusRef?, zIndex?=390, className?, bodyClassName?} (2026-10-01, calendar editor): side panel from the right over a light overlay, full screen at 640px and below with the footer at the bottom. Same portal / Esc / overlay click / focus trap / focus return as Modal and the same layer stack (src/admin/ui/layerStack.ts), so a ConfirmDialog opened from it takes Escape first. `onClose` is a request, guard unsaved changes there. `DrawerSection` {title, aside?, collapsible?, defaultOpen?, onToggle?}: a body block with an uppercase title, or a fold-out header button (aria-expanded, body unmounted while closed).
- `Tabs` {items: {id,label,count?,disabled?}[], value, onChange, label?, panelId?}: arrow keys. `Pager` {page, pageCount, onChange, total?, pageSize?}.
- `DataTable<T>` {columns: {key, header, render?, value?, sortable?, searchable?, align?, width?}[], rows, getRowKey, onRowClick?, rowLabel?, loading?, empty?, noMatches?, search?, searchPlaceholder?, toolbar?, pageSize?=25 (0 = off), initialSort?}.
- `ImagePicker` {open, onClose, onPick, multiple?, title?, allowUpload?=true}: dashboard MediaModal query (GET /upload/files) + POST /upload, on Modal.
- `InboxLayout<T>` {tabs?, activeTab?, onTabChange?, toolbar?, bulkBar?, notice?, items, getKey, renderItem, groupBy?, selectedKey, onSelect, loading?, error?, empty?, page, pageCount, total?, pageSize?, onPageChange, reader, readerEmpty?}. Used by Mesaje and FormResults (2c).
- Proved on NavigationPage (Meniu site): PageHeader, TwoColumn, Section, Field/Textarea, Button, StatusBadge, Notice, SaveBar + useSaveState + UnsavedGuard, ImagePicker.

### Token checker
`node scripts/admin-ui-check.mjs [--list] [--strict] [--contrast]`: raw hex, rgb()/hsl() and non-token border-radius in `src/admin/**/*.{ts,tsx}` outside tokens.ts, counts per file (the total; 0 since the finishing pass). The colour rule also covers the MIGRATED list, which includes the moved component-preview editors outside src/admin; `--cal-c` / `--cal-s` / `--cal-sf` (calendar editor, set per `data-calcat` from `--theme-cat-<name>`, `-soft`, `-soft-fg` only) are allowed channels. Reported separately: the colour rule (in src/admin/ui outside tokens.ts and the migrated pages, colour properties may only use `var(--theme-*)` / `var(--palette-*)` or a component-local `--ui-badge-*` / `--ui-notice-*` / `--ui-toast-fg` channel; named colours are flagged too) and any leftover `--adm-` name in src/admin. Exits non-zero only with `--strict` (total, colour or legacy).
Baseline at the end of phase 1: **28 files, 1130 hits (hex 889, rgb 60, radius 181)**. Before phase 1 the same scan gave 30 files, 1173 hits. `src/admin/ui` is at 0. Later phases drive the total to 0, then CI can run `--strict`.

### Save bar (one bar for everything, 2026-09-30)
- `SaveBarView` (src/admin/ui/SaveBarView.tsx): the presentational bar, styled only with `--theme-savebar-*` and `--ui-radius-savebar*` tokens, classes `.ui-savebar*` in styles.ts. Fixed, centred 16px above the bottom, 360 to 720px wide, 8px radius, border, shadow; a round status dot (warning / success / danger, spinner while saving), then "Modificări nesalvate" / "Se salvează…" / "Sigur că renunți la modificări?" / "Modificări gata de publicare" / "Publicat" / "Previzualizare disponibilă"; Renunță with the inline Nu / Da, renunță step, Salvează, and Previzualizează / Publică / Retrage publicarea when the wrapper offers them. At 640px and below a full-width bottom sheet with safe-area padding. Keys while mounted: Cmd/Ctrl+S saves, Esc asks to discard or cancels the question (not while a dialog is open). Props {state: dirty|saving|idle, confirming?, visible?, inline?, sheet?, theme?, message?, tone?, canSave?, canPublish?, canUnpublish?, canPreview?, on*, extra?, saveLabel?, discardLabel?, keyboard?}; `useSlideIn(show)` and `useDiscardConfirm(dirty)` (5s timeout) are exported with it.
- src/admin/SaveBar.tsx (global, native content-manager pages): mirroring logic unchanged (MutationObserver on the tagged, hidden Strapi buttons, clicks forwarded). Renunță -> "Da, renunță" (the only confirmation) resets the edit view form in place (2026-10-01): src/admin/nativeFormBridge.tsx injects a null component into the content-manager `editView.right-links` zone (inside the edit view's `<Form>`), which registers Strapi's `useForm(...).resetForm` in a module-level list; `resetForm()` restores the initial (last saved) values, so `modified` turns false and Strapi's blocker and beforeunload warning switch off. No reload. Fallback only when no bridge is registered (logged): our leave guards are released, beforeunload is swallowed in the capture phase and the page reloads; a browser that does not run capture listeners first could still show Strapi's own "leave page?" prompt there. Renders `SaveBarView`; its private palette and theme reader are gone, the theme comes from `useAdminTheme` (getAdminTheme / subscribeAdminTheme). Shows whenever something is actionable (dirty, publish, unpublish, preview).
- src/admin/ui/SaveBar.tsx (custom pages): the same `SaveBarView`, driven by `useSaveState` (`<SaveBar {...save.bar} onSave onDiscard />`, props unchanged). Portalled to `<body>`, floats and shows only while dirty / saving / confirming; a failed save shows the error in the bar with a danger dot; the success and error toasts stay in `useSaveState.run`. Swallows the browser's Cmd/Ctrl+S dialog even while hidden. An in-flow 72px spacer keeps the end of the page reachable under the bar. The old sticky save bar CSS is gone.
- Custom pages: `ui/SaveBar` calls `releaseUnsavedGuards()` (useUnsavedGuard) before `onDiscard`, so a confirmed discard is never followed by the leave dialog or the browser prompt, even if the discard navigates before the page re-renders clean; each guard re-arms when its dirty flag changes.
- A page never shows both bars: the app.tsx tagger skips every button inside `.pce` (older custom pages, calendar editor) or `.ui-root` (shared-component pages, modals, the bar itself), so on a custom page nothing is tagged and the global bar has nothing to mirror. Keep `.pce` on custom pages that are not on AdminPage yet.
- Reference page: a live demo (useSaveState + SaveBar + UnsavedGuard) and `SaveBarView inline` in every state: dirty, saving, confirming, error, ready to publish, published, dirty with Publică, phone sheet.

### Reference page: Culori
- Palette swatches per scale (name, step, hex), then every semantic token per theme, each panel under its own `data-theme`, showing the token name and value.

### Checker after the save bar and palette work (2026-09-30)
27 files, 1093 hits (hex 861, rgb 56, radius 176), 37 under the phase 1 baseline; src/admin/SaveBar.tsx is at 0 (its private palette is gone); src/admin/ui at 0 outside tokens.ts. Contrast passes in both themes.


## Phase 1b: components from inventory pass 2 (2026-09-30)
Accent: muted blue (steel 500 light / 300 dark), user choice on companion screen 107.
- [x] useObjectField + ObjectFieldCard (declarative field config, sections) for the 11 banner/info editors
- [x] RepeatableList (+ useDragReorder, ExpandableRow, confirm-before-delete) for the 6 list editors
- [x] GalleryGrid (fixed slots or open list) on ImagePicker
- [x] DateRangeInput (clamped), TimeInput (from components/TimePicker), NumberInput (from SpinnerInput)
- [x] TagsInput, SearchableSelect (Combobox, creatable), SegmentedControl
- [x] HelpTip, LinkOutCard, EditorCard, AddButton promoted into src/admin/ui on tokens
- [x] MediaPicker / VideoPicker unified under ImagePicker (accept: image | video | any)

Built only (2026-09-30); no page or editor migrated yet. Demos: reference page, window "Componente pentru editoare". Every new component root carries `.ui-root`, so it styles and themes inside content-manager custom fields too (no AdminPage around them). Popups (lists, time spinners, tooltips) go through the internal `Popover`: portalled to `<body>`, fixed, flips above, closes on outside pointer and Escape (Escape does not reach an enclosing Modal).

### Phase 1b APIs (src/admin/ui, exported from index.ts)
- `RepeatableList<T>` {items, onChange, getKey, renderRow(item, i, {index, update(patch | fn), remove, expanded, toggle, moveUp, moveDown}), renderSummary?, itemLabel?, newItem? | onAdd?, addLabel?, emptyLabel?, reorder?, expandable?, defaultExpanded?, confirmDelete? (true | message | {title, message, detail}), maxItems?, disabled?, hideDelete?}. Delete through ConfirmDialog when asked; expanded state keyed by getKey; new rows open.
- `useDragReorder({count, onMove(from, to), axis? 'y' | 'x' | 'grid', swap?, disabled?, announce?})` -> {itemProps(i), handleProps(i), move, dragging, live}; `moveItem(arr, from, to)`. HTML5 drag from the handle, drop line (data-drop), arrow keys on the handle, Alt+ArrowUp/Down inside an item, focus kept, polite live region. Up / down buttons appear on touch screens (pointer: coarse) in RepeatableList.
- `ExpandableRow` {summary, expanded, onToggle, lead?, actions?, children, toggleLabel?, rowProps?, as?}.
- `AddButton` {label, ...button props}: full-width "+ label"; replaces components/AddListButton.
- `useObjectField<T>(value, onChange, EMPTY)` -> {data, update(key, val), merge, set, reset}; no Strapi useField. `value` can be an object, a JSON string or empty; resyncs when the caller's value changes, ignores the echo of its own edit. `normalizeObject(value, EMPTY)`.
- `ObjectFieldCard<T>` {title, description?, headerAction?, value, onFieldChange(key, val), fields: [{key, label, hint?, type? text | textarea | url | number | date | time | select, options?, placeholder?, rows?, span? 1 | 2, required?, min?, max?, step?, disabled?, error?}], sections?: [{title?, keys}], children?, disabled?}. 2 columns, 1 under 720px; textarea spans 2 by default.
- `EditorCard` {title, description?, headerAction?, children, flush?}; `LinkOutCard` {title, description?, body, href, linkLabel, external? (default true)}; `HelpTip` {label, size?, placement?, ariaLabel?}.
- `GalleryGrid` open list {images, onChange, max?} or fixed slots {slots, images: (img | null)[], onChange, slotLabels?}; common {columns? (4), reorder?, disabled?, addLabel?}. Square tiles, x removes, open list adds through ImagePicker multiple, a slot picks or replaces one image; reorder moves (list) or swaps (slots). `GalleryImage` {id, url, name?, thumbnailUrl?, mime?}.
- `DateRangeInput` {value: {start, end}, onChange, startLabel?, endLabel?, hint?, error? (node or {start, end}), required?, withTime?, disabled?}: min / max between the two, end >= start always.
- `TimeInput` {value: "HH:MM" | null, onChange, min?, max?, format? 'hh:mm' | 'strapi', allowEmpty?}: typed text ("9", "930", "9.30") committed on blur / Enter, clock button opens hour / minute spinners; `parseTimeText`, `formatTime`.
- `NumberInput` {value: number | null, onChange, min?, max?, step?, wrap?, pad?, allowEmpty?, size? md | lg, label?}: text input with a stepper, no native spin buttons; arrows, PageUp / PageDown (x10), Home / End.
- `TagsInput` {value: string[], onChange, suggestions?, suggestionsOnly?, placeholder?, maxTags?, disabled?}: Enter / comma add, paste splits on commas, Backspace removes the last chip, case-insensitive dedupe, Chip for each tag.
- `SearchableSelect` {value, onChange(value, option), options? | loadOptions?(q), valueLabel?, placeholder?, creatable?, onCreate?, clearable? (true), disabled?, emptyLabel?}: ARIA combobox, keyboard navigation, 250ms debounced async loader with stale answers dropped, diacritics ignored when matching.
- `SegmentedControl<V>` {options (2-4), value, onChange, aria-label, size? sm | md, block?, disabled?}: role="radiogroup", roving focus, primary fill; replaces .pubseg and VideoEmbedEditor's Radio.Group.
- `ImagePicker` gains `accept?: 'image' | 'video' | 'any'` (default 'image', existing props unchanged): mime filter, upload accept, Romanian copy per kind, video tiles preview the first frame. `PickedMedia` = PickedImage.
- `Popover` {open, anchorRef, onClose?, placement?, offset?, matchWidth?, role?, id?, popoverProps?}: exported for later popups.
- `Field` exports the `FieldAria` type (what useFieldControl hands to a control); Field's own API is unchanged.

Checker after phase 1b: src/admin/ui at 0 outside tokens.ts, total unchanged (27 files, 1093 hits); contrast passes in both themes.

## Token naming (decided 2026-09-30)
- Two layers only: palette (raw hex, tokens.ts only) -> semantic theme tokens. No per-component tokens.
- Semantic tokens are named `--theme-*` and read as plain meaning: --theme-primary, --theme-primary-hover, --theme-primary-soft, --theme-primary-soft-line, --theme-on-primary, --theme-bg (page), --theme-surface, --theme-surface-subtle, --theme-surface-sunken, --theme-overlay, --theme-text, --theme-text-secondary, --theme-text-muted, --theme-text-disabled, --theme-border, --theme-border-subtle, --theme-border-strong, --theme-success/-warning/-danger/-info/-neutral (+ -bg, -border), --theme-focus, --theme-shadow-sm/md, --theme-cat-* (calendar), --theme-savebar-*.
- "accent" is renamed "primary" everywhere.
- Non-colour scales (radius, space, type roles, motion) keep their own names under the component-library prefix `--ui-*` (--ui-radius-sm, --ui-space-3, --ui-fs-body).
- CSS class names use the `ui-` prefix (the component library in src/admin/ui): .ui-btn, .ui-field, .ui-table, .ui-savebar. `--theme-*` = theme values, `.ui-*` = components.
- A new theme = one more semantic mapping onto the palette.
- [x] Rename pass (2026-10-01): tokens.ts, styles.ts, every component, migrated pages, SaveBar, checker rule (no hex outside tokens.ts; components use only --theme-* / --palette-* for colour; no leftover --adm-). Zero visual change: generated values and CSS identical after the name mapping. Tones renamed ok -> success, warn -> warning; badge tone accent -> primary; `.adm-dt*` -> `.ui-table*`, `.adm-sbar*` -> `.ui-savebar*`, `ADM_CSS` -> `UI_CSS`, `data-adm-theme` -> `data-theme`, `data-adm-drag-item` -> `data-ui-drag-item`. Checker after: 22 files, 993 hits (unchanged), colour 0, legacy 0; contrast passes.

### Phase 2b/2c result: Pagina principală, Voluntariat, Program + calendar editor (2026-10-01)
- [x] HomepageEdit: own two-document save (Cifre club, then homepage) on useSaveState + SaveBar + UnsavedGuard, structural dirty over form + figures; Hero / Sportivi on ObjectFieldCard, Tabs for the registration variants and About panels, StatusBadge (pe site, automat, din setări), figures on RepeatableList, 3-slot GalleryGrid.
- [x] VoluntariatEdit: useSingleType + usePageForm; ObjectFieldCard, RepeatableList (help ways), GalleryGrid. VP_CSS reduced to the two-column layout.
- [x] ProgramEdit: useSingleType + usePageForm for scheduleGroups (ScheduleGroupsInner itself not restyled, owned elsewhere).
- [x] Calendar editor (ProgramOverviewEditor) on `--theme-cat-*` and the shared components; `.pce` no longer used by it (root is `.ui-root .cal`).
- [x] Calendar redesign (2026-10-01, branch calendar, docs/admin-ui/CALENDAR-BRIEF.md): toolbar with Azi and Lună / Listă, four colour filter chips above the grid (behind "Filtre" on phones), soft-tint event chips (`--theme-cat-<name>-soft` / `-soft-fg`), today and weekends marked, a compact grid with colour marks on phones (Listă by default there). The editor is a `Drawer` (side panel) with Evenimentul / Când / fold-out Excepții or Datele seriei / Conținut opțional, Anulează with the "Da, renunță" confirm. Code split into component-preview `calendar/` (model.ts, CalendarView.tsx, EventDrawer.tsx, styles.ts); same data, same API.
- CalendarEventsEditor left as is: still registered (`calendar-events` custom field) but no edit layout shows it.
