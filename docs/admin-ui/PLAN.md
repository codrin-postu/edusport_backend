# Admin UI standardisation (2026-09-29)

Decisions (user, companion screens 101-102):
- Badges/pills: square, 4px radius (StatusBadge, Chip).
- Save: sticky bottom SaveBar on every custom edit page: disabled until dirty, "Ai modificări nesalvate", Renunță + Salvează, Cmd/Ctrl+S, leave guard. A successful save raises a "Modificările au fost salvate." toast (general, short-lived feedback = Toast, not the bar itself, see below). Delete stays in the header via ConfirmDialog. Autosave pages (tables, inboxes) keep autosave with a "Salvat" toast (`toastAutosaved()`, phase 2).
- Booleans: Switch for on/off settings, Checkbox only for picking options.
- Theme: design tokens (like the website), light + dark sets, following Strapi's theme; any future theme = one more token set.
- Base look: the existing .eduf look (navy #2138b8 accent, 4px corners, system font).

## Phases
- [x] 1. Tokens + shared components in src/admin/ui/ (+ token checker script)
- [ ] 2a. Move list pages: Sportivi, Competiții, Anunțuri, Sponsori, Membri echipă
- [ ] 2b. Move edit pages: SportivEdit, CompetitieEdit, AnuntEdit, HomepageEdit, ProgramEdit, VoluntariatEdit (Navigation done in phase 1)
- [ ] 2c. Move the rest: SubmissionTable (Înscrieri, Voluntari), Mesaje + FormResults (shared InboxLayout), Formulare, FormEditor, Dashboard, calendar editor (ProgramOverviewEditor), SaveBar/MobileNav/BlocksToolbarExtra theme hook
- [ ] 3. Meniu site page switches (needs the hidden-page decisions) + frontend support

Inventory: docs/admin-ui/INVENTORY.md

## Phase 1 result

Everything lives in `src/admin/ui/`, imported through the barrel `src/admin/ui/index.ts`.
Reference page with every component in every state (light, dark, theme preview switch):
`/admin/plugins/edusport-ui`, registered with `app.router.addRoute` in menu.tsx, so it is in no sidebar.

### Tokens and theme
- `tokens.ts`: `light`, `dark` (`AdminTheme` objects), `THEMES`, `ThemeName`, plus `radius` (none 0, sm 4px, md 6px; no pill), `space` (4px steps), `type` roles (pageTitle 19/800, sectionTitle 11/800 upper, label 10.5/700 upper, body 13, bodySm 12.5, caption 11), `font`, `motion` (fast 150ms). `themeVars()`, `scaleVars()`, `tokensCss()` generate the CSS custom properties.
- CSS variables, all `--adm-*`: `surface-{page,raised,subtle,sunken,overlay}`, `text-{primary,secondary,muted,disabled,on-accent}`, `line`, `line-subtle`, `line-strong`, `accent`, `accent-hover`, `accent-soft`, `accent-soft-line`, `{ok,warn,danger,info,neutral}-{fg,bg,line}`, `focus`, `shadow-{sm,md}`, `radius-*`, `space-*`, `fs-/fw-/lh-/ls-<role>`, `font`, `motion-fast`.
- WCAG AA checked for both sets (`node scripts/admin-ui-check.mjs --contrast`): text 4.5:1 on every surface, status fg on its bg, on-accent on accent; `line-strong` (control borders) and `focus` 3:1. `line` / `line-subtle` are decorative dividers. Control borders are darker than the old `#d0d0d0` field border on purpose (that one was 1.5:1).
- A new theme = one more `AdminTheme` object in `THEMES`.
- `useAdminTheme()` hook, `getAdminTheme()`, `subscribeAdminTheme(fn)`, `startAdminThemeSync()`: the one Strapi theme reader (STRAPI_THEME + prefers-color-scheme + storage event + 1.5s poll). It sets `<html data-adm-theme="light|dark">`.
- `styles.ts`: `ADM_CSS` (component classes, `adm-` prefix, scoped under `.adm-root`, only `var(--adm-*)`), `ensureAdminUi()` (injects tokens + classes once, starts the theme sync). Called from the app.tsx bootstrap; AdminPage and Modal call it again as a safety net.
- `.adm-root` (AdminPage, Modal portal) is also skipped by the global SaveBar tagger in app.tsx, like `.pce`.

### Components (props, briefly)
- `AdminPage` {stack?}: page root (background, padding, `.adm-root`), replaces `.eduf`.
- `Window`: bordered card. `PageHeader` {title, subtitle?, actions?, back?: {to?|onClick?, label?}}.
- `Section` {title?, aside?, footer?}. `TwoColumn` {rail, railWidth?=280, railLabel?, railClassName?}.
- `Button` {variant: primary|secondary|danger|ghost, size: sm|md, loading?, icon?, iconOnly + aria-label (required by type), disabled?}.
- `StatusBadge` {tone: ok|warn|danger|info|neutral|accent, custom?: {fg,bg,line?}, size: sm|md}. `Chip` {onRemove?, removeLabel?}, `ChipList`.
- `Switch` {checked, onChange(next), label?, description?, disabled?, aria-label?}: role="switch", Space/Enter. `Checkbox` {checked, onChange(next), label?, indeterminate?}.
- `Field` {label, hint?, error?, required?, id?, hideLabel?} + `Input`, `Textarea`, `Select` {options?, placeholder?, onChange(value)}, `DateInput` {value: string|null, onChange(v|null), withTime?}; ids, aria-describedby, aria-invalid, required wired through context. `FieldRow` two columns.
- `SaveBar` {dirty, saving, saved?, error?, onSave, onDiscard?, saveLabel?, discardLabel?, extra?, disabled?, shortcut?=true}: sticky bottom, Cmd/Ctrl+S. Shows dirty/saving/error text only; a successful save is a Toast, not bar text.
- `useSaveState()` -> {dirty, saving, saved, error, status, bar, markDirty, setDirty, reset, setError, run(fn, errorMessage?)}; `saved` lasts 2s (`SAVED_MS`, used for bar styling only); `run()` also fires the save-result toast (success or error).
- `useUnsavedGuard(dirty, {title?, message?})` -> dialog element; `<UnsavedGuard when={dirty} />`. react-router `useBlocker` (Strapi runs a data router), capture-phase interception of links in the EduSport sidebar / mobile nav (outside the router), beforeunload. Confirms through ConfirmDialog.
- `Notice` {tone: ok|warn|danger|info, title?, action?}: persistent, page-bound message (e.g. a load error blocking a section). `EmptyState` {icon?, action?}. `Spinner` {size?, label?}, `Loading` {text?}.
- `Toast`: general, short-lived feedback (a save result, a background warning), not persistent and not page-bound — that's what stays with `Notice`. `adminToast` {success|info|warn|error(text, opts?: {title?, duration?}), dismiss(id)}: a module-level event emitter, no React provider needed, callable from any of the admin's several React roots. `useToast()` returns the same API as a hook. `toastAutosaved()` fires the "Salvat" success toast for autosave pages (phase 2). `<ToastViewport/>` is mounted once for the whole admin from the app.tsx bootstrap (`mountToastViewport`, next to mountSaveBar/mountEdusportShell), portals to `document.body`. Top-right, below Strapi's header, full width on phones; square 4px radius, raised surface, 3px tone-coloured left edge, shadow md. success/info auto-dismiss 3s, warn 5s, error stays until closed; hover pauses the timer; at most 3 visible, a new one pushes the oldest out. `useSaveState.run()` raises the save-result toast itself, so `SaveBar` no longer shows its own "Salvat" text.
- `Modal` {open, onClose, title, footer?, headerExtra?, size: sm|md|lg, dismissable?, initialFocusRef?, role?, zIndex?}: portal, Esc, backdrop, focus trap, focus return, stack aware. `ConfirmDialog` now renders on it, same props.
- `Tabs` {items: {id,label,count?,disabled?}[], value, onChange, label?, panelId?}: arrow keys. `Pager` {page, pageCount, onChange, total?, pageSize?}.
- `DataTable<T>` {columns: {key, header, render?, value?, sortable?, searchable?, align?, width?}[], rows, getRowKey, onRowClick?, rowLabel?, loading?, empty?, noMatches?, search?, searchPlaceholder?, toolbar?, pageSize?=25 (0 = off), initialSort?}.
- `ImagePicker` {open, onClose, onPick, multiple?, title?, allowUpload?=true}: dashboard MediaModal query (GET /upload/files) + POST /upload, on Modal.
- `InboxLayout<T>` {tabs?, activeTab?, onTabChange?, toolbar?, bulkBar?, notice?, items, getKey, renderItem, groupBy?, selectedKey, onSelect, loading?, error?, empty?, page, pageCount, total?, pageSize?, onPageChange, reader, readerEmpty?}. Built only; Mesaje and FormResults move onto it in 2c.
- Proved on NavigationPage (Meniu site): PageHeader, TwoColumn, Section, Field/Textarea, Button, StatusBadge, Notice, SaveBar + useSaveState + UnsavedGuard, ImagePicker.

### Token checker
`node scripts/admin-ui-check.mjs [--list] [--strict] [--contrast]`: raw hex, rgb()/hsl() and non-token border-radius in `src/admin/**/*.{ts,tsx}` outside tokens.ts, counts per file. Exits non-zero only with `--strict`.
Baseline at the end of phase 1: **28 files, 1130 hits (hex 889, rgb 60, radius 181)**. Before phase 1 the same scan gave 30 files, 1173 hits. `src/admin/ui` is at 0. Later phases drive the total to 0, then CI can run `--strict`.
