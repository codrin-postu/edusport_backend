# Calendar editor redesign (approved 2026-10-01)

Page: /admin/plugins/edusport-program, component
`src/plugins/component-preview/admin/src/ProgramOverviewEditor.tsx` (calendar + event panel).
Approved mockups (open in a browser, read the HTML for exact layout):
- `.superpowers/brainstorm/43332-1790846771/content/calendar.html`: option **B** (Lună / Listă).
- `.superpowers/brainstorm/43332-1790846771/content/editor.html`: option **A** (side panel) + the Școala date editor at the bottom.

## Calendar (option B)
- Toolbar: prev / "Octombrie 2026" / next, an "Azi" button, spacer, SegmentedControl Lună | Listă, primary "+ Adaugă".
- Category filters move from the left column into a row of small square chips above the grid, grouped by colour (4 chips):
  Antrenament; Școala de patinaj; Competiție, cantonament, spectacol, eveniment; Liber, vacanță, sărbătoare.
  Toggle off = dimmed + struck through. Same filtering behaviour as now, just grouped.
- Month grid full width. Today marked (primary-filled day number). Weekend columns faintly tinted.
- Event chips: category soft tint background + 3px left border in the category colour + dark text, time in bold first ("**18:15** Antrenament Avansați"). Use the existing `--theme-cat-*` tokens; add soft-tint semantic tokens only if none exist (palette -> semantic, no component tokens). No more grey-for-everything.
- Text must not be cut mid-word on desktop at 1440 (truncate with ellipsis only when it truly does not fit).
- Listă view: all events of the month by day, grouped by week ("Săpt. 28 sep - 4 oct"), day column = weekday label + number, empty days within the week show "Nimic programat" only if the week otherwise has events (or skip them; choose the cleaner one).
- Click an event opens the editor for it; click an empty day opens "Adaugă" prefilled with that date.
- Mobile (<= 640px): toolbar wraps, filters behind a "Filtre" button (Popover with the 4 chips), default view = Listă. Lună on mobile = compact grid with small square category markers (no text) per day; tapping a day lists its events under the grid.

## Editor (option A, side panel)
- Opens as a right-side panel over the page (calendar visible behind, light overlay), width ~420px, full screen on mobile with sticky footer.
- Header: category colour square + title (or "Adaugă eveniment") + close.
- One column, sections: Evenimentul (Titlu; Categorie select showing colour square + Etichetă), Când (Început / Sfârșit / Toată ziua; Se termină a doua zi; Switch "Se repetă" that reveals frequency SegmentedControl, day buttons, De la / Până la, week-of-month where relevant), then collapsible "Excepții (n)" and "Conținut opțional: descriere, link, imagine".
- Footer: Șterge (danger ghost, left, keeps the ConfirmDialog), Anulează, Salvează (primary). Anulează / close / Esc with unsaved changes uses the existing "Da, renunță" confirm (useUnsavedGuard pattern), no browser dialog.
- Școala de patinaj date: same panel, Tabs Această dată / Toată seria; Stare SegmentedControl Curs / Liber / Anulat; Notă shown when not Curs.
- Save closes the panel and shows the standard success toast.
- Keep every existing field and behaviour (recurrence rules, overrides, exceptions, image picker, validation messages, the 1-year series limit). This is a layout rework, not a data change: no schema or API changes.

## Rules
- Shared `src/admin/ui` components only (Button, Field, Input, Select, DateInput, TimeInput, Switch, SegmentedControl, Tabs, Popover, ConfirmDialog...). Add a reusable `Drawer` (side panel) component to `src/admin/ui` if none exists, documented in the UI reference page.
- Tokens only (`--theme-*`), `.ui-` class prefix, no raw hex. `node scripts/admin-ui-check.mjs --strict --contrast` must exit 0.
- No rounded pills or circles (max radius = existing radius tokens), no dashed/dotted lines, no em dash in copy, Romanian copy with diacritics.
- Highlight any rename as old -> new in the report.
