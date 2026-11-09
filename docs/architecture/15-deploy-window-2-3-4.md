# 15. Deploy window for phases 2, 3 and 4

One window for phases 2, 3 and 4 (user decision, 2026-10-27). This page replaces the order of `12-phase2-deploy-runbook.md` and `14-phase4-deploy-runbook.md`; their detail (item tables, step tables, rollback per step) still applies and is linked below. Production facts, VM paths and the command prefix: `11-migration-runbook.md`.

Rules for the whole window:

- Every write step (deploy, merge, env change, `--apply`, deletion, admin toggle) runs only with the user's explicit yes, asked step by step. Read-only checks need no approval but are reported.
- Every `--apply` is preceded by its dry run, shown to the user.
- VM: `ssh edusport-vm`, code in `/opt/edusport/<repo>`, compose service `backend`. Command prefix on the VM, in `/opt/edusport/edusport_backend`:
  `docker compose -f docker-compose.production.yml --env-file .env.production exec backend <command>` (called `EXEC` below).
- Website needs frontend `feat/athletes` (f2c4e0d or later) deployed together with the backend. Old frontend plus new backend breaks the registration form (runbook 12).

## 1. Blocked on the club

| # | Item | Why it matters | If we go live without it | Who | Blocks window |
|---|---|---|---|---|---|
| 1 | Brevo DNS on scoaladepatinaj.com (SPF include, DKIM, DMARC); mail-tester 9/10 or better | Deliverability of the registration e-mails with PDFs | E-mails land in spam; parents think the registration failed | Club (WordPress.com DNS) | Yes |
| 2 | Production Brevo key only in VM `.env.production`; test key deleted; Security > Authorized IPs on, VM address only (confirm with `curl ifconfig.me` on the VM) | Test key sends from codrin.space; leaked key sends as the club | No mail from the club address, or a live key unprotected | User (Brevo account) | Yes |
| 3 | Legal numbers in `src/club/documents/association.ts` (C.I.F., C.I.S., registry no., IBAN, branch) | Printed in the footer of every PDF | Wrong legal data on every document a parent signs | Club | Yes |
| 4 | WhatsApp channel link (Setări site > Contact) | Shown on the success screen and site | Link missing; no code change, enter it any time | Club | No |
| 5 | Avansați Gold prices (Prețuri) | Price list complete | "Preț incomplet" shown for that group | Club | No |
| 6 | Retention years: "Ani până la anonimizare" (default 5), confirmed with accountant or lawyer (`09-open-items.md`) | Drives the inactivity list in 3C | Default 5 stays; nothing is anonymized without a Super Admin action | Club | No |
| 7 | Rule for the proposed group of a child with no group (today: last season's main group) | New season preview proposals | Today's rule applies; the club fixes proposals by hand | Club, then a decision | No |
| 8 | Apps Script `doPost` (forwarding registrations to the owner's script) | Her script still gets nothing from the new form | Registrations reach the Sheet and admin only; her own Acord mail is not triggered | Club | No (later) |
| 9 | `REVALIDATE_FRONTEND_URL` / `REVALIDATE_SECRET` on the VM | Instant website refresh after admin saves | Website updates within 5 minutes | User (VM env) | No |

Blocking: rows 1, 2, 3. Everything else can follow after the window.

## 2. Before the window

All read-only or planning. Nothing here changes production.

1. Items 1 to 3 of section 1 confirmed by the club and the user.
2. Runbook 12 table "Before the window", items 1 to 13, checked read-only on the VM and prod DB:
   - 1 duplicate registration numbers: 0 rows (fatal otherwise, Strapi will not boot);
   - 2 `DOCUMENT_TOKEN_SECRET` 32+ chars; 3 `FRONTEND_ORIGIN` first entry the public site; 4 `CMS_PUBLIC_URL=https://cms.scoaladepatinaj.com`; 5 `PRIVATE_FILES_DIR` unset;
   - 6 Brevo vars (`BREVO_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO`); 7 `EMAIL_LIVE=true`, `EMAIL_TEST_RECIPIENT` empty on the VM;
   - 8 `SENTRY_DSN` and the GlitchTip alert "e-mail failed after 5 attempts"; 9 Brevo DNS (section 1);
   - 10 legal numbers (section 1); 11 frontend `NEXT_PUBLIC_STRAPI_URL` = public CMS address;
   - 12 season and number counts (`registration_submissions` by season, unnumbered count; note en-dash seasons), to compare with the copy script dry run;
   - 13 nginx `X-Real-IP`: `grep -n X-Real-IP /etc/nginx/sites-enabled/*`.
3. Runbook 14 step 0, on a production copy (never on production): restore last night's dump into a scratch Postgres, run the one-main-per-athlete SQL from runbook 14. Empty result required. Any row: stop, fix by hand on production (with the user's yes), repeat on a fresh copy.
4. A current Sezon is marked current in Sezoane (the groups script refuses without one).
5. Backups planned: database dump, uploads volume, private documents volume (`/opt/app/private/documents`), `scripts/backup.sh`. Space on the VM checked (`df -h`).
6. Merge `feat/athletes` into main in both repos (backend and frontend): only with the user's explicit yes, after the final reviews (4-6 final review and one fix round still open per HANDOFF). Never push without the user's yes.
7. Build checked on the exact commits to deploy: backend `npm test`, `npx tsc --noEmit`, `npx tsc --noEmit -p src/admin/tsconfig.json`, `node scripts/admin-ui-check.mjs --strict`, `npm run build`; frontend build and lint. The image build (`scripts/deploy.sh build`) must produce `dist/src/club/...` (the migrate scripts read it); confirm after the build with `EXEC ls dist/src/club/groups`.
8. Rehearsal on a throwaway database from a production copy (own Postgres and ports, never `strapi_app`, `strapi_db`, 1337, `edusport-test-pg`, 1340 or 3010), backend built from the exact commit, run in order:
   - `npm run migrate:registration`, then `-- --apply`, then dry run (all 0);
   - `npm run migrate:athletes -- --step=<step>` for each step of section 3.5, dry run, `--apply`, dry run (0);
   - `npm run migrate:groups -- --step=<step>` for steps 1 to 5, then step 6;
   - note the durations and every count; the real dry runs must match.
9. Window agreed with the user: day and time off-peak, not at :00 or :30 for the script steps; the club told in advance.

## 3. The window

Each step: ask the user, run, report the output, wait for the yes to go on.

1. Announce, then admin: switch "Înscrieri deschise" off (Setări site). Check nothing is mid-registration.
2. Fresh backups, kept on the VM: database dump (`scripts/backup.sh`, or the `pg_dump` line in `11-migration-runbook.md`), uploads, private PDFs. Confirm the files exist and are not empty. Keep the file names for rollback.
3. Merge `feat/athletes` into main in both repos if not done in section 2 (user's yes).
4. Deploy the backend, ref main: Actions "Deploy backend" (`deploy-pull`, `deploy-build`, `deploy-up`, `deploy-health`, per runbook 11). Strapi applies the schema of phases 2, 3 and 4 on this boot. Wait for `deploy-health`.
5. Restart check: logs show a clean boot (`docker compose -f docker-compose.production.yml logs --tail=200 backend`), volume writable:
   `docker compose -f docker-compose.production.yml exec backend sh -c 'touch /opt/app/private/documents/.w && rm /opt/app/private/documents/.w'`.
6. Phase 2 data: `EXEC npm run migrate:registration`; review as runbook 12 step 5 (tooltips, price notes, Școala public page, old custom questions, season check, duplicate price names, seasons to rewrite and numbers to assign against item 12 counts); show the user; `-- --apply`; dry run again (rewrite, assign, link all 0).
7. Phase 2 checks (admin): Sezoane 2026-2027 current, period Octombrie 2026 - Mai 2027, fee 270; Prețuri (Avansați Gold if the club sent it); Setări site WhatsApp link if sent; admin login works over HTTPS.
8. Phase 3 data, `EXEC npm run migrate:athletes -- --step=<step> [--apply]`, one step per run, in this order: `athlete-name`, `profile-athletes`, `past-registrations`, `match-backfill`, `duplicates`, `status`. For each: dry run, show the user, wait, `--apply`, dry run again (nothing left to do). Pipe each run through `tee` into a log file.
9. Phase 3 checks: Înscrieri and Sportivi lists open with the expected counts; a known athlete profile shows its history; a registration confirm and its Istoric line on a throwaway athlete, removed afterwards; Setări "Ani până la anonimizare" present.
10. Deploy the frontend, ref main (f2c4e0d or later contains 4-7): Actions "Deploy frontend". Until groups step 4 is applied, the website calendar falls back to the CMS series.
11. Phase 4 data, `EXEC npm run migrate:groups -- --step=<step> [--apply]`, `tee` each run, not at :00 or :30, waits and re-run rules as in runbook 14. Steps 1 to 5 in order: `group-names`, `coaches`, `program-public`, `school-series`, `link-events`. For each: dry run, show the user, wait, `--apply`, dry run again (0 items, "athletes breaking the one-main-per-season rule: 0"). If `school-series` stops midway, rerun it at once.
12. Phase 4 checks, 5 minutes after the last apply (runbook 14 "Checks"): Grupe sections, names, coaches, counts; each Școala group's Program tab; `/cursuri/program`; `/inscrieri` "Programul pe următoarea lună"; one Alocă plus "Anulează" on a throwaway athlete, Istoric shows both lines, remove it; GlitchTip clean.
13. Only after the user has checked step 12: `--step=retire-old-series` dry run (it must list exactly the series step `school-series` replaced and no Școala group lacks a new series), show the user, then `--apply`. Repeat the phase 4 checks.
14. Website checks (wait 5 minutes after the last apply): registration end to end with a child named "TEST": success screen shows the number and PDF links; PDFs open, one A4 page, ș ț right, legal footer right; Sheet row in the 2026-2027 tab with "Deschide documentul" and E-mail column; admin Înscrieri panel shows answers and e-mail status; an edited (expired) link lands on "Linkul a expirat"; `/`, `/cursuri`, `/inscrieri`, `/cursuri/program` render.
15. E-mail test: the single test address only (set `EMAIL_TEST_RECIPIENT` for the test only and clear it afterwards, or use the user's own address as the parent e-mail). Arrives, PDFs attached, singular or plural right, not in spam. Never send test mail to real parents.
16. Delete the TEST registration (its PDFs go too) and any test athlete. Switch "Înscrieri deschise" on. Tell the club the window is closed.

## 4. Rollback

Take the stage names from section 3. Restore from the step 2 backups only with the user's yes; a restore loses everything written after the backup, so check how many real registrations arrived first (the form is off during the window, so normally none).

| Stage | Rollback |
|---|---|
| 4 to 5 backend deploy or boot fails | Check duplicate numbers (item 1) and the logs; redeploy the previous ref (`git reset` to the earlier ref through "Deploy backend"). Restore the database only if data looks wrong |
| 6 `migrate:registration` | Idempotent: fix the cause, run again. Data wrong: restore database backup, redeploy previous backend and frontend |
| 8 `migrate:athletes` | Idempotent per step. Wrong data in a step: restore database backup (no per-step undo script), redeploy the previous backend |
| 10 frontend | Redeploy the previous frontend ref. The old form does not work with the new backend: keep "Înscrieri deschise" off until the backend is also rolled back |
| 11 `migrate:groups` steps 1 to 5 | Per runbook 14 table: rename groups back, remove added coaches, clear "Program public", delete new series, clear event group links, all from the `tee` apply logs |
| 13 `retire-old-series` | Not reversible by script: restore the database backup, or re-create the series from the dry run log. Restore means redeploy the previous backend image too |
| Anything doubtful that cannot be fixed by hand | Restore the step 2 database and uploads backups, redeploy the previous backend and frontend, tell the club the form stays closed; plan a new window |

## 5. After the window

Watch:

- GlitchTip: no new errors in the first hours and the next morning; the alert "e-mail failed after 5 attempts" is armed.
- E-mail jobs: first real registrations show "Trimis" in Înscrieri and the Sheet; a failed one after 5 attempts: fix the cause, "Retrimite e-mailul".
- Umami: traffic and the registration page funnel look normal, no drop on `/inscrieri` or `/cursuri/program`.
- Next morning: `backups/documents-*.tar.gz` exists next to the database dump.
- Hourly crons (parent schedule e-mails, Sheets sync): no errors; the Sheet moves en-dash season rows to the `2026-2027` tab, then delete the empty en-dash tab.

Can follow later: items 4 to 9 of section 1, the roadmap item "visual snapshots: review changed crops of /, /cursuri, /inscrieri, then re-record", removal of the local branches and worktrees, and the parked technical items in `HANDOFF.md`.

## 6. 6b deploy (admin login page, gate, 2FA)

Spec: `docs/superpowers/specs/2026-11-07-admin-auth-roles-design.md` 4.4 and 14.5. Write steps still run only with the user's yes, one by one.

1. Env in `.env.production` first: `AUTH_SECRET_KEY`, `AUTH_CODE_KEY`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGINS`, `ADMIN_HOST`, and the gate line below.
   Google sign-in for admins (spec 14.5 step 2): add `https://<ADMIN_HOST>/api/admin-auth/google/callback` to the authorized redirect URIs of the portal OAuth client, and confirm `PORTAL_GOOGLE_CLIENT_ID` and `PORTAL_GOOGLE_CLIENT_SECRET` are in `.env.production` (admin Google uses the portal client). Without either, "Continuă cu Google" always lands on `/login?eroare=google`. `ADMIN_HOST` must be exact (no scheme, no slash): a wrong or missing value makes every sign-in POST answer 403 with "Acțiunea nu a reușit. Nimic nu a fost salvat.".
2. Gate line, exact value: `ADMIN_GATE=off` (lowercase, no quotes, no spaces). Only the exact value `off` opens the gate; any other value, a typo or no line at all means on. This is the setting for the first deploy, so that the Super Admins can still sign in through Strapi until `/login` works for them.
3. While it is `off`, Strapi's own `/admin/login` issues password-only sessions: no 2FA, no lockout, and a password change through Strapi's profile page does not end other sessions. Production logs `[security] ADMIN_GATE=off in production` at every boot and sends one GlitchTip message, so the window cannot be forgotten. Keep it short.
4. Before the window opens: any existing Strapi admin API token is revoked (review B3 M4, ruling 2026-11-09: the gate answers 404 to `POST /admin/admin-tokens` and `/admin-tokens/:id/regenerate`, but a token minted earlier keeps working). In the admin: Settings, Administration Panel, API Tokens, delete every entry. Check afterwards that the list is empty. Note the gate only closes minting once it is on (step 7), so no new token may be created while `ADMIN_GATE=off`; recheck the list right after step 7. Also delete every Strapi data-transfer token (Settings, Transfer Tokens); remote transfer is switched off in `config/server.ts`, which applies after the restart in step 6.
   Note: "Elimină legătura" for Google is permanent in 6b (no relink action); to restore one, an operator clears `googleUnlinkedAt` on that admin's `admin_accounts` row.
5. Each non-super admin has an EduSport role (the bootstrap log lists the admins without one).
6. Deploy and restart the backend, and restart it a second time. New attributes on existing content types are silently dropped from saves until the container restarts: `portal-account` (`webauthnUserId`, unique; `lastMethod`; `passkeyOfferedAt`; `securityNotes`) and `portal-device` (`twoFactorUntil`, `confirmedAt`). The new types (`admin-account` with `googleUnlinkedAt`, `admin-device`, `auth-factor`, `auth-backup-code`, `auth-challenge`, `auth-passkey`) are created at boot. Check the boot log for the `ADMIN_GATE=off` warning, which is the expected one.
   Smoke check right after the restart: `GET https://<ADMIN_HOST>/login` answers 200 and one `/login/assets/*.js` file named in its html answers 200; a login POST from the page (a wrong password is enough) answers 401 with "E-mailul sau parola nu sunt corecte.", never 403 (a 403 means `ADMIN_HOST` is wrong).
7. Switch the gate on: after two Super Admins have signed in on `/login`, delete the `ADMIN_GATE=off` line from `.env.production` (or set `ADMIN_GATE=on`) and restart the backend. Check that the warning is gone from the boot log, that `POST /admin/login` answers 404 and that `/admin/auth/login` redirects to `/login`.
   Right after the restart, end every admin session once: `EXEC npm run admin:end-sessions` (the `backend` service). It prints `Sessions ended for <n> admins, 0 failed` and exits 0 (exit 1 if any admin failed; run it again). Sessions opened through Strapi's own login during the `off` window are password-only and would otherwise live up to 30 days without 2FA; every admin signs in again on `/login`. Recheck the API token list (step 4) at the same time.
8. Sessions opened through Strapi during the window have no device row and are ended by `admin:end-sessions` in step 7; the first `/login` login creates the row.
9. Server 2FA reset of an admin who lost every factor (spec 6.6): `EXEC npm run admin:reset-2fa -- <e-mail>` (the `backend` service, see the top of this file). It prints `2FA reset: <e-mail>` and exits 0, or prints `No admin: <e-mail>` and exits 1. It clears the methods, backup codes and remembered devices, ends every session, writes a history line with the actor `server` and mails the admin. Boot-checked on a throwaway Postgres (review B4 L6).
10. An admin invite expires after 7 days (spec 4.7). To resend one, delete the user in Settings, Users and invite again.
