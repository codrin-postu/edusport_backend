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
| Pagina Echipă | api::team-page.team-page | /plugins/edusport-pagina-echipa | [ ] |
| Istoric | api::historic-page.historic-page | /plugins/edusport-istoric | [ ] |
| Parteneri (pagina) | api::partners-page.partners-page | /plugins/edusport-pagina-parteneri | [ ] |
| Discipline | api::discipline.discipline | /plugins/edusport-discipline | [ ] |
| Momente istoric | api::history-milestone.history-milestone | /plugins/edusport-momente-istoric | [ ] |
| Cursuri | api::cursuri-page.cursuri-page | /plugins/edusport-cursuri | [ ] |
| Prețuri | api::pricing.pricing | /plugins/edusport-preturi | [ ] |
| Regulament | api::course-regulations.course-regulations | /plugins/edusport-regulament | [ ] |
| Pagina Program | api::program-page.program-page | /plugins/edusport-pagina-program | [ ] |
| Realizări | api::realizari-page.realizari-page | /plugins/edusport-realizari | [ ] |
| Evenimente colaborare | api::collaboration-event.collaboration-event | /plugins/edusport-evenimente-colaborare (+ -edit) | [ ] |
| Articole | api::article.article | /plugins/edusport-articole (+ -edit) | [ ] later |
