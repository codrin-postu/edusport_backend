# Admin restyle: style, interaction, Înscrieri layout (2026-11-17)

Approved by the user 2026-11-17 ("looks much cleaner"). Mockup: https://claude.ai/artifact/N3LZcT4CTA9tjuz6gVvFaJ, source `2026-11-17-admin-restyle-mockup.html` next to this file (images stripped). Rules: CLAUDE.md (ui kit and tokens only, admin-ui-check strict, no pills/circles, no dashed lines, no vertical accent lines, terse Romanian copy, behaviour tests only).

## 1. Style (ui kit, every page)
- Control border lighter (about `#B9C0CC` light theme; dark theme: matching step), darkens on hover; focus keeps the blue ring.
- Inputs and Select triggers white (surface), not grey.
- Radius sm 6px (cards 8px).
- Buttons, Select triggers, menu items: 13px, weight 600 (typed text in inputs stays 400).
- Table header 11px; small uppercase field labels 11px (was 10px).
- Hover and active: rows, buttons, inputs, tabs get a hover background or darker border; pressed button `primary-soft`; a button whose menu is open gets the primary border and a soft 3px ring; transitions 120ms on colour/border/shadow only; `prefers-reduced-motion` disables them.
- Menus/popovers: appear with opacity + 4px slide (120ms), tick on the chosen option, item hover `primary-soft`.
- Selected table row: `primary-soft` background (no side line).

## 2. Înscrieri desktop
- One toolbar row: search, Status, Nivel, Alte filtre, then on the right Sortare (tooltip "Sortare"), a columns icon menu (Compact / Toate coloanele, tooltip "Coloane"), Export.
- "Sportiv existent" moves into Alte filtre.
- School tabs drop the "Școala de Patinaj - " prefix.
- Rows one line, 44px; school column shortened likewise and hidden on a school tab; Compact view without "Completat de".
- Panel: status is a Select styled as the status tag next to the name (replaces the badge and the status box); short fields in two columns, long ones (e-mail, telefon, așteptări, custom answers) full width.

## 3. Înscrieri phone (<=640px)
- Title row: "Înscrieri", "N noi" tag, season Select, "...".
- Search full width; Status, Nivel, Alte filtre, Sortare, Export on one horizontally scrolling row.
- List as cards: name + status tag; second line nr, age, school (not on a school tab), date (no year).
- Tap opens the registration full screen with "‹ Înscrieri" back link; footer buttons fixed at the bottom.

## 4. Other pages (one by one, after 1-3)
- Program: hide the empty Pauze box, "Adaugă pauză" in the header; shorter legend row.
- Contabilitate: drop titles that repeat the active tab.
- Athlete record Prezențe: 40px rows, chevron on hover, smaller tags.
- Sportivi: contact one line.
- Acasă: 10px card text to 11-12px, more space between cards.
