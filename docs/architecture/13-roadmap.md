# 13. Roadmap and progress

Tracks the phases of `10-spec.md` section 7. Update the status line of a phase when it moves. Decisions live in `edusport_frontend/docs/portal/DECISIONS.md`; open questions in `09-open-items.md`.

| # | Phase | Status |
|---|---|---|
| 1 | Data foundation | Live (deployed, migrated) |
| 2 | Registration rebuild | Merged to main 2026-10-26 (be 9f869cf, fe e35e41a). Not deployed: waits on the club items below, then `12-phase2-deploy-runbook.md` |
| 3 | Admin Înscrieri + Sportivi, confirmation and matching | 3A, 3B, 3C (personal data) built and reviewed on feat/athletes (2026-10-27); not merged to main, not deployed. TEST env runs 3A/3B |
| 4 | Groups and schedules | 6 of 7 plans merged on feat/athletes (8849250); 4-6 final review left; not deployed |
| 5 | Attendance, subscriptions and payments | Questions answered (2026-10-27), spec draft written, copy approval pending |
| 6 | Login and the coach portal | Not started |
| 7 | Parent portal | Not started |
| 8 | Documents page | Not started |
| 9 | Tracking (after phase 8) | Planned: Umami events on the registration steps + funnel report, UTM codes on club links, Umami version check (Realtime, Sessions, Journeys). Ad pixels (Meta/Google/TikTok) only if the club starts paid ads: then a consent banner, one conversion event without personal data, public pages only (user, 2026-10-28) |
| 10 | Admin trim (after phase 9) | Planned from the audit `edusport_backend/.superpowers/strapi-trim-audit.md`: Strapi telemetry off on the VM, admin NPS and enterprise promos off, remove @strapi/plugin-cloud and strapi-5-plugin-responsive-backend, optionally disable content-releases and the email plugin, Articole menu to the custom page, a "Staff club" admin role (custom pages only, Settings / Marketplace / Content-Type Builder hidden) tested on every page; finer roles belong to phase 6 (user, 2026-10-28) |

One deploy window for phases 2, 3 and 4: `15-deploy-window-2-3-4.md`.

## Phase 2 go-live

- [ ] Brevo (user's account): test key on codrin.space now; at go-live a separate production key only in the VM .env.production, the test key deleted, and Security > Authorized IPs turned on with the VM address only (178.105.192.111, confirm the outgoing address with `curl ifconfig.me` on the VM first)
- [ ] Club: DNS records for scoaladepatinaj.com (SPF include, DKIM, DMARC); mail-tester 9/10 or better
- [ ] Club: confirm the legal numbers in `src/club/documents/association.ts` (C.I.F., C.I.S., registry no., IBAN, bank branch)
- [ ] Club: WhatsApp channel link (Setări site, Contact)
- [ ] Club: real Avansați Gold prices
- [ ] Runbook table "Before the window", items 1 to 13 (VM env, read-only DB checks, nginx X-Real-IP)
- [ ] Deploy window per runbook (user approves each step)
- [ ] Visual snapshots: review changed crops of /, /cursuri, /inscrieri, then re-record

## Phase 4 go-live

- [ ] Deploy and migration per `14-phase4-deploy-runbook.md` (after the phase 2 + 3 window; step 0 SQL on a production copy first)

## Small open items

- [x] Admin stat tiles keep the left band (decided 2026-10-26)
- [ ] Local `strapi_app`: `npm install` inside the container (pdfkit), then start
- [ ] Delete local branch `backup/registration-rebuild-pre-msgfilter` once no longer needed

## Blocked on the client

- Forward registrations to the owner's Apps Script once `doPost` can be added (`edusport_frontend/docs/portal/client-apps-script-dopost.md`); then decide whether her script still sends its own Acord.
