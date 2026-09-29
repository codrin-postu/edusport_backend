# Page on/off from the CMS (decided 2026-09-29)

- Where: CMS single type "Meniu site" (api::navigation.navigation) gets a list of pages with an enabled flag. Editing UI: the custom Meniu site admin page (companion screen 102): name + switch per page, click a page = address + "Deschide pagina", no checkbox.
- Switchable: Istoric (/despre-noi), Echipa, Sportivi (+ /despre-noi/sportivi/*), Realizări, Voluntariat (+ /voluntariat/inscriere), Școala de Patinaj (/cursuri), Program, Regulament, Noutăți (+ /noutati/* and the Evenimente link), Parteneri, Înscrieri. Always on: Acasă, Contact, Protecția datelor.
- A hidden page returns the normal 404 (notFound()).
- Only the nav bar (desktop + mobile), the footer and the sitemap hide it. Links inside other pages stay (they lead to the 404).
- CMS unreachable or no data: every page stays on. A dropdown whose pages are all off disappears.
- Saving in the CMS revalidates the site immediately (frontend /api/revalidate).

## Backend implementation (2026-09-29)

- Schema: new component `nav.page` ("Pagină meniu", `key` + `enabled`, default
  `true`) added as `pages` (repeatable) on the `api::navigation.navigation`
  single type, alongside the existing `overrides` (unchanged).
- Fixed key list, in order: `istoric, echipa, sportivi, realizari, voluntariat,
  scoala, program, regulament, noutati, parteneri, inscrieri`
  (`src/api/navigation/services/pages.ts::PAGE_KEYS`).
- Normalisation runs on every `bootstrap()` (`src/index.ts`): missing keys are
  added as enabled, unknown keys are dropped, order always matches
  `PAGE_KEYS`. It never flips an existing `enabled` value, and creates the
  "Meniu site" entry itself if it does not exist yet.
- Public read: same as today — `GET /api/navigation` (public role / API
  token, whichever the frontend already uses), with `pages` populated
  explicitly by the caller, e.g. `?populate[pages]=true` alongside the
  existing `populate[overrides][populate]=image`. No new route was added;
  the admin editing UI (a write path for `pages`) is a separate, later change
  and is not part of this backend change.
- Revalidate: `src/api/navigation/content-types/navigation/lifecycles.ts`
  pings the frontend's `/api/revalidate` (no query params, so it purges the
  frontend's full default route set — covers the nav bar, footer and every
  sitemap-linked page) after every create/update of the single type, via
  `src/utils/revalidate.ts`. Fire-and-forget: a failed ping only delays
  cache purge, never fails the CMS save. New env vars `REVALIDATE_SECRET`
  (must match the frontend's) and `REVALIDATE_FRONTEND_URL` (optional,
  defaults to `FRONTEND_ORIGIN`) — see `.env.example`.

## Deploy notes

- The `pages` component and the `nav.page` component are new schema —
  **Strapi must be restarted** (or redeployed) for the content-type schema
  change to take effect, same as any other schema.json edit. This was not
  done as part of this change.
- No database migration script is needed beyond the restart: Strapi adds the
  new component table/columns on boot, and `normalizeNavigationPages()` seeds
  the `pages` rows on the same boot.
- Set `REVALIDATE_SECRET` (and `REVALIDATE_FRONTEND_URL` if the revalidate
  target differs from `FRONTEND_ORIGIN`) in the deploy environment; without
  it the ping is silently skipped and cache purge falls back to each route's
  own TTL.
