# Admin tour ("Primii pași") and menu follow-ups: design

Date: 2026-11-26. Status: approved in conversation (mockup https://claude.ai/artifact/89hZZHc41EKGUouBmAmxFp, version 13). Backend branch `feat/admin-tour`; frontend guide text on a branch in edusport_frontend.

## Why

New admin accounts get no help inside the panel. The owner wants a short welcome, a guided practice of the real jobs of each role, and the staff guide always one click away. A practice must never change club data.

## Goals

- First login: a welcome window, then a 2-stop introduction. Shown once per admin account, on any device.
- "Primii pași": per-role flows that walk the admin through a real job on the real screens, on example data, saving nothing.
- Progress saved per admin in the database; a progress circle shows it.
- A link to the guide always visible in the menu.
- The menu and wording decisions taken on 2026-11-26 (below).

## Non-goals and anti-goals

- No flow for Articole (still the Strapi editor), adding a competition by hand (goes through Strapi), or starting a season (yearly, irreversible): those stay guide-only.
- Never mention or point at "Meniul Strapi" in any tour, welcome or flow text.
- A tour must never create, change or send anything. If one save gets through, the feature has failed.
- No long texts: one short line per card, idiomatic Romanian (see Copy).

## Approaches considered

- A. Own tour component in the admin, styled with the admin UI kit, steps derived from the same role and feature rules as the menu. **Chosen.**
- B. A tour library (driver.js or similar): fights the house style (square corners, Romanian, no pills), adds a dependency, not faster.
- C. No on-screen highlighting, only a checklist linking to guide pages: not the on-screen practice the owner asked for.

## Decisions (owner, 2026-11-26)

### Menu and wording
1. Group order: Noutăți (Anunțuri, Articole) first, right under Acasă; then Formulare, Club și școală, Pagini site, Setări. No single rows under Acasă.
2. Club și școală order: Sportivi, Grupe, Prețuri, Prezență, Contabilitate, Calendar și serii, Tabele, Membri echipă, Competiții.
3. The Formulare hub row is renamed "Întrebările formularelor" and moves to the end of the Formulare group.
4. "Analiză trafic" and "Sănătate site" are shown to every admin (not only Super Admin) when Umami / GlitchTip are configured.
5. Strapi's own menu: a "Meniul Strapi" row in Setări for Super Admin only; the footer "Comută la meniul Strapi" is no longer shown to other roles.
6. Security page: "Chei de acces" becomes "Passkey" (labels, buttons, guide).
7. Sidebar footer: a "Ghid EduSport" link (opens the public guide /ghid in a new tab) above the account rows, on desktop and in the phone menu.
8. Open, not built: the "Înregistrează plata" shortcut after confirming a registration (owner undecided).

### Welcome and introduction
- Welcome window on the first panel load of an account whose introduction is not done: title "Bun venit, <prenume>", one line per role, "Turul durează 5 minute.", buttons "Mai târziu" and "Începe".
  - Super Admin: "Ai acces la tot panoul."
  - Administrator club: "Gestionezi înscrierile, sportivii, grupele, prezența și plățile."
  - Editor site: "Gestionezi conținutul site-ului."
- "Mai târziu" and finishing both mark the introduction done; toast on "Mai târziu": "Turul îl găsești la Primii pași."
- Introduction, 2 stops: the "Primii pași" menu row ("Primii pași" / "Exersează sarcinile de bază. Nimic nu se salvează.") and the guide link ("Ghid" / "Instrucțiuni pentru orice sarcină."). End toast "Gata.".

### Primii pași
- Footer row "Primii pași" above "Ghid EduSport": a small progress circle and "done/total"; hidden when every flow of the role is done. Opens the Primii pași page.
- Setări row "Primii pași" (every role) opens the same page: header "Primii pași", subtitle "Exersează sarcinile de bază. Nimic nu se salvează.", a large progress circle with "X din Y parcurse", the role's flows (each "Începe", or "Parcurs" with "Reia"), and a "Reia turul" button for the introduction.
- Replaying never resets saved progress.
- Flows per role (a flow whose feature switch is off, or whose page the role cannot open, is not listed):
  - Administrator club: Confirmă o înscriere; Adaugă un sportiv; Creează o grupă; Completează prezența; Înregistrează o plată; Anulează sau mută o ședință; Scrie un anunț; Invită un părinte în portal.
  - Super Admin: the same plus Pornește sau oprește o funcție.
  - Editor site: Modifică o pagină; Scrie un anunț; Actualizează prețurile; Adaugă un membru în echipă.

### Flow behaviour
- Each step: page name ("Înscrieri"), a progress circle for the flow, title, at most one short line, an optional action line ("Apasă Salvează."), optional "Mai multe în ghid" link to the matching guide page, "Ieși din exemplu", and "Următorul" when the step does not wait for a click.
- Action steps wait for the admin's real click or choice on the highlighted element, then advance.
- While a flow runs: a strip "Exemplu: nu se salvează nimic"; pages show example data only; every request that would save is blocked; the final save button completes the flow with toast "Gata. Nu s-a salvat nimic." and the admin lands on the Primii pași page.
- Highlight: light dim (page stays readable), primary-colour outline around the element, card beside it (bottom sheet on phone). Square corners; the progress circle is the one approved round shape.
- Esc or "Ieși din exemplu" leaves without marking the flow done and without saving anything.

### Approved flow texts (the other nine flows get texts in the same style, approved by the owner before they are built)
- Confirmă o înscriere: "Înscrieri noi" / "Cererile trimise de pe site." / "Deschide înscrierea Mariei Popescu."; "Datele înscrierii" / "Verifică ce a completat părintele." / "Apasă Confirmă înscrierea."; "Sportiv nou sau existent" / "Dacă are deja fișă, alege Sportiv existent." / "Alege o variantă."; "Grupa" / "Poți alege grupa și mai târziu."; "Confirmă" / "Sportivul apare apoi în Sportivi." / "Apasă Confirmă înscrierea."
- Completează prezența: "De completat" / "Ședințele fără prezență." / "Deschide ședința de luni."; "Antrenor" / "Verifică cine a ținut antrenamentul."; "Prezenți" / "Bifează Grup la fiecare sportiv prezent."; "Salvează" / "Prezența contează la abonamente și plăți." / "Apasă Salvează."
- Scrie un anunț: "Anunț nou" / "Apasă + Anunț nou."; "Unde apare" / "Pe site, în portal sau în ambele."; "Pentru cine" / "Toate grupele sau doar cele vizate."; "Titlu și mesaj" / "Scurt și la obiect."; "Perioada" / "După ultima zi, anunțul dispare."; "Salvează" / "Apasă Salvează."

## Copy rules

One short line per card; idiomatic Romanian a club secretary would say; never describe the interface itself (layout, the circle, ordering); no explanations of why; second person; no dashes, middle dots, emoji; straight quotes. Every new string goes to the owner before it ships.

## Constraints

- Strapi 5.52 custom admin (`src/admin`); rules testable as pure modules in `src/club/**` (Vitest, behaviour tests only, `--maxWorkers=3`).
- Progress belongs to the admin account (`admin_accounts`, one row per admin, keyed by `adminUserId`); a new attribute needs a Strapi restart in production.
- Steps and flow lists derive from the same role areas and feature switches as the menu (`menu.tsx`), so a tour never points at a page the admin cannot open.
- Admin UI kit and tokens only (`src/admin/ui`); `scripts/admin-ui-check.mjs` stays green.
- Guide pages (edusport_frontend `src/content/ghid`) updated for every menu path and label that changes.

## Left to the builder (Claude's calls, flagged)

- How example data reaches the pages. Recommended: while a flow runs, the admin's fetch layer answers the flow's reads with example fixtures and refuses every write (one guard in front of `window.fetch`, which Strapi's `useFetchClient` also uses), so pages need no demo code; the final save is intercepted by the tour before it reaches the page.
- The storage shape on `admin_accounts` and the two endpoints (read own progress, mark intro or a flow done), own account only.
- Element anchoring (`data-tour` attributes) and placement maths.
- Exact step lists for the nine flows not yet written, taken from the guide pages, in the copy style above, for owner approval.
