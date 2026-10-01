# Brief for phase 2 agents (move existing custom pages onto the shared set)
Read: docs/admin-ui/PLAN.md (decisions, --theme-* tokens, .ui-* classes, component APIs), docs/admin-ui/INVENTORY.md (current variants with file:line), docs/admin-ui/CUSTOM-PAGES.md ("How to build a page"), src/admin/ui/index.ts, src/admin/lib, and two verified references: src/admin/pages/PaginaEchipaPage.tsx (single type) and src/admin/dashboard/NavigationPage.tsx.
Rules for every page you own:
- Same behaviour and data: every field, filter, action, keyboard shortcut and API call keeps working. Do not change content types or endpoints.
- Chrome: AdminPage + Window + PageHeader (+ back link where there is one today). Sections: Section / EditorCard / ObjectFieldCard.
- Inputs: shared Field + Input/Textarea/Select/DateInput/DateRangeInput/TimeInput/NumberInput/TagsInput/SearchableSelect/SegmentedControl/Switch (on/off)/Checkbox (picking options).
- Lists: RepeatableList (reorder / expandable / confirmDelete), GalleryGrid, ImagePicker (accept image/video), DataTable, Tabs, Pager, InboxLayout.
- Saving: edit pages use usePageForm + useSaveState + the floating SaveBar + useUnsavedGuard (the same bar as Setări site). Autosave pages keep autosave and call toastAutosaved() / adminToast.error. Remove old ".msg" banners: general feedback = adminToast, persistent page messages = Notice.
- Badges: StatusBadge (square), Chip for removable tags. Deletes: ConfirmDialog.
- Styling: remove the page's own CSS and EDU_CSS / .insp / page-local stylesheets once nothing uses them; tokens only (--theme-*, --ui-*), no raw colours, square 4px corners.
- Do NOT edit src/admin/ui/**, src/admin/lib/**, menu.tsx, routes.ts, app.tsx unless your brief says so; if a shared component lacks something you need, add it locally first and report it.
Checks: `npx tsc --noEmit -p tsconfig.json` clean; `npx tsc --noEmit -p src/admin/tsconfig.json` no new errors (baseline 41, and fix any of the 41 that are in your files); `node scripts/admin-ui-check.mjs` total must drop (report before -> after; your files at 0). Never touch the dev container strapi_app or ports 1337/5173. No push, no deploy, no subagents. One commit per page (conventional, no AI attribution). Tick your items in docs/admin-ui/PLAN.md.
Return only: status, commit SHAs, checker before -> after, per page one line (anything changed in behaviour or look), one-line concerns.
