# Every sidebar page as a custom page (decided 2026-10-01)

Decisions (companion screen 109, user said "yes do", recommended answers):
- Each entry below becomes a custom admin page under /admin/plugins/edusport-<slug>, built only from src/admin/ui (floating SaveBar via useSaveState + useUnsavedGuard, toasts, --theme-* tokens, light and dark), like Meniu site (src/admin/dashboard/NavigationPage.tsx).
- Data model unchanged: same content types, same public API for the website. Pages read/write through the admin content-manager API (or a small admin-only endpoint where needed), respecting drafts only where the type uses draft & publish.
- Old content-manager URLs of these types redirect to the new pages (bookmarks keep working).
- Collections: Discipline and Momente istoric = list + edit in a Modal; Evenimente colaborare = list + own edit page.
- Articole is LAST, as its own step (needs our own rich-text editor, draft/publish, preview). It stays in Strapi's editor until then.
- Media stays Strapi's upload plugin.
- The existing custom field editors (src/plugins/component-preview) that live inside these types are replaced by the page's own sections built from ObjectFieldCard / RepeatableList / GalleryGrid / inputs. Keep the plugin registrations until nothing uses them, then remove.

| Entry | Content type | Route | Status |
|---|---|---|---|
| Setări site | api::site-settings.site-settings | /plugins/edusport-setari | [ ] |
| Pagina Echipă | api::team-page.team-page | /plugins/edusport-pagina-echipa | [x] |
| Istoric | api::historic-page.historic-page | /plugins/edusport-istoric | [ ] |
| Parteneri (pagina) | api::partners-page.partners-page | /plugins/edusport-pagina-parteneri | [ ] |
| Discipline | api::discipline.discipline | /plugins/edusport-discipline | [ ] |
| Momente istoric | api::history-milestone.history-milestone | /plugins/edusport-momente-istoric | [ ] |
| Cursuri | api::cursuri-page.cursuri-page | /plugins/edusport-cursuri | [x] |
| Prețuri | api::pricing.pricing | /plugins/edusport-preturi | [x] |
| Regulament | api::course-regulations.course-regulations | /plugins/edusport-regulament | [x] |
| Pagina Program | api::program-page.program-page | /plugins/edusport-pagina-program | [x] |
| Realizări | api::realizari-page.realizari-page | /plugins/edusport-realizari | [x] |
| Evenimente colaborare | api::collaboration-event.collaboration-event | /plugins/edusport-evenimente-colaborare (+ -edit) | [x] |
| Articole | api::article.article | /plugins/edusport-articole (+ -edit) | [ ] later |

## How to build a page

Groundwork done 2026-10-01: every row above has a route, a sidebar entry (Articole excepted) and a placeholder page; old content-manager URLs redirect. Reference implementation: `src/admin/pages/PaginaEchipaPage.tsx`.

### Files: who edits what
- `src/admin/pages/routes.ts`: route constants (`PAGINA_ECHIPA_TO`, ...), `UID` (content type uids), `strapiEditorUrl(uid, kind, documentId?)`, and `CUSTOM_PAGES`, the one list that menu.tsx registers (route only, `app.router.addRoute`) and the redirect reads. Complete; do not edit it or `dashboard/menu.tsx` (menu re-exports the constants).
- `src/admin/pages/<Name>Page.tsx`: your page, and only yours. Page-local helpers stay in that file (or a new `src/admin/pages/<Name>/` folder if it grows). Anything reusable goes to `src/admin/ui` in a separate step, not from a page branch.
- `src/admin/lib`: the data hooks below. Import from `'../lib'`, UI from `'../ui'`.
- The checker holds `src/admin/pages` and `src/admin/lib` to the colour rule: tokens only (`var(--theme-*)`, `--ui-*` scales), no hex / rgb / raw radius.

### Page pattern (single type)
```tsx
const page = useSingleType<MyType>(UID.cursuriPage);
const form = usePageForm<MyType>(page.data, page.saveState);
const banner = normalizeObject<Banner>(form.value.banner, EMPTY_BANNER); // JSON custom fields

<AdminPage>
  <Window>
    <PageHeader back={{ to: DASHBOARD_TO }} title="Cursuri" subtitle="..." />
    {page.loading ? <Loading /> : page.error ? <div className="ui-body"><Notice tone="danger">...</Notice></div> : (
      <div className="ui-body">
        <ObjectFieldCard<Banner> value={banner} onFieldChange={(k, v) => form.set('banner', { ...banner, [k]: v })} fields={[...]} />
        {/* RepeatableList / GalleryGrid / inputs for the other attributes */}
      </div>
    )}
    {!page.loading && !page.error && (
      <SaveBar {...page.saveState.bar} onSave={() => void page.save(form.value)} onDiscard={form.reset} />
    )}
  </Window>
  <UnsavedGuard when={form.dirty} />
</AdminPage>
```
- Rebuild the plugin editor(s) of the type (src/plugins/component-preview/admin/src/<X>Editor.tsx) field for field, same JSON shape, same keys, same Romanian labels / hints / placeholders. Merge edits into the loaded object (`{ ...banner, [k]: v }`), never rebuild it from EMPTY only, so keys the page does not show survive.
- Media: `ImagePicker` / `GalleryGrid`; keep the loaded file objects in the form (`{ id, url, ... }`), the serializer sends the ids.
- Collections: the list page uses `useCollection`; Discipline and Momente istoric edit in a `Modal` (a redirected entry URL arrives as `?id=<documentId>`: open that entry's modal), Evenimente colaborare has its own edit page (`EVENIMENT_COLABORARE_EDIT_TO?id=<documentId>`, no id = new) on `useCollectionEntry`.
- Keep the placeholder's `LinkOutCard` to `strapiEditorUrl(...)` only while the page is incomplete; remove it when the page covers every field. Tick the row above when done.

### Hooks (src/admin/lib)
- `useSingleType<T>(uid, { populate?, publish? })` -> `{ data: T | null, loading, error, exists, documentId, reload(), save(next): Promise<boolean>, saveState, schema }`. A single type never saved loads as `{}` with `exists: false`; the first save creates it.
- `useCollectionEntry<T>(uid, documentId | null, opts)` -> the same plus `remove()`. `documentId` null = new entry; after the first save `documentId` holds the new id (navigate to `?id=` with `replace`).
- `useCollection<T>(uid, { populate?, sort?, pageSize? = 100, publish? })` -> `{ items: Row<T>[], loading, error, reload(), create(data): Promise<Row<T> | null>, update(documentId, next): Promise<boolean>, remove(documentId): Promise<boolean>, reorder(nextItems): Promise<boolean>, orderField, saveState, schema }`. `Row<T>` = T + `{ id, documentId }`. Loads every page. Default sort `order:ASC` when the type has an integer `order` field (`orderField` = 'order'); `reorder` writes `order = index` only on the rows whose order changes (optimistic, rolled back on failure).
- `usePageForm<T>(loaded, saveState?)` -> `{ value, set(key, v), patch(partial), reset(), dirty }`. Working copy of `loaded`; restarts whenever `loaded` changes (load, reload, successful save). `dirty` is structural (deep compare with `loaded`). With `saveState` it keeps the save bar's dirty flag in step and `reset()` also clears the bar's error.
- `populate`: top-level relation fields to load as entries. The content-manager GET returns relations as `{ count }` only; listed fields come from `/content-manager/relations/<uid>/<documentId>/<field>` (first 100). Components, dynamic zones and media always come fully populated, nothing to list. None of the 12 types has a relation today.
- `publish` (default true): draft & publish types are published after every save (`.../actions/publish`). All 12 types are `draftAndPublish: false` today; only Articole is draft & publish, and it gets its own draft UI later.
- Every save / create / update / remove / reorder runs through `saveState.run`: saving flag, the success toast ("Modificările au fost salvate."), the error toast and the bar's error. Server details go to the console; the page shows a Romanian message (validation errors get "Datele nu sunt valide ...").

### How save / merge works
1. `save(next)` merges `next` over the loaded document and keeps only the top-level attributes whose value changed (deep compare). Attributes not changed are not sent at all.
2. The kept attributes are serialized against the schema from `/content-manager/init` (fetched once per session): media -> file id (single) or id array (multiple); relations -> `{ set: [{ id }] }` (a value still shaped `{ count }` is dropped, so an unloaded relation is never wiped; `{ set | connect | disconnect }` passes through); components -> recursed, `id` kept so the component updates in place (no id = new component); dynamic zones -> recursed, `__component` kept; `__temp_key__`, document meta (`id`, `documentId`, timestamps, creator fields, `locale`, `status`) and keys unknown to the schema dropped.
3. PUT `/content-manager/single-types/<uid>` (or `collection-types/<uid>/<documentId>`; POST `collection-types/<uid>` to create), then publish for draft & publish types, then the document is re-fetched and becomes the new `data` (and the form's new baseline).
4. Why this is safe (read from Strapi 5.52's document service): an update only touches attributes present in the body (`components.mjs`: `if (!has(attributeName, data)) continue`; update validation is notNull, not required), so fields and relations the page does not send keep their stored values. Inside a changed component, keys the page left out are kept too (the component is updated by id). A repeatable component or dynamic zone list sent is the whole list: items missing from it are deleted, so always send the full list (it is, since the page edits the loaded array).
5. JSON custom fields (most of these types) are plain values: the whole JSON object of a changed attribute is sent, so merge edits into the loaded object.

### Redirects
- `src/admin/lib/legacyRedirects.ts`, started first in the app.tsx bootstrap: wraps `history.pushState` / `replaceState` and listens to `popstate`; a match is replaced with the page URL and `popstate` is fired so Strapi's router follows. Direct loads are redirected before the router reads the URL.
- `/admin/content-manager/single-types/<uid>` -> the page; `collection-types/<uid>` -> the list page; `collection-types/<uid>/<documentId>` -> the edit page `?id=` (the list page `?id=` for Discipline / Momente istoric); `.../create` -> the edit page without id (the list page for modal types).
- Escape hatch: add `?strapi=1` to the old URL (`strapiEditorUrl()` does). It holds while you stay on that type's content-manager URLs and ends when you leave them.
- Only `CUSTOM_PAGES` rows with `redirect: true`; Articole has `redirect: false` until its page is done (flip it there, and point its sidebar entry at `ARTICOLE_TO` in menu.tsx, in that step).
