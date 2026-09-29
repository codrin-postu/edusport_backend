# Admin UI standardisation (2026-09-29)

Decisions (user, companion screens 101-102):
- Badges/pills: square, 4px radius (StatusBadge, Chip).
- Save: sticky bottom SaveBar on every custom edit page: disabled until dirty, "Ai modificări nesalvate", Renunță + Salvează, Cmd/Ctrl+S, leave guard, "Salvat" 2s after save. Delete stays in the header via ConfirmDialog. Autosave pages (tables, inboxes) keep autosave with one small "Salvat" feedback.
- Booleans: Switch for on/off settings, Checkbox only for picking options.
- Theme: design tokens (like the website), light + dark sets, following Strapi's theme; any future theme = one more token set.
- Base look: the existing .eduf look (navy #2138b8 accent, 4px corners, system font).

## Phases
- [ ] 1. Tokens + shared components in src/admin/ui/ (+ token checker script)
- [ ] 2a. Move list pages: Sportivi, Competiții, Anunțuri, Sponsori, Membri echipă
- [ ] 2b. Move edit pages: SportivEdit, CompetitieEdit, AnuntEdit, HomepageEdit, ProgramEdit, VoluntariatEdit, Navigation
- [ ] 2c. Move the rest: SubmissionTable (Înscrieri, Voluntari), Mesaje + FormResults (shared InboxLayout), Formulare, FormEditor, Dashboard, calendar editor (ProgramOverviewEditor), SaveBar/MobileNav/BlocksToolbarExtra theme hook
- [ ] 3. Meniu site page switches (needs the hidden-page decisions) + frontend support

Inventory: docs/admin-ui/INVENTORY.md
