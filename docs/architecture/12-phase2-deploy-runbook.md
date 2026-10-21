# 12. Phase 2 deploy runbook (registration rebuild)

Covers plans 2A-2F (backend `feat/registration-rebuild`) and 2C (frontend `feat/registration-rebuild`). Both repos go out in **one window**: the old form does not work with the new backend, and the new form does not work with the old backend. Production facts and the phase 1 steps are in `11-migration-runbook.md`.

## Before the window

| # | Item | Where | Fatal if missed |
|---|---|---|---|
| 1 | Duplicate registration numbers: `select registration_number, count(*) from registration_submissions where registration_number is not null group by 1 having count(*) > 1;` must return 0 rows | prod DB, read-only | yes: Strapi does not boot on the new unique index |
| 2 | `DOCUMENT_TOKEN_SECRET`, 32+ characters (`openssl rand -base64 48`) | VM `.env.production` | yes: every submit answers 503 |
| 3 | `FRONTEND_ORIGIN`: its first entry is the public site (`https://scoaladepatinaj.com`) | VM `.env.production` | expired links answer 410 instead of the website page; e-mail links wrong |
| 4 | `CMS_PUBLIC_URL=https://cms.scoaladepatinaj.com` | VM `.env.production` | Sheet Document links empty; e-mail header falls back to text |
| 5 | `PRIVATE_FILES_DIR` left unset (default `/opt/app/private/documents` is the volume) | VM `.env.production` | |
| 6 | Brevo: `BREVO_API_KEY`, `EMAIL_FROM_ADDRESS` (verified in Brevo), `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO` | VM `.env.production` | no e-mails (jobs wait in the queue, nothing lost) |
| 7 | `EMAIL_LIVE=true` on the VM only; `EMAIL_TEST_RECIPIENT` empty in production, set locally | VM / local `.env` | |
| 8 | `SENTRY_DSN` and a GlitchTip alert rule for "e-mail failed after 5 attempts" | VM, GlitchTip | no alert on stuck e-mails |
| 9 | Brevo DNS on the club domain (SPF include, DKIM, DMARC); mail-tester 9/10 or better from a test sender | club DNS (WordPress.com) | e-mails land in spam |
| 10 | The club confirms the legal numbers in `src/club/documents/association.ts` (C.I.F., C.I.S., registry no., IBAN, bank branch) | club | wrong data printed on every PDF |
| 11 | Frontend `NEXT_PUBLIC_STRAPI_URL` = the public CMS address | frontend env | submit and PDF links fail |

## In the window

1. Admin: switch **"Înscrieri deschise" off** (Setări site).
2. Backup: database and uploads (`scripts/backup.sh`, or the dump step in `11-migration-runbook.md`). Keep it on the VM.
3. Deploy the backend (Actions, "Deploy backend", ref `feat/registration-rebuild` or `main` after merge). The new container restarts Strapi, which applies the schema (new fields, unique index, `email-job`, private documents volume).
4. Check the volume is writable: `docker compose -f docker-compose.production.yml exec backend sh -c 'touch /opt/app/private/documents/.w && rm /opt/app/private/documents/.w'`.
5. Copy script, dry run: `docker compose -f docker-compose.production.yml --env-file .env.production exec backend npm run migrate:registration`. Review it: tooltips copied, price notes, Școala public page on, old custom questions removed, season check, duplicate price names.
6. Copy script, apply: the same with `-- --apply`. Run the dry run again: nothing left to do.
7. Admin checks:
   - Sezoane: 2026-2027 current, period Octombrie 2026 - Mai 2027, fee 270.
   - Prețuri: enter the real **Avansați Gold** prices; no "Preț incomplet" left that should not be there.
   - Setări site > Contact: **WhatsApp channel link** entered.
8. Deploy the frontend (ref `feat/registration-rebuild` or `main` after merge).
9. Test registration, marked "TEST" in the child's name:
   - success screen shows the number and the PDF links;
   - PDFs open, one A4 page, ș ț correct, legal footer correct;
   - e-mail arrives, with PDFs attached, singular or plural right;
   - Sheet: 2026-2027 tab has the row, short titles, "Deschide documentul" link, E-mail column;
   - admin Înscrieri: panel shows the answers, e-mail status, "Retrimite e-mailul";
   - an expired link (edit the token) lands on "Linkul a expirat".
10. Delete the TEST registration (its PDFs go too). Switch **"Înscrieri deschise" on**.

## After

- Next morning: `backups/documents-*.tar.gz` exists next to the database dump.
- The first real registrations: e-mail status "Trimis" in Înscrieri and in the Sheet.
- If an e-mail fails 5 times: GlitchTip alert, fix the cause, "Retrimite e-mailul".

## Recovery

- Backend fails to boot after deploy: check item 1 (duplicate numbers) and the logs; redeploy the previous ref, restore the backup only if data looks wrong.
- Submits answer 503: `DOCUMENT_TOKEN_SECRET` missing (item 2).
- Copy script stops: fix the cause, run it again (idempotent).
