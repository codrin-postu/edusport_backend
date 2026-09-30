# Admin UI standardisation (2026-09-29)

Decisions (user, companion screens 101-102):
- Badges/pills: square, 4px radius (StatusBadge, Chip).
- Square-rule exception (approved 2026-09-30): the save bar keeps Strapi's 8px bar radius, 12px top corners as a phone bottom sheet, and its round status dot and spinner. Tokens `--adm-radius-savebar`, `--adm-radius-savebar-sheet`, `--adm-radius-savebar-dot`, allowed by the checker; use them nowhere else.
- Button default variant is `primary` (2026-09-30). Outlined buttons say `variant="secondary"`, text-only ones `variant="ghost"`.
- Save: one save bar for the whole admin (2026-09-30, user request): every custom edit page uses the same floating bar as the native content-manager pages (e.g. Setări site), see "Save bar" below. It slides in only while there are unsaved edits, a save is running or Renunță is asking; "Modificări nesalvate", Renunță (two-step inline confirm) + Salvează, Cmd/Ctrl+S, Esc, leave guard. A successful save raises a "Modificările au fost salvate." toast (general, short-lived feedback = Toast, not the bar itself, see below). Delete stays in the header via ConfirmDialog. Autosave pages (tables, inboxes) keep autosave with a "Salvat" toast (`toastAutosaved()`, phase 2).
- Booleans: Switch for on/off settings, Checkbox only for picking options.
- Theme: design tokens (like the website), light + dark sets, following Strapi's theme; any future theme = one more token set.
- Base look: the existing .eduf look (navy #2138b8 accent, 4px corners, system font).

## Phases
- [x] 1. Tokens + shared components in src/admin/ui/ (+ token checker script)
- [x] 2a. Move list pages: Sportivi, Competiții, Anunțuri, Sponsori, Membri echipă
- [ ] 2b. Move edit pages: SportivEdit, CompetitieEdit, AnuntEdit, HomepageEdit, ProgramEdit, VoluntariatEdit (Navigation done in phase 1)
- [ ] 2c. Move the rest: SubmissionTable (Înscrieri, Voluntari), Mesaje + FormResults (shared InboxLayout), Formulare, FormEditor, Dashboard, calendar editor (ProgramOverviewEditor, onto the `--adm-cat-*` tokens), MobileNav/BlocksToolbarExtra theme hook (SaveBar done, see below)
- [ ] 3. Meniu site page switches (needs the hidden-page decisions) + frontend support

Inventory: docs/admin-ui/INVENTORY.md

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

## Phase 1 result

Everything lives in `src/admin/ui/`, imported through the barrel `src/admin/ui/index.ts`.
Reference page with every component in every state (light, dark, theme preview switch):
`/admin/plugins/edusport-ui`, registered with `app.router.addRoute` in menu.tsx, so it is in no sidebar.

### Tokens and theme
- Two colour layers, like the website (2026-09-30). tokens.ts is the only file in src/admin with raw colours.
  - `PALETTE` (primitives), emitted on `:root` as `--adm-palette-<name>-<step>`: `blue` 50-950 (accent #2138b8 = 600), `grey` 0-1000 (every neutral: the light surfaces and text, Strapi's dark neutrals, black for shadows; fine steps such as 25 / 125 / 375 keep today's values exact), `green`, `amber`, `red`, plus `sky` (info) and `indigo` (Strapi's primary, save bar only), and `brand` with the website colours: `navy` #0e1a3c, `burgundy` #6e4256, `orange` #ea7233, `silver` #9ca3af, `rust` #be3330, `cream` #fbf8f1 (`--adm-palette-brand-navy`), and `navyOnDark` / `burgundyOnDark` / `rustOnDark`.
  - The semantic themes `light` and `dark` reference `PALETTE` entries (`P.grey[150]`); shadows and the overlay use `alpha(P.x[n], a)`. Pages keep using the semantic variables.
  - Only change of value: two dark save bar tokens merged into the nearest grey step (`savebar-surface-hover` #1a1a2e -> #1a1a2b, `savebar-line` #2a2a3e -> #2a2a40), not visible.
- Calendar categories, shared with the website: `--adm-cat-scoala` (navy), `--adm-cat-antrenament` (burgundy), `--adm-cat-eveniment` (orange), `--adm-cat-liber` (silver), `--adm-cat-anulat` (rust), each with `-fg`: cream on navy / burgundy / rust, navy on orange / silver. In dark, navy, burgundy and rust would vanish into the dark surfaces (1.1 to 2.8:1), so they use the lifted `*OnDark` fills (3:1 on raised, cream text still 4.5:1); orange and silver stay. `CALENDAR_CATEGORIES`, `CalendarCategory` exported.
- `tokens.ts`: `light`, `dark` (`AdminTheme` objects), `THEMES`, `ThemeName`, plus `radius` (none 0, sm 4px, md 6px; no pill), `space` (4px steps), `type` roles (pageTitle 19/800, sectionTitle 11/800 upper, label 10.5/700 upper, body 13, bodySm 12.5, caption 11), `font`, `motion` (fast 150ms). `themeVars()`, `scaleVars()`, `tokensCss()` generate the CSS custom properties.
- CSS variables, all `--adm-*`: `surface-{page,raised,subtle,sunken,overlay}`, `text-{primary,secondary,muted,disabled,on-accent}`, `line`, `line-subtle`, `line-strong`, `accent`, `accent-hover`, `accent-soft`, `accent-soft-line`, `{ok,warn,danger,info,neutral}-{fg,bg,line}`, `focus`, `shadow-{sm,md}`, `radius-*`, `space-*`, `fs-/fw-/lh-/ls-<role>`, `font`, `motion-fast`.
- WCAG AA checked for both sets (`node scripts/admin-ui-check.mjs --contrast`): text 4.5:1 on every surface, status fg on its bg, on-accent on accent; `line-strong` (control borders) and `focus` 3:1; save bar text and button labels 4.5:1; each calendar category fg on its fill 4.5:1, and in dark the fill 3:1 on raised. Light 39 pairs, dark 44 pairs, all pass. `line` / `line-subtle` are decorative dividers. Control borders are darker than the old `#d0d0d0` field border on purpose (that one was 1.5:1).
- A new theme = one more `AdminTheme` object in `THEMES`.
- `useAdminTheme()` hook, `getAdminTheme()`, `subscribeAdminTheme(fn)`, `startAdminThemeSync()`: the one Strapi theme reader (STRAPI_THEME + prefers-color-scheme + storage event + 1.5s poll). It sets `<html data-adm-theme="light|dark">`.
- `styles.ts`: `ADM_CSS` (component classes, `adm-` prefix, scoped under `.adm-root`, only `var(--adm-*)`), `ensureAdminUi()` (injects tokens + classes once, starts the theme sync). Called from the app.tsx bootstrap; AdminPage and Modal call it again as a safety net.
- `.adm-root` (AdminPage, Modal portal, the save bar itself) is also skipped by the global SaveBar tagger in app.tsx, like `.pce`.

### Components (props, briefly)
- `AdminPage` {stack?}: page root (background, padding, `.adm-root`), replaces `.eduf`.
- `Window`: bordered card. `PageHeader` {title, subtitle?, actions?, back?: {to?|onClick?, label?}}.
- `Section` {title?, aside?, footer?}. `TwoColumn` {rail, railWidth?=280, railLabel?, railClassName?}.
- `Button` {variant: primary (default)|secondary|danger|ghost, size: sm|md, loading?, icon?, iconOnly + aria-label (required by type), disabled?}.
- `StatusBadge` {tone: ok|warn|danger|info|neutral|accent, custom?: {fg,bg,line?}, size: sm|md}. `Chip` {onRemove?, removeLabel?}, `ChipList`.
- `Switch` {checked, onChange(next), label?, description?, disabled?, aria-label?}: role="switch", Space/Enter. `Checkbox` {checked, onChange(next), label?, indeterminate?}.
- `Field` {label, hint?, error?, required?, id?, hideLabel?} + `Input`, `Textarea`, `Select` {options?, placeholder?, onChange(value)}, `DateInput` {value: string|null, onChange(v|null), withTime?}; ids, aria-describedby, aria-invalid, required wired through context. `FieldRow` two columns.
- `SaveBar` {dirty, saving, saved?, error?, onSave, onDiscard?, saveLabel?, discardLabel?, extra?, disabled?, shortcut?=true}: the custom-page wrapper of `SaveBarView`, see "Save bar". Shows dirty/saving/confirm/error text only; a successful save is a Toast, not bar text.
- `useSaveState()` -> {dirty, saving, saved, error, status, bar, markDirty, setDirty, reset, setError, run(fn, errorMessage?)}; `saved` lasts 2s (`SAVED_MS`, used for bar styling only); `run()` also fires the save-result toast (success or error).
- `useUnsavedGuard(dirty, {title?, message?})` -> dialog element; `<UnsavedGuard when={dirty} />`. react-router `useBlocker` (Strapi runs a data router), capture-phase interception of links in the EduSport sidebar / mobile nav (outside the router), beforeunload. Confirms through ConfirmDialog.
- `Notice` {tone: ok|warn|danger|info, title?, action?}: persistent, page-bound message (e.g. a load error blocking a section). `EmptyState` {icon?, action?}. `Spinner` {size?, label?}, `Loading` {text?}.
- `Toast`: general, short-lived feedback (a save result, a background warning), not persistent and not page-bound, that's what stays with `Notice`. `adminToast` {success|info|warn|error(text, opts?: {title?, duration?}), dismiss(id)}: a module-level event emitter, no React provider needed, callable from any of the admin's several React roots. `useToast()` returns the same API as a hook. `toastAutosaved()` fires the "Salvat" success toast for autosave pages (phase 2). `<ToastViewport/>` is mounted once for the whole admin from the app.tsx bootstrap (`mountToastViewport`, next to mountSaveBar/mountEdusportShell), portals to `document.body`. Top-right, below Strapi's header, full width on phones; square 4px radius, raised surface, 3px tone-coloured left edge, shadow md. success/info auto-dismiss 3s, warn 5s, error stays until closed; hover pauses the timer; at most 3 visible, a new one pushes the oldest out. `useSaveState.run()` raises the save-result toast itself, so `SaveBar` no longer shows its own "Salvat" text.
- `Modal` {open, onClose, title, footer?, headerExtra?, size: sm|md|lg, dismissable?, initialFocusRef?, role?, zIndex?}: portal, Esc, backdrop, focus trap, focus return, stack aware. `ConfirmDialog` now renders on it, same props.
- `Tabs` {items: {id,label,count?,disabled?}[], value, onChange, label?, panelId?}: arrow keys. `Pager` {page, pageCount, onChange, total?, pageSize?}.
- `DataTable<T>` {columns: {key, header, render?, value?, sortable?, searchable?, align?, width?}[], rows, getRowKey, onRowClick?, rowLabel?, loading?, empty?, noMatches?, search?, searchPlaceholder?, toolbar?, pageSize?=25 (0 = off), initialSort?}.
- `ImagePicker` {open, onClose, onPick, multiple?, title?, allowUpload?=true}: dashboard MediaModal query (GET /upload/files) + POST /upload, on Modal.
- `InboxLayout<T>` {tabs?, activeTab?, onTabChange?, toolbar?, bulkBar?, notice?, items, getKey, renderItem, groupBy?, selectedKey, onSelect, loading?, error?, empty?, page, pageCount, total?, pageSize?, onPageChange, reader, readerEmpty?}. Built only; Mesaje and FormResults move onto it in 2c.
- Proved on NavigationPage (Meniu site): PageHeader, TwoColumn, Section, Field/Textarea, Button, StatusBadge, Notice, SaveBar + useSaveState + UnsavedGuard, ImagePicker.

### Token checker
`node scripts/admin-ui-check.mjs [--list] [--strict] [--contrast]`: raw hex, rgb()/hsl() and non-token border-radius in `src/admin/**/*.{ts,tsx}` outside tokens.ts, counts per file. Exits non-zero only with `--strict`.
Baseline at the end of phase 1: **28 files, 1130 hits (hex 889, rgb 60, radius 181)**. Before phase 1 the same scan gave 30 files, 1173 hits. `src/admin/ui` is at 0. Later phases drive the total to 0, then CI can run `--strict`.

### Save bar (one bar for everything, 2026-09-30)
- `SaveBarView` (src/admin/ui/SaveBarView.tsx): the presentational bar, styled only with `--adm-savebar-*` and `--adm-radius-savebar*` tokens, classes `.adm-sbar*` in styles.ts. Fixed, centred 16px above the bottom, 360 to 720px wide, 8px radius, border, shadow; a round status dot (warning / success / danger, spinner while saving), then "Modificări nesalvate" / "Se salvează…" / "Sigur că renunți la modificări?" / "Modificări gata de publicare" / "Publicat" / "Previzualizare disponibilă"; Renunță with the inline Nu / Da, renunță step, Salvează, and Previzualizează / Publică / Retrage publicarea when the wrapper offers them. At 640px and below a full-width bottom sheet with safe-area padding. Keys while mounted: Cmd/Ctrl+S saves, Esc asks to discard or cancels the question (not while a dialog is open). Props {state: dirty|saving|idle, confirming?, visible?, inline?, sheet?, theme?, message?, tone?, canSave?, canPublish?, canUnpublish?, canPreview?, on*, extra?, saveLabel?, discardLabel?, keyboard?}; `useSlideIn(show)` and `useDiscardConfirm(dirty)` (5s timeout) are exported with it.
- src/admin/SaveBar.tsx (global, native content-manager pages): mirroring logic unchanged (MutationObserver on the tagged, hidden Strapi buttons, clicks forwarded, Renunță reloads). Renders `SaveBarView`; its private palette and theme reader are gone, the theme comes from `useAdminTheme` (getAdminTheme / subscribeAdminTheme). Shows whenever something is actionable (dirty, publish, unpublish, preview).
- src/admin/ui/SaveBar.tsx (custom pages): the same `SaveBarView`, driven by `useSaveState` (`<SaveBar {...save.bar} onSave onDiscard />`, props unchanged). Portalled to `<body>`, floats and shows only while dirty / saving / confirming; a failed save shows the error in the bar with a danger dot; the success and error toasts stay in `useSaveState.run`. Swallows the browser's Cmd/Ctrl+S dialog even while hidden. An in-flow 72px spacer keeps the end of the page reachable under the bar. The old sticky `.adm-savebar` CSS is gone.
- A page never shows both bars: the app.tsx tagger skips every button inside `.pce` (older custom pages, calendar editor) or `.adm-root` (shared-component pages, modals, the bar itself), so on a custom page nothing is tagged and the global bar has nothing to mirror. Keep `.pce` on custom pages that are not on AdminPage yet.
- Reference page: a live demo (useSaveState + SaveBar + UnsavedGuard) and `SaveBarView inline` in every state: dirty, saving, confirming, error, ready to publish, published, dirty with Publică, phone sheet.

### Reference page: Culori
- Palette swatches per scale (name, step, hex), then every semantic token per theme, each panel under its own `data-adm-theme`, showing the token name and value.

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

Built only (2026-09-30); no page or editor migrated yet. Demos: reference page, window "Componente pentru editoare". Every new component root carries `.adm-root`, so it styles and themes inside content-manager custom fields too (no AdminPage around them). Popups (lists, time spinners, tooltips) go through the internal `Popover`: portalled to `<body>`, fixed, flips above, closes on outside pointer and Escape (Escape does not reach an enclosing Modal).

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
- `SegmentedControl<V>` {options (2-4), value, onChange, aria-label, size? sm | md, block?, disabled?}: role="radiogroup", roving focus, accent fill; replaces .pubseg and VideoEmbedEditor's Radio.Group.
- `ImagePicker` gains `accept?: 'image' | 'video' | 'any'` (default 'image', existing props unchanged): mime filter, upload accept, Romanian copy per kind, video tiles preview the first frame. `PickedMedia` = PickedImage.
- `Popover` {open, anchorRef, onClose?, placement?, offset?, matchWidth?, role?, id?, popoverProps?}: exported for later popups.
- `Field` exports the `FieldAria` type (what useFieldControl hands to a control); Field's own API is unchanged.

Checker after phase 1b: src/admin/ui at 0 outside tokens.ts, total unchanged (27 files, 1093 hits); contrast passes in both themes.

## Token naming (decided 2026-09-30)
- Two layers only: palette (raw hex, tokens.ts only) -> semantic theme tokens. No per-component tokens.
- Semantic tokens are named `--theme-*` and read as plain meaning: --theme-primary, --theme-primary-hover, --theme-primary-soft, --theme-primary-soft-line, --theme-on-primary, --theme-bg (page), --theme-surface, --theme-surface-subtle, --theme-surface-sunken, --theme-overlay, --theme-text, --theme-text-secondary, --theme-text-muted, --theme-text-disabled, --theme-border, --theme-border-subtle, --theme-border-strong, --theme-success/-warning/-danger/-info/-neutral (+ -bg, -border), --theme-focus, --theme-shadow-sm/md, --theme-cat-* (calendar), --theme-savebar-*.
- "accent" is renamed "primary" everywhere.
- Non-colour scales (radius, space, type roles, motion) keep their own names.
- CSS class names use the `ui-` prefix (the component library in src/admin/ui): .ui-btn, .ui-field, .ui-table, .ui-savebar. `--theme-*` = theme values, `.ui-*` = components.
- A new theme = one more semantic mapping onto the palette.
- [ ] Rename pass (after phase 1b lands): tokens.ts, styles.ts, every component, migrated pages, checker rule (no hex outside tokens.ts; components use only --theme-* for colour).
