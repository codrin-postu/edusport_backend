# Page on/off from the CMS (decided 2026-09-29)

- Where: CMS single type "Meniu site" (api::navigation.navigation) gets a list of pages with an enabled flag. Editing UI: the custom Meniu site admin page (companion screen 102): name + switch per page, click a page = address + "Deschide pagina", no checkbox.
- Switchable: Istoric (/despre-noi), Echipa, Sportivi (+ /despre-noi/sportivi/*), Realizări, Voluntariat (+ /voluntariat/inscriere), Școala de Patinaj (/cursuri), Program, Regulament, Noutăți (+ /noutati/* and the Evenimente link), Parteneri, Înscrieri. Always on: Acasă, Contact, Protecția datelor.
- A hidden page returns the normal 404 (notFound()).
- Only the nav bar (desktop + mobile), the footer and the sitemap hide it. Links inside other pages stay (they lead to the 404).
- CMS unreachable or no data: every page stays on. A dropdown whose pages are all off disappears.
- Saving in the CMS revalidates the site immediately (frontend /api/revalidate).
