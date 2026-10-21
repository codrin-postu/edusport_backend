# Phase 2F: Registration E-mail via Brevo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After every online registration, e-mail the family the E1 letter with the stored PDFs attached, through Brevo, from a database queue that retries hourly, alerts GlitchTip after 5 failed attempts, never loses a message when Brevo is not configured, and never reaches a real parent outside production; plus admin routes for the e-mail status and "Retrimite e-mailul".

**Architecture:** A new private content type `email-job` is the queue. The rules live in `src/email/` as small modules with Vitest tests: settings and the delivery gate (`config.ts`), the Brevo HTTPS call with Node's `fetch` (`brevo.ts`), the job state machine (`job-state.ts`), the E1 template (`registration-template.ts`, `links.ts`) and the flow (`email-jobs.ts`), which takes every Strapi, file and network call through an injected `EmailDeps`, so it is unit tested with fakes. `strapi-email.ts` is the only Strapi wiring; it exports the contract function `enqueueRegistrationEmail(strapi, registrationDocumentId)`, which the submit flow calls once the documents are built. The first attempt runs right after the submit response is decided (deferred with `setImmediate`, so the parent never waits for Brevo); the hourly cron in `config/cron-tasks.ts` retries.

**Tech Stack:** Strapi 5.52.1 (TypeScript, CommonJS, `strict: false`), Postgres in production, Vitest 3, Node 22 (built-in `fetch`, `AbortSignal.timeout`), `@sentry/node` 10 (GlitchTip), Brevo transactional API v3, Pillow (one-off header image render).

**Validated:** the code in this plan was applied on 2026-10-21 to a scratch copy of the repo with plan 2A applied, plan 2D's interface simulated (`SubmitResult` with `documentId`, `submitPublic` keeping `saved` and calling `finishSubmit`, `listRegistrationDocuments` returning one stored file, the fonts in `assets/fonts` fetched with 2D's pinned URLs and matching its SHA-256 sums) and plan 2E's `cmsPublicUrl` copied: Vitest 267 tests passed, `tsc --noEmit` zero errors after type generation. The Task 10 boot check ran on a throwaway Postgres (container removed): `/email/edusport-header.png` answered 200 `image/png`; a public submit created a `queued` job with 0 attempts (no key); the admin routes answered 403 without a token, 404 for an unknown registration, and with an admin token returned the status and logged the `email-resent` history entry; with a bogus Brevo key the deferred first attempt and the resend each recorded `Brevo 401: {"message":"Key not found","code":"unauthorized"}`; the cron task moved jobs from 1 to 2 attempts, skipped jobs touched within 5 minutes, and at the fifth failure marked them `failed` and logged the alert. The rendered HTML was screenshot at 760 px and 375 px and matches the E1 mockup (buttons side by side on desktop, stacked full width on the phone).

**Spec:** `docs/superpowers/specs/2026-10-19-registration-rebuild-design.md`, section 4.2 (and 3.4, 4.1 for the document wording). Decisions log: `../edusport_frontend/docs/portal/DECISIONS.md` (2026-10-03 Brevo, 2026-10-05 E1 and copy, 2026-10-05 "editing never sends an e-mail"); a dated decision wins over the spec. Approved design: `../edusport_frontend/docs/portal/mockups/screens/email-e-v2.html` option E1, generator `mockups/gen_email3.py` (on top of `gen_email2.py`, `gen_email.py`). Plan 2A (merged before this plan): `docs/superpowers/plans/2026-10-19-phase2a-registration-data.md`. Plan 2D (merged before this plan, wave 2) provides `src/club/documents/` (index.ts), the fonts in `assets/fonts/` and the `saved` / `finishSubmit` shape of `submitPublic`: `docs/superpowers/plans/2026-10-20-phase2d-documents.md`. Plan 2E (merged before this plan) provides the env `CMS_PUBLIC_URL` and `cmsPublicUrl()` in `src/sheets/admin-link.ts`: `docs/superpowers/plans/2026-10-20-phase2e-sheet.md`.

**Rulings applied (coordinator and user, 2026-10-21):** F1 real parents only with `NODE_ENV=production` AND `EMAIL_LIVE=true`; F2 one document makes the whole step singular; F3 missing PDFs count as a failed attempt; F4 the header PNG uses 2D's bundled Inter and Climate Crisis; F5 the sign-off "Cu drag, Echipa Școlii de Patinaj EduSport" stays; the header image address is built from `CMS_PUBLIC_URL`; the WhatsApp button reads `site-settings.contact.whatsappChannelUrl` and is hidden when empty; the e-mail is queued in `submitPublic` right after `finishSubmit`.

**Choices made in this plan (read before executing):**
- **Brevo through `fetch`, no SDK.** One endpoint (`POST https://api.brevo.com/v3/smtp/email`) and one JSON body. The SDK would add a dependency tree to a server that was compromised once (2026-09-16 notes in `docker-compose.production.yml`), and its API was rewritten between major versions. `fetch` is built into Node 22, typed by `@types/node` 20, and trivially faked in tests (Task 2).
- **Header image: hosted PNG, not an inline CID image.** The mockup draws CLUBUL SPORTIV / EDUSPORT with web fonts (League Spartan, Climate Crisis), which mail clients do not load, and the decision says "(image)". Brevo's attachment object has only `url`, `content` and `name` (no Content-ID), so an inline CID image is not possible through the API; it would also show as an extra attachment in several clients. The PNG is rendered once from the fonts plan 2D bundles (`assets/fonts/Inter-Bold.ttf` for CLUBUL SPORTIV, `assets/fonts/ClimateCrisis-Variable.ttf` at axis Year 1979, the cut the website uses, for EDUSPORT), committed to `public/email/edusport-header.png` and served by Strapi's `strapi::public` middleware at `<CMS_PUBLIC_URL>/email/edusport-header.png` (in production `https://cms.scoaladepatinaj.com/email/edusport-header.png`). Without `CMS_PUBLIC_URL` the header is rendered as text in the same two lines. Strapi's security middleware leaves `crossOriginResourcePolicy` off, so clients may load it. `alt="Clubul Sportiv EduSport"` covers clients that block images.
- **"Production" means `NODE_ENV=production` AND `EMAIL_LIVE=true`.** `Dockerfile.production` bakes `ENV NODE_ENV=production` into the image, so any local run of the production image against a copy of the production database would otherwise e-mail real parents. `EMAIL_LIVE=true` is set only in the VM's `.env.production`. Everywhere else every e-mail goes to `EMAIL_TEST_RECIPIENT`; with no test address set, jobs wait in the queue (ruling F1).
- **Footer contact and the WhatsApp link come from Setări site > Contact** (`site-settings.contact`: `phone`, `email`, `facebookUrl1`, `whatsappChannelUrl`), the same values the website footer and the form's success screen (plan 2C) show; the program and privacy links are `EMAIL_SITE_URL` + `/cursuri/program` and `/protectia-datelor`. With no WhatsApp link set, the "Canalul WhatsApp" button is left out.
- **Copy deviations from the mockup:** the mockup footer joins facts with "·"; the copy rules forbid the middle dot, so the footer uses commas and line breaks. The mockup has only the plural; the singular (only the Acord attached) follows DECISIONS 2026-10-05 ("Documentul va fi semnat ...") and, per the user (F2), makes the whole step singular: title "Aduceți documentul", text "Tipăriți documentul atașat și aduceți-l la prima ședință. Documentul va fi semnat la prima ședință de curs." The sign-off "Cu drag, Echipa Școlii de Patinaj EduSport" stays (F5).
- **Missing documents count as a failed attempt (ruling F3).** If 2D's build failed, the job retries hourly (the admin may rebuild meanwhile) and alerts after 5 attempts instead of sending a letter that says "Am atașat ..." with nothing attached.
- **A resend reuses a still-queued job** (fresh address and subject, counter reset to 0) instead of adding a second one, so a parent never gets two copies when Brevo comes back. Otherwise a resend creates a new job; old jobs stay as the record.
- **No personal data in alerts.** The GlitchTip message names the job's `documentId` and the error only.

## Global Constraints

- Backend repo `/Users/codrin/Documents/Programming/edusport_backend`, branch `feat/registration-rebuild`. Strapi 5, TypeScript in `src/`, single quotes in `src/` (match the surrounding code).
- Functions < 30 lines; cyclomatic complexity < 10; no `any` (for Strapi UIDs use `UID.ContentType` or a literal UID `as const`; for the Strapi instance `Core.Strapi`).
- Tests: `npm test` (Vitest) and `npx tsc --noEmit` with zero errors, after every task.
- New content types keep `pluginOptions.content-manager.visible: false` and `createCoreRouter(..., { only: [] })`. Admin routes use the `global::is-admin` policy (`{ auth: false, policies: ['global::is-admin'], middlewares: [] }`).
- Copy rules for user-visible text: no em dash "—", no middle dot "·", no emoji; terse; no rounded shapes, no dashed or dotted lines; UI and e-mail copy in Romanian, code and docs in English; never pad the client's wording. Romanian ș and ț use the comma below, never the cedilla.
- Commits: Conventional Commits, no AI attribution, no `Co-Authored-By`. Never push. Never run anything against production; never e-mail a real address from local or test (use `EMAIL_TEST_RECIPIENT` and `example.invalid` addresses).
- Boot checks use a throwaway Postgres container on a free port (this plan: 55436, Strapi on 1342; 1337 is taken), never the user's local DB (container `strapi_db`) or the running `strapi_app`; remove the container afterwards. A schema change needs a Strapi restart.
- After schema changes run `DATABASE_CLIENT=postgres npx strapi ts:generate-types` and commit `types/generated/` in the same task (type generation reads the schemas only; it does not connect to the database).
- Data shapes passed to Strapi JSON attributes are `type` aliases, never `interface`.
- Editing a registration never sends an e-mail (DECISIONS 2026-10-05); that path belongs to plan 2D, and this plan adds nothing to it (Task 9 pins it with a test).

## Review Focus

- **Two attempts on one job at once** (the deferred first attempt still running when the hourly cron fires, or a resend while the cron runs): the parent must not get two e-mails. The cron only takes queued jobs untouched for 5 minutes (`QUIET_MS`); a resend reuses a queued job. Tests: Task 3 `isDue`, Task 6 "does not retry a job touched less than QUIET_MS ago" and "reuses a job that is still queued".
- **Brevo key missing, wrong or revoked:** missing means the job waits with its counter unchanged and is sent once a key is set; wrong (401) counts as a failed attempt, so a bad key ends in `failed` plus an alert within 5 hours instead of silence. Tests: Task 6 "no Brevo key" (both cases) and "retries hourly and fails with one alert after 5 attempts"; Task 10 observes the real 401.
- **A parent's input in the e-mail:** the child's name is HTML-escaped and collapsed to one line in the subject (a name with `<`, quotes or a newline). Test: Task 4 "escapes what the parent typed" and the subject test.
- **Registration without documents or deleted before sending:** no documents is a failed attempt (alert after 5, the admin can rebuild and resend; a resend is refused with "Înscrierea nu are documente."); a deleted registration fails its job at once without an alert. Tests: Task 6 "counts missing documents as a failed attempt", "fails a job whose registration was deleted", "refuses an unknown registration and one without documents".
- **Queueing the e-mail fails (database error) during a submit:** the parent still gets `{ ok: true, registrationNumber }`, the error is logged, and the admin can resend. Test: Task 9 "never throws when queueing fails, and logs it".

---

## File Structure

```
src/email/
  config.ts                    env settings, blockedReason, deliveryTarget (test-recipient override)   (Task 1)
  brevo.ts                     brevoBody, sendWithBrevo (fetch, 20 s timeout)                          (Task 2)
  job-state.ts                 MAX_ATTEMPTS, nextJobState, isDue                                        (Task 3)
  registration-template.ts     E1 HTML + plain text, subject, singular/plural, escaping                 (Task 4)
  links.ts                     buildEmailLinks(config, site-settings.contact)                           (Task 4)
  email-jobs.ts                EmailDeps, queue/attempt/retry/resend/status flow                        (Task 6)
  strapi-email.ts              buildEmailDeps(strapi), enqueueRegistrationEmail, retryRegistrationEmails (Task 7)
  __tests__/*.test.ts
src/api/email-job/             content type (hidden, only: []), service, controller, admin routes      (Tasks 5, 8)
src/utils/admin-actor.ts       actingAdminEmail(strapi, authorization) for history entries              (Task 8)
src/sentry.ts                  + captureMessage                                                          (Task 7)
config/cron-tasks.ts           + registrationEmailRetry (hourly, minute 30)                              (Task 7)
src/email/after-submit.ts      queueEmailAfterSubmit(saved, enqueue, logError)                           (Task 9)
src/api/registration-submission/controllers/registration-submission.ts   submitPublic: queue after finishSubmit (Task 9)
scripts/render-email-header.py, public/email/edusport-header.png                  header image           (Task 4)
.env.example, docker-compose.yml                                                    e-mail env vars       (Task 1)
```

## Tasks and parallel groups

| Group | Tasks | Runs after |
|---|---|---|
| A | 1 Settings and delivery gate, 2 Brevo client, 3 Job state machine, 4 E1 template and header image, 5 `email-job` content type | 2A, 2D and 2E merged; all five in parallel (separate files; Task 5 alone regenerates types) |
| B | 6 Job flow | group A |
| C | 7 Strapi wiring, GlitchTip alert, hourly cron | group B |
| D | 8 Admin routes, 9 Submit flow hook | group C; both in parallel (separate files) |
| E | 10 Boot check on a throwaway Postgres | everything |

Not code (needs the club): "Deliverability checklist" at the end.

---
### Task 1: Settings and delivery gate

**Files:**
- Create: `src/email/config.ts`
- Test: `src/email/__tests__/config.test.ts`
- Modify: `.env.example` (append a section), `docker-compose.yml` (strapi `environment`, after `SHEETS_TAB_NAME`)

**Interfaces:**
- Consumes: plan 2E `cmsPublicUrl(env?: NodeJS.ProcessEnv): string` from `src/sheets/admin-link.ts` (the CMS origin from `CMS_PUBLIC_URL`, no trailing slash, `''` when unset).
- Produces:
  - `type Sender = { email: string; name: string }`
  - `type EmailConfig = { apiKey: string | null; live: boolean; testRecipient: string | null; sender: Sender | null; replyTo: string | null; siteUrl: string; headerImageUrl: string | null }`
  - `type BlockedReason = 'no-key' | 'no-sender' | 'no-test-recipient'`
  - `type Delivery = { ok: true; to: string } | { ok: false; reason: BlockedReason }`
  - `readEmailConfig(env?: NodeJS.ProcessEnv): EmailConfig` (defaults to `process.env`)
  - `blockedReason(config: EmailConfig): BlockedReason | null`
  - `deliveryTarget(config: EmailConfig, recipient: string): Delivery`
  - constants `DEFAULT_SENDER_NAME`, `DEFAULT_SITE_URL`, `HEADER_IMAGE_PATH = '/email/edusport-header.png'`
- Env vars: `BREVO_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO`, `EMAIL_LIVE`, `EMAIL_TEST_RECIPIENT`, `EMAIL_SITE_URL`; reads 2E's `CMS_PUBLIC_URL` (not redefined here).

- [ ] **Step 1: Write the failing test**

`src/email/__tests__/config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_SENDER_NAME, blockedReason, deliveryTarget, readEmailConfig } from '../config';

const BASE = {
  BREVO_API_KEY: 'xkeysib-test',
  EMAIL_FROM_ADDRESS: 'inscrieri@scoaladepatinaj.com',
  EMAIL_TEST_RECIPIENT: 'test@codrin.space',
};

describe('readEmailConfig', () => {
  it('reads the sender, defaults and trims', () => {
    const c = readEmailConfig({ ...BASE, EMAIL_SITE_URL: ' https://example.ro/ ' });
    expect(c.sender).toEqual({ email: 'inscrieri@scoaladepatinaj.com', name: DEFAULT_SENDER_NAME });
    expect(c.siteUrl).toBe('https://example.ro');
    expect(c.replyTo).toBeNull();
  });

  it('serves the header image from CMS_PUBLIC_URL, or none without it', () => {
    expect(readEmailConfig({ ...BASE, CMS_PUBLIC_URL: 'https://cms.scoaladepatinaj.com/' }).headerImageUrl).toBe(
      'https://cms.scoaladepatinaj.com/email/edusport-header.png',
    );
    expect(readEmailConfig(BASE).headerImageUrl).toBeNull();
  });

  it('is live only in production with EMAIL_LIVE=true', () => {
    expect(readEmailConfig({ ...BASE, NODE_ENV: 'production', EMAIL_LIVE: 'true' }).live).toBe(true);
    expect(readEmailConfig({ ...BASE, NODE_ENV: 'production' }).live).toBe(false);
    expect(readEmailConfig({ ...BASE, NODE_ENV: 'development', EMAIL_LIVE: 'true' }).live).toBe(false);
    expect(readEmailConfig({ ...BASE, NODE_ENV: 'test', EMAIL_LIVE: 'true' }).live).toBe(false);
  });
});

describe('deliveryTarget', () => {
  it('sends to the parent only when live', () => {
    const live = readEmailConfig({ ...BASE, NODE_ENV: 'production', EMAIL_LIVE: 'true' });
    expect(deliveryTarget(live, 'parinte@example.ro')).toEqual({ ok: true, to: 'parinte@example.ro' });
  });

  it('replaces every recipient with the test address outside production', () => {
    const local = readEmailConfig({ ...BASE, NODE_ENV: 'development' });
    expect(deliveryTarget(local, 'parinte@example.ro')).toEqual({ ok: true, to: 'test@codrin.space' });
    const prodNotLive = readEmailConfig({ ...BASE, NODE_ENV: 'production' });
    expect(deliveryTarget(prodNotLive, 'parinte@example.ro')).toEqual({ ok: true, to: 'test@codrin.space' });
  });

  it('cannot send without a key, a sender, or (outside production) a test address', () => {
    expect(deliveryTarget(readEmailConfig({ ...BASE, BREVO_API_KEY: '' }), 'p@example.ro')).toEqual({ ok: false, reason: 'no-key' });
    expect(deliveryTarget(readEmailConfig({ ...BASE, EMAIL_FROM_ADDRESS: ' ' }), 'p@example.ro')).toEqual({ ok: false, reason: 'no-sender' });
    expect(deliveryTarget(readEmailConfig({ ...BASE, EMAIL_TEST_RECIPIENT: undefined }), 'p@example.ro')).toEqual({ ok: false, reason: 'no-test-recipient' });
  });
});

describe('blockedReason', () => {
  it('is null when e-mail can go out', () => {
    expect(blockedReason(readEmailConfig(BASE))).toBeNull();
    expect(blockedReason(readEmailConfig({ ...BASE, EMAIL_TEST_RECIPIENT: '', NODE_ENV: 'production', EMAIL_LIVE: 'true' }))).toBeNull();
  });
  it('names the first missing setting', () => {
    expect(blockedReason(readEmailConfig({}))).toBe('no-key');
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npm test -- src/email/__tests__/config.test.ts`
Expected: FAIL (cannot find module `../config`).

- [ ] **Step 3: Implement the settings**

`src/email/config.ts`:

```ts
import { cmsPublicUrl } from '../sheets/admin-link';

/**
 * E-mail settings, read from the environment (see .env.example, "E-mail (Brevo)").
 * The header image is served by this CMS at CMS_PUBLIC_URL + HEADER_IMAGE_PATH (CMS_PUBLIC_URL is
 * shared with the Sheet links, plan 2E); without CMS_PUBLIC_URL the header falls back to text.
 *
 * Real recipients only in production with EMAIL_LIVE=true. Everywhere else every e-mail
 * goes to EMAIL_TEST_RECIPIENT, so a local or test run never reaches a parent, even with
 * a copy of the production database and a real Brevo key.
 */
export type Sender = { email: string; name: string };

export type EmailConfig = {
  apiKey: string | null;
  live: boolean;
  testRecipient: string | null;
  sender: Sender | null;
  replyTo: string | null;
  siteUrl: string;
  headerImageUrl: string | null;
};

export type BlockedReason = 'no-key' | 'no-sender' | 'no-test-recipient';
export type Delivery = { ok: true; to: string } | { ok: false; reason: BlockedReason };

export const DEFAULT_SENDER_NAME = 'Școala de Patinaj EduSport';
export const DEFAULT_SITE_URL = 'https://scoaladepatinaj.com';
export const HEADER_IMAGE_PATH = '/email/edusport-header.png';

const clean = (v: string | undefined): string | null => (v && v.trim() ? v.trim() : null);
const noTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

export function readEmailConfig(env: NodeJS.ProcessEnv = process.env): EmailConfig {
  const from = clean(env.EMAIL_FROM_ADDRESS);
  const cms = cmsPublicUrl(env);
  return {
    apiKey: clean(env.BREVO_API_KEY),
    live: env.NODE_ENV === 'production' && env.EMAIL_LIVE === 'true',
    testRecipient: clean(env.EMAIL_TEST_RECIPIENT),
    sender: from ? { email: from, name: clean(env.EMAIL_FROM_NAME) ?? DEFAULT_SENDER_NAME } : null,
    replyTo: clean(env.EMAIL_REPLY_TO),
    siteUrl: noTrailingSlash(clean(env.EMAIL_SITE_URL) ?? DEFAULT_SITE_URL),
    headerImageUrl: cms ? `${cms}${HEADER_IMAGE_PATH}` : null,
  };
}

/** Why no e-mail can be sent from this server right now, or null when it can. */
export function blockedReason(config: EmailConfig): BlockedReason | null {
  if (!config.apiKey) return 'no-key';
  if (!config.sender) return 'no-sender';
  if (!config.live && !config.testRecipient) return 'no-test-recipient';
  return null;
}

/** Where an e-mail for `recipient` really goes, or why it cannot be sent now (the job then stays queued). */
export function deliveryTarget(config: EmailConfig, recipient: string): Delivery {
  const reason = blockedReason(config);
  if (reason) return { ok: false, reason };
  if (config.live) return { ok: true, to: recipient };
  return { ok: true, to: config.testRecipient ?? '' }; // never the parent: blockedReason guarantees a test address
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npm test -- src/email/__tests__/config.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Document the variables**

Append to `.env.example`:

```bash

# ----- E-mail (Brevo): registration e-mail, src/email/ -----
# Transactional API key (Brevo > SMTP & API > API keys). Unset: e-mails wait in
# the queue (email-job, status queued) and go out once a key is set. Nothing is lost.
BREVO_API_KEY=
# Sender: an address Brevo has verified, on a domain with Brevo SPF and DKIM.
EMAIL_FROM_ADDRESS=
EMAIL_FROM_NAME=Școala de Patinaj EduSport
# Optional reply-to, e.g. the club's inbox.
EMAIL_REPLY_TO=
# Real parents are e-mailed ONLY when NODE_ENV=production AND EMAIL_LIVE=true.
# Set EMAIL_LIVE=true in the VM's .env.production and nowhere else. Everywhere
# else every e-mail goes to EMAIL_TEST_RECIPIENT; without it, e-mails wait.
EMAIL_LIVE=
EMAIL_TEST_RECIPIENT=
# Website base for "Vezi programul" (/cursuri/program) and the privacy link.
EMAIL_SITE_URL=https://scoaladepatinaj.com
# The header image is CMS_PUBLIC_URL + /email/edusport-header.png (CMS_PUBLIC_URL
# is defined above for the Sheet links); unset, the e-mail header is plain text.
```

In `docker-compose.yml`, in the `strapi` service `environment`, directly under `SHEETS_TAB_NAME: ${SHEETS_TAB_NAME:-}`, add (no `EMAIL_LIVE`: local runs never e-mail parents):

```yaml
      # Registration e-mail (Brevo). Without EMAIL_LIVE every e-mail goes to
      # EMAIL_TEST_RECIPIENT, so a local run never reaches a parent.
      BREVO_API_KEY: ${BREVO_API_KEY:-}
      EMAIL_FROM_ADDRESS: ${EMAIL_FROM_ADDRESS:-}
      EMAIL_FROM_NAME: ${EMAIL_FROM_NAME:-}
      EMAIL_REPLY_TO: ${EMAIL_REPLY_TO:-}
      EMAIL_TEST_RECIPIENT: ${EMAIL_TEST_RECIPIENT:-}
```

- [ ] **Step 6: Type-check and run everything**

Run: `npx tsc --noEmit` (expected: zero errors) and `npm test` (expected: all PASS).

- [ ] **Step 7: Commit**

```bash
git add src/email/config.ts src/email/__tests__/config.test.ts .env.example docker-compose.yml
git commit -m "feat(email): e-mail settings and test-recipient gate"
```

---

### Task 2: Brevo client

**Files:**
- Create: `src/email/brevo.ts`
- Test: `src/email/__tests__/brevo.test.ts`

**Interfaces:**
- Consumes: Task 1 `Sender` (type only).
- Produces:
  - `BREVO_URL = 'https://api.brevo.com/v3/smtp/email'`
  - `type Attachment = { name: string; content: string }` (content is base64)
  - `type OutgoingEmail = { to: string; subject: string; html: string; text: string; attachments: Attachment[] }`
  - `type SendResult = { ok: true; messageId: string | null } | { ok: false; error: string }`
  - `type BrevoOptions = { apiKey: string; sender: Sender; replyTo: string | null; fetchFn?: typeof fetch }`
  - `brevoBody(message, sender, replyTo)` and `sendWithBrevo(message: OutgoingEmail, options: BrevoOptions): Promise<SendResult>` (never throws; errors are cut to 500 characters)

Brevo request (checked against the Brevo API reference on 2026-10-20): header `api-key`, JSON body `sender`, `to[]`, `subject`, `htmlContent`, `textContent`, optional `replyTo`, `attachment[]` of `{ name, content }` (base64; `.pdf` is an allowed extension); success is 201 with `{ messageId }`.

- [ ] **Step 1: Write the failing test**

`src/email/__tests__/brevo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BREVO_URL, brevoBody, sendWithBrevo, type OutgoingEmail } from '../brevo';

const MESSAGE: OutgoingEmail = {
  to: 'test@codrin.space',
  subject: 'Înscriere înregistrată: Maria Pop (nr. 2026-0008)',
  html: '<p>html</p>',
  text: 'text',
  attachments: [{ name: 'Maria_Pop_Acord_2026-2027.pdf', content: 'JVBERi0=' }],
};
const SENDER = { email: 'inscrieri@scoaladepatinaj.com', name: 'Școala de Patinaj EduSport' };

type Call = { url: string; init: RequestInit };

function fakeFetch(response: Response | Error) {
  const calls: Call[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (response instanceof Error) throw response;
    return response;
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe('brevoBody', () => {
  it('maps the message to the Brevo JSON body', () => {
    expect(brevoBody(MESSAGE, SENDER, 'edusporttrophy@gmail.com')).toEqual({
      sender: SENDER,
      to: [{ email: 'test@codrin.space' }],
      subject: MESSAGE.subject,
      htmlContent: '<p>html</p>',
      textContent: 'text',
      attachment: MESSAGE.attachments,
      replyTo: { email: 'edusporttrophy@gmail.com' },
    });
  });

  it('leaves out an empty attachment list and a missing reply-to', () => {
    const body = brevoBody({ ...MESSAGE, attachments: [] }, SENDER, null);
    expect(body).not.toHaveProperty('attachment');
    expect(body).not.toHaveProperty('replyTo');
  });
});

describe('sendWithBrevo', () => {
  it('posts with the api-key header and returns the message id', async () => {
    const { fn, calls } = fakeFetch(new Response(JSON.stringify({ messageId: '<id@relay>' }), { status: 201 }));
    await expect(sendWithBrevo(MESSAGE, { apiKey: 'k', sender: SENDER, replyTo: null, fetchFn: fn })).resolves.toEqual({ ok: true, messageId: '<id@relay>' });
    expect(calls[0].url).toBe(BREVO_URL);
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>)['api-key']).toBe('k');
    expect(JSON.parse(String(calls[0].init.body)).subject).toBe(MESSAGE.subject);
  });

  it('reports a non-2xx answer with its status and body', async () => {
    const { fn } = fakeFetch(new Response('{"code":"unauthorized","message":"Key not found"}', { status: 401 }));
    const result = await sendWithBrevo(MESSAGE, { apiKey: 'bad', sender: SENDER, replyTo: null, fetchFn: fn });
    expect(result).toEqual({ ok: false, error: 'Brevo 401: {"code":"unauthorized","message":"Key not found"}' });
  });

  it('reports a network failure instead of throwing', async () => {
    const { fn } = fakeFetch(new Error('getaddrinfo ENOTFOUND api.brevo.com'));
    const result = await sendWithBrevo(MESSAGE, { apiKey: 'k', sender: SENDER, replyTo: null, fetchFn: fn });
    expect(result).toEqual({ ok: false, error: 'Brevo request failed: getaddrinfo ENOTFOUND api.brevo.com' });
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npm test -- src/email/__tests__/brevo.test.ts`
Expected: FAIL (cannot find module `../brevo`).

- [ ] **Step 3: Implement the client**

`src/email/brevo.ts`:

```ts
/**
 * Brevo transactional e-mail over HTTPS (POST https://api.brevo.com/v3/smtp/email), with
 * Node's built-in fetch. One endpoint and one JSON body do not justify the SDK and its
 * dependency tree; a plain fetch is also trivial to fake in tests.
 */
import type { Sender } from './config';

export const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 20_000;
const MAX_ERROR = 500;

export type Attachment = { name: string; content: string };
export type OutgoingEmail = { to: string; subject: string; html: string; text: string; attachments: Attachment[] };
export type SendResult = { ok: true; messageId: string | null } | { ok: false; error: string };
export type BrevoOptions = { apiKey: string; sender: Sender; replyTo: string | null; fetchFn?: typeof fetch };

type BrevoBody = {
  sender: Sender;
  to: { email: string }[];
  subject: string;
  htmlContent: string;
  textContent: string;
  attachment?: Attachment[];
  replyTo?: { email: string };
};

export function brevoBody(message: OutgoingEmail, sender: Sender, replyTo: string | null): BrevoBody {
  const body: BrevoBody = {
    sender,
    to: [{ email: message.to }],
    subject: message.subject,
    htmlContent: message.html,
    textContent: message.text,
  };
  if (message.attachments.length) body.attachment = message.attachments;
  if (replyTo) body.replyTo = { email: replyTo };
  return body;
}

async function readError(res: Response): Promise<string> {
  const raw = await res.text().catch(() => '');
  return `Brevo ${res.status}: ${raw.trim()}`.slice(0, MAX_ERROR);
}

export async function sendWithBrevo(message: OutgoingEmail, options: BrevoOptions): Promise<SendResult> {
  const fetchFn = options.fetchFn ?? fetch;
  try {
    const res = await fetchFn(BREVO_URL, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', 'api-key': options.apiKey },
      body: JSON.stringify(brevoBody(message, options.sender, options.replyTo)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, error: await readError(res) };
    const json = (await res.json().catch(() => ({}))) as { messageId?: unknown };
    return { ok: true, messageId: typeof json.messageId === 'string' ? json.messageId : null };
  } catch (err) {
    return { ok: false, error: `Brevo request failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, MAX_ERROR) };
  }
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npm test -- src/email/__tests__/brevo.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Type-check and run everything**

Run: `npx tsc --noEmit` (zero errors; `fetch`, `Response` and `AbortSignal.timeout` come from `@types/node` 20) and `npm test` (all PASS).

- [ ] **Step 6: Commit**

```bash
git add src/email/brevo.ts src/email/__tests__/brevo.test.ts
git commit -m "feat(email): Brevo transactional client over fetch"
```

---

### Task 3: Job state machine

**Files:**
- Create: `src/email/job-state.ts`
- Test: `src/email/__tests__/job-state.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `MAX_ATTEMPTS = 5`
  - `type EmailJobStatus = 'queued' | 'sent' | 'failed'` (the `email-job.status` enum of Task 5)
  - `type AttemptOutcome = { ok: true } | { ok: false; error: string }`
  - `type JobState = { status: EmailJobStatus; attempts: number; lastError: string | null; sentAt: string | null }`
  - `type Transition = JobState & { alert: boolean }`
  - `nextJobState(job: { attempts: number }, outcome: AttemptOutcome, now: Date): Transition`
  - `isDue(job: { status: EmailJobStatus; updatedAt: string | null }, now: Date, quietMs: number): boolean`

- [ ] **Step 1: Write the failing test**

`src/email/__tests__/job-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAX_ATTEMPTS, isDue, nextJobState } from '../job-state';

const NOW = new Date('2026-10-20T09:00:00.000Z');

describe('nextJobState', () => {
  it('marks a successful attempt sent', () => {
    expect(nextJobState({ attempts: 0 }, { ok: true }, NOW)).toEqual({
      status: 'sent',
      attempts: 1,
      lastError: null,
      sentAt: '2026-10-20T09:00:00.000Z',
      alert: false,
    });
  });

  it('keeps a failed job queued below the cap, with its error', () => {
    expect(nextJobState({ attempts: 3 }, { ok: false, error: 'Brevo 500: down' }, NOW)).toEqual({
      status: 'queued',
      attempts: 4,
      lastError: 'Brevo 500: down',
      sentAt: null,
      alert: false,
    });
  });

  it('fails the job and raises an alert on the fifth failed attempt', () => {
    expect(MAX_ATTEMPTS).toBe(5);
    expect(nextJobState({ attempts: 4 }, { ok: false, error: 'Brevo 401: bad key' }, NOW)).toEqual({
      status: 'failed',
      attempts: 5,
      lastError: 'Brevo 401: bad key',
      sentAt: null,
      alert: true,
    });
  });

  it('still sends on the fifth attempt when it succeeds', () => {
    expect(nextJobState({ attempts: 4 }, { ok: true }, NOW)).toMatchObject({ status: 'sent', attempts: 5, alert: false });
  });

  it('cuts very long errors', () => {
    expect(nextJobState({ attempts: 0 }, { ok: false, error: 'x'.repeat(900) }, NOW).lastError).toHaveLength(500);
  });
});

describe('isDue', () => {
  const quiet = 5 * 60_000;
  it('takes queued jobs untouched for the quiet period', () => {
    expect(isDue({ status: 'queued', updatedAt: '2026-10-20T08:50:00.000Z' }, NOW, quiet)).toBe(true);
    expect(isDue({ status: 'queued', updatedAt: null }, NOW, quiet)).toBe(true);
  });
  it('skips a job touched moments ago, and sent or failed jobs', () => {
    expect(isDue({ status: 'queued', updatedAt: '2026-10-20T08:58:00.000Z' }, NOW, quiet)).toBe(false);
    expect(isDue({ status: 'sent', updatedAt: '2026-10-19T08:00:00.000Z' }, NOW, quiet)).toBe(false);
    expect(isDue({ status: 'failed', updatedAt: '2026-10-19T08:00:00.000Z' }, NOW, quiet)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npm test -- src/email/__tests__/job-state.test.ts`
Expected: FAIL (cannot find module `../job-state`).

- [ ] **Step 3: Implement the state machine**

`src/email/job-state.ts`:

```ts
/**
 * E-mail job state machine.
 *
 *   queued --attempt ok--------------------------------> sent
 *   queued --attempt failed, attempts < MAX_ATTEMPTS---> queued (retried by the hourly cron)
 *   queued --attempt failed, attempts = MAX_ATTEMPTS---> failed (+ GlitchTip alert)
 *
 * A skipped attempt (no Brevo key, no sender, no test address) is not an attempt:
 * the job stays queued with its counter unchanged, so nothing is lost.
 */
export const MAX_ATTEMPTS = 5;
const MAX_ERROR = 500;

export type EmailJobStatus = 'queued' | 'sent' | 'failed';
export type AttemptOutcome = { ok: true } | { ok: false; error: string };
export type JobState = { status: EmailJobStatus; attempts: number; lastError: string | null; sentAt: string | null };
export type Transition = JobState & { alert: boolean };

export function nextJobState(job: { attempts: number }, outcome: AttemptOutcome, now: Date): Transition {
  const attempts = job.attempts + 1;
  if (outcome.ok === true) return { status: 'sent', attempts, lastError: null, sentAt: now.toISOString(), alert: false };
  const failed = attempts >= MAX_ATTEMPTS;
  return { status: failed ? 'failed' : 'queued', attempts, lastError: outcome.error.slice(0, MAX_ERROR), sentAt: null, alert: failed };
}

/** A job the cron may try now: still queued and untouched for `quietMs` (so a running first attempt is not doubled). */
export function isDue(job: { status: EmailJobStatus; updatedAt: string | null }, now: Date, quietMs: number): boolean {
  if (job.status !== 'queued') return false;
  const updated = job.updatedAt ? Date.parse(job.updatedAt) : 0;
  return now.getTime() - updated >= quietMs;
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npm test -- src/email/__tests__/job-state.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Type-check, run everything, commit**

Run: `npx tsc --noEmit` and `npm test` (zero errors, all PASS).

```bash
git add src/email/job-state.ts src/email/__tests__/job-state.test.ts
git commit -m "feat(email): job state machine with a 5-attempt cap"
```

---

### Task 4: E1 template, links and header image

**Files:**
- Create: `src/email/registration-template.ts`, `src/email/links.ts`, `scripts/render-email-header.py`, `public/email/edusport-header.png` (generated in Step 6)
- Test: `src/email/__tests__/registration-template.test.ts`, `src/email/__tests__/links.test.ts`, `src/email/__tests__/header-image.test.ts`

**Interfaces:**
- Consumes: plan 2D `type DocumentKind = 'acord' | 'adeziune'` from `src/club/documents` (type only) and its fonts `assets/fonts/Inter-Bold.ttf`, `assets/fonts/ClimateCrisis-Variable.ttf`; Task 1 `EmailConfig`.
- Produces:
  - `type EmailLinks = { site: string; program: string; privacy: string; headerImage: string | null; whatsapp: string | null; phone: string | null; email: string | null; facebook: string | null }` (`headerImage` null: text header; `whatsapp` null or empty in Setări site: no WhatsApp button)
  - `type RegistrationEmailInput = { childName: string; registrationNumber: string; seasonLabel: string; documents: DocumentKind[]; links: EmailLinks }`
  - `type RenderedEmail = { subject: string; html: string; text: string }`
  - `renderRegistrationEmail(input): RenderedEmail`, `registrationSubject(childName, registrationNumber): string`, `attachedSentence(documents)`, `nextSteps(documents)`, `displayUrl(url)`, `escapeHtml(value)`, `registrationHtml(input)`, `registrationText(input)`
  - `buildEmailLinks(config: EmailConfig, contact: unknown): EmailLinks`
  - Static file `public/email/edusport-header.png`, 352x64 (shown at 176x32).

Copy, word for word from the E1 mockup (`gen_email3.py`, `gen_email2.py`), DECISIONS 2026-10-05:
- Subject "Înscriere înregistrată: <copil> (nr. <nr>)".
- Header image CLUBUL SPORTIV / EDUSPORT; right: "Sezonul <sezon>", "Nr. înscriere <nr>".
- Title "Înscriere înregistrată"; "Bună ziua,"; "Am primit înscrierea pentru <copil> la Școala de Patinaj EduSport." followed by "Am atașat formularul de înscriere și cererea de adeziune." (both) or "Am atașat formularul de înscriere." (only the Acord, gen_email3 note).
- "Ce urmează": 1 "Confirmăm înscrierea" / "Vom confirma înscrierea în cel mai scurt timp."; 2 "Aduceți documentele" / "Tipăriți documentele atașate și aduceți-le la prima ședință. Documentele vor fi semnate la prima ședință de curs." (singular: "Aduceți documentul" / "Tipăriți documentul atașat și aduceți-l la prima ședință. Documentul va fi semnat la prima ședință de curs."); 3 "Urmăriți programul" / "Programul weekendurilor e pe site."
- Buttons "Vezi programul" (black) and "Canalul WhatsApp" (outlined), stacked full width under 600 px.
- "Cu drag," / "Echipa Școlii de Patinaj EduSport".
- Footer: "ACS EduSport", phone and e-mail, site and Facebook (commas, no middle dot), then "Ați primit acest e-mail pentru că ați completat formularul de înscriere pe scoaladepatinaj.com. Datele sunt prelucrate conform Politicii de Confidențialitate." with the link. No membership or subscription lines.
- Colours and sizes from the mockup CSS: navy `#0e1a3c`, text `#1b1d22`, muted `#495269`, footer `#5f657a`, rule `#dfdddb`, 6 px navy left bar, 28 px navy number squares, buttons 13 px uppercase with 1.5 px navy border, no radius.

- [ ] **Step 1: Write the failing tests**

`src/email/__tests__/registration-template.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  attachedSentence,
  displayUrl,
  nextSteps,
  registrationSubject,
  renderRegistrationEmail,
  type RegistrationEmailInput,
} from '../registration-template';

const INPUT: RegistrationEmailInput = {
  childName: 'Maria Dumitrescu',
  registrationNumber: '2026-0142',
  seasonLabel: '2026-2027',
  documents: ['acord', 'adeziune'],
  links: {
    site: 'https://scoaladepatinaj.com',
    program: 'https://scoaladepatinaj.com/cursuri/program',
    privacy: 'https://scoaladepatinaj.com/protectia-datelor',
    headerImage: 'https://cms.scoaladepatinaj.com/email/edusport-header.png',
    whatsapp: 'https://whatsapp.com/channel/abc',
    phone: '0723.623.712',
    email: 'edusporttrophy@gmail.com',
    facebook: 'https://www.facebook.com/EduSportClub',
  },
};
const ACORD_ONLY: RegistrationEmailInput = { ...INPUT, documents: ['acord'] };
const visible = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');

describe('registration e-mail copy', () => {
  it('uses the approved subject', () => {
    expect(registrationSubject('Maria Dumitrescu', '2026-0142')).toBe('Înscriere înregistrată: Maria Dumitrescu (nr. 2026-0142)');
    expect(registrationSubject(' Maria\n Dumitrescu ', '2026-0142')).toBe('Înscriere înregistrată: Maria Dumitrescu (nr. 2026-0142)');
  });

  it('names the attached documents', () => {
    expect(attachedSentence(['acord', 'adeziune'])).toBe('Am atașat formularul de înscriere și cererea de adeziune.');
    expect(attachedSentence(['acord'])).toBe('Am atașat formularul de înscriere.');
  });

  it('switches the document step between plural and singular', () => {
    expect(nextSteps(['acord', 'adeziune'])[1]).toEqual({
      title: 'Aduceți documentele',
      text: 'Tipăriți documentele atașate și aduceți-le la prima ședință. Documentele vor fi semnate la prima ședință de curs.',
    });
    expect(nextSteps(['acord'])[1]).toEqual({
      title: 'Aduceți documentul',
      text: 'Tipăriți documentul atașat și aduceți-l la prima ședință. Documentul va fi semnat la prima ședință de curs.',
    });
  });

  it('shortens links for display', () => {
    expect(displayUrl('https://www.facebook.com/EduSportClub/')).toBe('facebook.com/EduSportClub');
  });
});

describe('renderRegistrationEmail', () => {
  it('builds the E1 letter with header image, steps, buttons and sign-off', () => {
    const { html } = renderRegistrationEmail(INPUT);
    expect(html).toContain('<img src="https://cms.scoaladepatinaj.com/email/edusport-header.png"');
    expect(html).toContain('alt="Clubul Sportiv EduSport"');
    const text = visible(html);
    for (const part of ['Sezonul', '2026-2027', 'Nr. înscriere', '2026-0142', 'Înscriere înregistrată', 'Bună ziua,', 'Ce urmează', 'Confirmăm înscrierea', 'Urmăriți programul', 'Vezi programul', 'Canalul WhatsApp', 'Cu drag,', 'Echipa Școlii de Patinaj EduSport', 'ACS EduSport', 'Telefon 0723.623.712, edusporttrophy@gmail.com', 'scoaladepatinaj.com, facebook.com/EduSportClub', 'Politicii de Confidențialitate']) {
      expect(text).toContain(part);
    }
    expect(html).toContain('href="https://scoaladepatinaj.com/cursuri/program"');
    expect(html).toContain('href="https://whatsapp.com/channel/abc"');
    expect(html).toContain('href="https://scoaladepatinaj.com/protectia-datelor"');
  });

  it('is table-based and stacks the buttons on phones', () => {
    const { html } = renderRegistrationEmail(INPUT);
    expect(html).toContain('role="presentation"');
    expect(html).toContain('@media only screen and (max-width:600px)');
    expect(html).toContain('.es-btn{display:block!important;width:100%!important');
    expect(html).not.toMatch(/border-radius|dashed|dotted/);
  });

  it('has a plain-text part with the same content and the link targets', () => {
    const { text } = renderRegistrationEmail(INPUT);
    expect(text).toContain('Înscriere înregistrată');
    expect(text).toContain('Am primit înscrierea pentru Maria Dumitrescu la Școala de Patinaj EduSport. Am atașat formularul de înscriere și cererea de adeziune.');
    expect(text).toContain('1. Confirmăm înscrierea');
    expect(text).toContain('Vezi programul: https://scoaladepatinaj.com/cursuri/program');
    expect(text).toContain('Canalul WhatsApp: https://whatsapp.com/channel/abc');
    expect(text).toContain('Cu drag,\nEchipa Școlii de Patinaj EduSport');
    expect(text).not.toMatch(/<[a-z]/i);
  });

  it('never contains an em dash, a middle dot or an emoji, in any variant', () => {
    for (const input of [INPUT, ACORD_ONLY, { ...INPUT, links: { ...INPUT.links, whatsapp: null, phone: null, facebook: null } }]) {
      const { subject, html, text } = renderRegistrationEmail(input);
      for (const part of [subject, html, text]) {
        expect(part).not.toMatch(/[\u2014\u00b7\u2022]/);
        expect(part).not.toMatch(/\p{Extended_Pictographic}/u);
      }
    }
  });

  it('uses the singular wording with only the Acord', () => {
    const { html, text } = renderRegistrationEmail(ACORD_ONLY);
    expect(visible(html)).toContain('Am atașat formularul de înscriere.');
    expect(text).toContain('Documentul va fi semnat la prima ședință de curs.');
    expect(text).not.toContain('Documentele');
  });

  it('leaves out the WhatsApp button when no channel link is set', () => {
    const { html, text } = renderRegistrationEmail({ ...INPUT, links: { ...INPUT.links, whatsapp: null } });
    expect(html).not.toContain('Canalul WhatsApp');
    expect(text).not.toContain('Canalul WhatsApp');
  });

  it('falls back to a text header without an image address', () => {
    const { html } = renderRegistrationEmail({ ...INPUT, links: { ...INPUT.links, headerImage: null } });
    expect(html).not.toContain('<img');
    expect(visible(html)).toContain('CLUBUL SPORTIV');
    expect(visible(html)).toContain('EDUSPORT');
  });

  it('escapes what the parent typed', () => {
    const { html } = renderRegistrationEmail({ ...INPUT, childName: 'Ana <script>alert(1)</script> & "Co"' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('Ana &lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Co&quot;');
  });
});
```

`src/email/__tests__/links.test.ts`:

```ts
import { expect, it } from 'vitest';
import { readEmailConfig } from '../config';
import { buildEmailLinks } from '../links';

it('builds the site links and reads the contact from Setări site', () => {
  const config = readEmailConfig({ EMAIL_SITE_URL: 'https://scoaladepatinaj.com', CMS_PUBLIC_URL: 'https://cms.scoaladepatinaj.com' });
  const contact = { phone: '0723.623.712', email: ' edusporttrophy@gmail.com ', facebookUrl1: 'https://www.facebook.com/EduSportClub', whatsappChannelUrl: '' };
  expect(buildEmailLinks(config, contact)).toEqual({
    site: 'https://scoaladepatinaj.com',
    program: 'https://scoaladepatinaj.com/cursuri/program',
    privacy: 'https://scoaladepatinaj.com/protectia-datelor',
    headerImage: 'https://cms.scoaladepatinaj.com/email/edusport-header.png',
    whatsapp: null,
    phone: '0723.623.712',
    email: 'edusporttrophy@gmail.com',
    facebook: 'https://www.facebook.com/EduSportClub',
  });
});

it('copes with a missing contact block and no CMS address', () => {
  expect(buildEmailLinks(readEmailConfig({}), null)).toMatchObject({ headerImage: null, whatsapp: null, phone: null, email: null, facebook: null });
});
```

`src/email/__tests__/header-image.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('ships the header image at twice the size the e-mail shows (176x32)', () => {
  const png = readFileSync(join(__dirname, '..', '..', '..', 'public', 'email', 'edusport-header.png'));
  expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([352, 64]);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm test -- src/email/__tests__/registration-template.test.ts src/email/__tests__/links.test.ts src/email/__tests__/header-image.test.ts`
Expected: FAIL (modules `../registration-template`, `../links` not found; the PNG does not exist).

- [ ] **Step 3: Implement the template**

`src/email/registration-template.ts`:

```ts
/**
 * Registration e-mail, design E1 (DECISIONS 2026-10-05, mockups/screens/email-e-v2.html,
 * generator mockups/gen_email3.py): a letter on white with a navy left bar, header image
 * CLUBUL SPORTIV / EDUSPORT, Sezonul and Nr. înscriere on the right, "Ce urmează" in three
 * numbered navy squares, two buttons stacked on phones, sign-off and footer.
 * Table-based HTML with inline styles, plus a plain-text part. Copy is word for word from the
 * mockup; the footer joins facts with commas (no middle dot).
 */
import type { DocumentKind } from '../club/documents';

export type EmailLinks = {
  site: string;
  program: string;
  privacy: string;
  headerImage: string | null;
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  facebook: string | null;
};

export type RegistrationEmailInput = {
  childName: string;
  registrationNumber: string;
  seasonLabel: string;
  documents: DocumentKind[];
  links: EmailLinks;
};

export type RenderedEmail = { subject: string; html: string; text: string };
type Step = { title: string; text: string };

const NAVY = '#0e1a3c';
const MUTED = '#495269';
const FONT = 'Inter,Arial,Helvetica,sans-serif';
const HEAD_FONT = "'League Spartan',Arial,Helvetica,sans-serif";
const SIGN_OFF = ['Cu drag,', 'Echipa Școlii de Patinaj EduSport'] as const;
const NOTICE_START = 'Ați primit acest e-mail pentru că ați completat formularul de înscriere pe ';
const NOTICE_END = '. Datele sunt prelucrate conform ';
const PRIVACY = 'Politicii de Confidențialitate';

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const oneLine = (value: string): string => value.replace(/\s+/g, ' ').trim();

export function registrationSubject(childName: string, registrationNumber: string): string {
  return `Înscriere înregistrată: ${oneLine(childName)} (nr. ${oneLine(registrationNumber)})`;
}

/** Which documents are attached, as the intro says it. */
export function attachedSentence(documents: DocumentKind[]): string {
  const acord = documents.includes('acord');
  const adeziune = documents.includes('adeziune');
  if (acord && adeziune) return 'Am atașat formularul de înscriere și cererea de adeziune.';
  return adeziune ? 'Am atașat cererea de adeziune.' : 'Am atașat formularul de înscriere.';
}

export function nextSteps(documents: DocumentKind[]): Step[] {
  const many = documents.length > 1;
  return [
    { title: 'Confirmăm înscrierea', text: 'Vom confirma înscrierea în cel mai scurt timp.' },
    many
      ? { title: 'Aduceți documentele', text: 'Tipăriți documentele atașate și aduceți-le la prima ședință. Documentele vor fi semnate la prima ședință de curs.' }
      : { title: 'Aduceți documentul', text: 'Tipăriți documentul atașat și aduceți-l la prima ședință. Documentul va fi semnat la prima ședință de curs.' },
    { title: 'Urmăriți programul', text: 'Programul weekendurilor e pe site.' },
  ];
}

/** "https://www.facebook.com/EduSportClub/" -> "facebook.com/EduSportClub" */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
}

function contactLines(links: EmailLinks): string[] {
  const contact = [links.phone ? `Telefon ${links.phone}` : null, links.email].filter((v): v is string => Boolean(v));
  const web = [displayUrl(links.site), links.facebook ? displayUrl(links.facebook) : null].filter((v): v is string => Boolean(v));
  return ['ACS EduSport', contact.join(', '), web.join(', ')].filter(Boolean);
}

/** The CLUBUL SPORTIV / EDUSPORT image; as text when no image address is configured (CMS_PUBLIC_URL unset). */
function brandHtml(headerImage: string | null): string {
  if (headerImage) {
    return `<img src="${escapeHtml(headerImage)}" width="176" height="32" alt="Clubul Sportiv EduSport" style="display:block;border:0;outline:none;text-decoration:none;">`;
  }
  return (
    `<div style="font-family:${FONT};font-size:9px;font-weight:700;letter-spacing:.34em;color:${NAVY};">CLUBUL SPORTIV</div>` +
    `<div style="font-family:'Climate Crisis',Impact,${FONT};font-size:20px;letter-spacing:.04em;color:${NAVY};">EDUSPORT</div>`
  );
}

function headerHtml(input: RegistrationEmailInput): string {
  const meta = `font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};white-space:nowrap;`;
  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
    `<td valign="top">${brandHtml(input.links.headerImage)}</td>` +
    `<td valign="top" align="right" style="${meta}">Sezonul <b style="color:${NAVY};">${escapeHtml(input.seasonLabel)}</b><br>` +
    `Nr. înscriere <b style="color:${NAVY};">${escapeHtml(input.registrationNumber)}</b></td>` +
    '</tr></table>'
  );
}

function introHtml(input: RegistrationEmailInput): string {
  return (
    `<h1 style="margin:34px 0 12px;font-family:${HEAD_FONT};font-size:24px;font-weight:800;line-height:1.1;color:${NAVY};">Înscriere înregistrată</h1>` +
    '<p style="margin:0 0 6px;">Bună ziua,</p>' +
    `<p style="margin:0 0 18px;">Am primit înscrierea pentru <b>${escapeHtml(oneLine(input.childName))}</b> la Școala de Patinaj EduSport. ${attachedSentence(input.documents)}</p>`
  );
}

function stepRowHtml(step: Step, index: number): string {
  const square = `width:28px;height:28px;background:${NAVY};color:#fbf8f1;font-family:${FONT};font-size:13px;font-weight:800;text-align:center;vertical-align:middle;`;
  return (
    '<tr>' +
    `<td width="28" valign="top" style="padding:8px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${NAVY}" style="${square}">${index + 1}</td></tr></table></td>` +
    `<td valign="top" style="padding:8px 0 8px 10px;font-family:${FONT};"><b style="display:block;color:${NAVY};">${step.title}</b>` +
    `<span style="color:${MUTED};font-size:13.5px;">${step.text}</span></td>` +
    '</tr>'
  );
}

function stepsHtml(documents: DocumentKind[]): string {
  const label = `font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${MUTED};`;
  return (
    `<div style="${label}">Ce urmează</div>` +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:4px;">' +
    nextSteps(documents).map(stepRowHtml).join('') +
    '</table>'
  );
}

function buttonHtml(label: string, href: string, primary: boolean): string {
  const cell = primary ? 'background:#000000;' : 'background:#ffffff;';
  const link =
    `display:block;padding:${primary ? '14px 22px' : '12px 20px'};font-family:${FONT};font-size:13px;font-weight:600;` +
    `letter-spacing:.06em;text-transform:uppercase;text-align:center;text-decoration:none;color:${primary ? '#fbf8f1' : NAVY};`;
  return `<td class="es-btn" bgcolor="${primary ? '#000000' : '#ffffff'}" style="${cell}border:1.5px solid ${NAVY};"><a href="${escapeHtml(href)}" style="${link}">${label}</a></td>`;
}

function buttonsHtml(links: EmailLinks): string {
  const whatsapp = links.whatsapp
    ? '<td class="es-gap" width="10" style="width:10px;font-size:0;line-height:0;">&nbsp;</td>' + buttonHtml('Canalul WhatsApp', links.whatsapp, false)
    : '';
  return (
    '<table role="presentation" class="es-btns" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;"><tr>' +
    buttonHtml('Vezi programul', links.program, true) +
    whatsapp +
    '</tr></table>'
  );
}

function signOffHtml(): string {
  return `<p style="margin:28px 0 0;color:${MUTED};">${SIGN_OFF[0]}<br><b style="color:${NAVY};">${SIGN_OFF[1]}</b></p>`;
}

function footerHtml(links: EmailLinks): string {
  const lines = contactLines(links).map(escapeHtml);
  lines[0] = `<b style="color:${NAVY};">${lines[0]}</b>`;
  const privacy = `<a href="${escapeHtml(links.privacy)}" style="color:${NAVY};font-weight:600;">${PRIVACY}</a>`;
  return (
    `<td colspan="2" class="es-pad" style="border-top:1px solid #dfdddb;padding:22px 36px;font-family:${FONT};font-size:11.5px;line-height:1.55;color:#5f657a;">` +
    `${lines.join('<br>')}<br><br>${NOTICE_START}${escapeHtml(displayUrl(links.site))}${NOTICE_END}${privacy}.</td>`
  );
}

const HEAD =
  '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
  '<meta name="x-apple-disable-message-reformatting"><style>' +
  '@media only screen and (max-width:600px){' +
  '.es-pad{padding-left:22px!important;padding-right:22px!important}' +
  '.es-btns,.es-btns tbody,.es-btns tr{display:block!important;width:100%!important}' +
  '.es-btn{display:block!important;width:100%!important;box-sizing:border-box}' +
  '.es-gap{display:block!important;width:100%!important;height:10px!important}}' +
  '</style></head>';

function letterHtml(input: RegistrationEmailInput): string {
  return (
    `<tr><td width="6" bgcolor="${NAVY}" style="width:6px;background:${NAVY};font-size:0;line-height:0;">&nbsp;</td>` +
    `<td class="es-pad" style="padding:36px;font-family:${FONT};font-size:14px;line-height:1.5;color:#1b1d22;">` +
    headerHtml(input) + introHtml(input) + stepsHtml(input.documents) + buttonsHtml(input.links) + signOffHtml() +
    '</td></tr>'
  );
}

export function registrationHtml(input: RegistrationEmailInput): string {
  return (
    `<!DOCTYPE html><html lang="ro">${HEAD}<body style="margin:0;padding:0;background:#f3f4f6;">` +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f4f6"><tr><td align="center" style="padding:24px 12px;">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background:#ffffff;">' +
    letterHtml(input) +
    `<tr>${footerHtml(input.links)}</tr>` +
    '</table></td></tr></table></body></html>'
  );
}

export function registrationText(input: RegistrationEmailInput): string {
  const steps = nextSteps(input.documents).map((s, i) => `${i + 1}. ${s.title}\n   ${s.text}`);
  const buttons = [`Vezi programul: ${input.links.program}`, input.links.whatsapp ? `Canalul WhatsApp: ${input.links.whatsapp}` : null];
  return [
    'Înscriere înregistrată',
    `Sezonul ${input.seasonLabel}\nNr. înscriere ${input.registrationNumber}`,
    'Bună ziua,',
    `Am primit înscrierea pentru ${oneLine(input.childName)} la Școala de Patinaj EduSport. ${attachedSentence(input.documents)}`,
    ['Ce urmează', ...steps].join('\n'),
    buttons.filter(Boolean).join('\n'),
    SIGN_OFF.join('\n'),
    contactLines(input.links).join('\n'),
    `${NOTICE_START}${displayUrl(input.links.site)}${NOTICE_END}${PRIVACY}: ${input.links.privacy}`,
  ].join('\n\n') + '\n';
}

export function renderRegistrationEmail(input: RegistrationEmailInput): RenderedEmail {
  return {
    subject: registrationSubject(input.childName, input.registrationNumber),
    html: registrationHtml(input),
    text: registrationText(input),
  };
}
```

- [ ] **Step 4: Implement the links**

`src/email/links.ts`:

```ts
import type { EmailConfig } from './config';
import type { EmailLinks } from './registration-template';

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

/**
 * Links and contact lines for the e-mail. Site pages come from EMAIL_SITE_URL; the WhatsApp channel,
 * phone, e-mail and Facebook from Setări site > Contact (`site-settings.contact`), as the website footer.
 */
export function buildEmailLinks(config: EmailConfig, contact: unknown): EmailLinks {
  const c = contact && typeof contact === 'object' ? (contact as Record<string, unknown>) : {};
  return {
    site: config.siteUrl,
    program: `${config.siteUrl}/cursuri/program`,
    privacy: `${config.siteUrl}/protectia-datelor`,
    headerImage: config.headerImageUrl,
    whatsapp: text(c.whatsappChannelUrl),
    phone: text(c.phone),
    email: text(c.email),
    facebook: text(c.facebookUrl1),
  };
}
```

- [ ] **Step 5: Add the header image script**

`scripts/render-email-header.py`:

```python
#!/usr/bin/env python3
"""Render the e-mail header image: small "CLUBUL SPORTIV" above the EDUSPORT wordmark.

Mirrors the approved mockup email-e-v2.html (option E1): label Inter Bold 9px, letter-spacing .34em,
uppercase; wordmark Climate Crisis 20px (axis Year 1979, as on the website), letter-spacing .04em;
both navy #0e1a3c on white. Fonts are the ones plan 2D bundles in assets/fonts (OFL).
Drawn at 2x for sharp rendering on high-density screens; the e-mail shows it at 176x32.

Usage: python3 scripts/render-email-header.py [--out PATH]
Needs Pillow (pip install pillow). Run once; the PNG is committed.
"""
import argparse
from PIL import Image, ImageDraw, ImageFont

SCALE = 2
WIDTH, HEIGHT = 176 * SCALE, 32 * SCALE
NAVY = (14, 26, 60, 255)
WHITE = (255, 255, 255, 255)
LABEL_FONT = 'assets/fonts/Inter-Bold.ttf'
WORDMARK_FONT = 'assets/fonts/ClimateCrisis-Variable.ttf'
WORDMARK_YEAR = 1979


def draw_spaced(draw, x, y, text, font, spacing):
    for ch in text:
        draw.text((x, y), ch, font=font, fill=NAVY)
        x += font.getlength(ch) + spacing
    return x


def render(out):
    img = Image.new('RGBA', (WIDTH, HEIGHT), WHITE)
    draw = ImageDraw.Draw(img)
    label = ImageFont.truetype(LABEL_FONT, 9 * SCALE)
    wordmark = ImageFont.truetype(WORDMARK_FONT, 20 * SCALE)
    wordmark.set_variation_by_axes([WORDMARK_YEAR])
    draw_spaced(draw, 0, 0, 'CLUBUL SPORTIV', label, 0.34 * 9 * SCALE)
    label_bottom = label.getbbox('CLUBUL SPORTIV')[3]
    glyph_top = wordmark.getbbox('EDUSPORT')[1]
    draw_spaced(draw, 0, label_bottom + 4 * SCALE - glyph_top, 'EDUSPORT', wordmark, 0.04 * 20 * SCALE)
    img.convert('RGB').save(out, 'PNG', optimize=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', default='public/email/edusport-header.png')
    args = parser.parse_args()
    render(args.out)
    print(f'wrote {args.out} ({WIDTH}x{HEIGHT})')
```

- [ ] **Step 6: Render the header image**

Run from the repo root (needs Pillow: `python3 -m pip install --user pillow` if `python3 -c "import PIL"` fails):

```bash
mkdir -p public/email
python3 scripts/render-email-header.py
```

Expected: `wrote public/email/edusport-header.png (352x64)`. Open the PNG: "CLUBUL SPORTIV" in small spaced Inter Bold capitals above "EDUSPORT" in Climate Crisis, navy on white, nothing cut off (validated render: ink from y 5 to 59 of 64). The script reads 2D's `assets/fonts/Inter-Bold.ttf` and `assets/fonts/ClimateCrisis-Variable.ttf`; run it from the repo root.

- [ ] **Step 7: Run the tests to see them pass**

Run: `npm test -- src/email/__tests__/registration-template.test.ts src/email/__tests__/links.test.ts src/email/__tests__/header-image.test.ts`
Expected: PASS (12 + 2 + 1 tests).

- [ ] **Step 8: Look at it**

Write the rendered HTML to a file and open it in a browser at desktop width and at 375 px (devtools device mode):

```bash
cat > es2f-render.ts <<'TS'
import { writeFileSync } from 'node:fs';
import { renderRegistrationEmail } from './src/email/registration-template';
const r = renderRegistrationEmail({
  childName: 'Maria Dumitrescu', registrationNumber: '2026-0142', seasonLabel: '2026-2027', documents: ['acord', 'adeziune'],
  links: { site: 'https://scoaladepatinaj.com', program: 'https://scoaladepatinaj.com/cursuri/program', privacy: 'https://scoaladepatinaj.com/protectia-datelor',
    headerImage: `file://${process.cwd()}/public/email/edusport-header.png`, whatsapp: 'https://whatsapp.com/channel/x',
    phone: '0723.623.712', email: 'edusporttrophy@gmail.com', facebook: 'https://www.facebook.com/EduSportClub' },
});
writeFileSync('/tmp/es2f-email.html', r.html);
writeFileSync('/tmp/es2f-email.txt', r.text);
TS
npx esbuild es2f-render.ts --bundle --platform=node --outfile=/tmp/es2f-render.js --log-level=warning
rm es2f-render.ts
node /tmp/es2f-render.js
open /tmp/es2f-email.html
```

Expected: matches option E1 of `../edusport_frontend/docs/portal/mockups/screens/email-e-v2.html` (white letter, navy left bar, header image left with Sezonul / Nr. înscriere right, numbered navy squares, buttons side by side; on 375 px the two buttons stack full width). `/tmp/es2f-email.txt` holds the same text with the link targets. Show both widths to the user next to the mockup before Task 6 continues (the user approves designs).

- [ ] **Step 9: Type-check, run everything, commit**

Run: `npx tsc --noEmit` and `npm test` (zero errors, all PASS).

```bash
git add src/email/registration-template.ts src/email/links.ts scripts/render-email-header.py public/email/edusport-header.png \
  src/email/__tests__/registration-template.test.ts src/email/__tests__/links.test.ts src/email/__tests__/header-image.test.ts
git commit -m "feat(email): E1 registration e-mail template and header image"
```

---

### Task 5: `email-job` content type

**Files:**
- Create: `src/api/email-job/content-types/email-job/schema.json`, `src/api/email-job/services/email-job.ts`, `src/api/email-job/routes/email-job.ts`
- Test: `src/email/__tests__/email-job-schema.test.ts`
- Regenerate: `types/generated/contentTypes.d.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: UID `api::email-job.email-job`, table `email_jobs`, attributes `recipient` string (required), `subject` string (required), `kind` enum `registration` (required, default), `registration` manyToOne relation to `api::registration-submission.registration-submission` (one-way), `status` enum `queued|sent|failed` (required, default `queued`), `attempts` integer (required, default 0, min 0), `lastError` text, `sentAt` datetime. Hidden in the Content Manager; no generated routes. The controller (handlers `emailStatus`, `resendEmail`) is Task 8.

`recipient` is a plain string, not Strapi's `email` type: the address was already validated at submit, and a stricter check here could only make a queued job unsavable. `registration` is one-way, so deleting a registration leaves its jobs with no registration (Task 6 fails such a job without an alert).

- [ ] **Step 1: Write the failing test**

`src/email/__tests__/email-job-schema.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');

it('keeps email-job private: hidden in the Content Manager, no generated routes', () => {
  const schema = JSON.parse(readFileSync(join(SRC, 'api/email-job/content-types/email-job/schema.json'), 'utf8'));
  expect(schema.pluginOptions).toEqual({ 'content-manager': { visible: false } });
  expect(schema.options).toEqual({ draftAndPublish: false });
  expect(readFileSync(join(SRC, 'api/email-job/routes/email-job.ts'), 'utf8')).toContain('{ only: [] }');
});

it('stores recipient, subject, kind, registration, status, attempts, lastError and sentAt', () => {
  const { attributes } = JSON.parse(readFileSync(join(SRC, 'api/email-job/content-types/email-job/schema.json'), 'utf8'));
  expect(Object.keys(attributes)).toEqual(['recipient', 'subject', 'kind', 'registration', 'status', 'attempts', 'lastError', 'sentAt']);
  expect(attributes.status).toEqual({ type: 'enumeration', enum: ['queued', 'sent', 'failed'], required: true, default: 'queued' });
  expect(attributes.attempts).toEqual({ type: 'integer', required: true, default: 0, min: 0 });
  expect(attributes.registration).toEqual({ type: 'relation', relation: 'manyToOne', target: 'api::registration-submission.registration-submission' });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npm test -- src/email/__tests__/email-job-schema.test.ts`
Expected: FAIL (ENOENT on `schema.json`).

- [ ] **Step 3: Create the content type**

`src/api/email-job/content-types/email-job/schema.json`:

```json
{
  "kind": "collectionType",
  "collectionName": "email_jobs",
  "info": { "singularName": "email-job", "pluralName": "email-jobs", "displayName": "Club / E-mail" },
  "options": { "draftAndPublish": false },
  "pluginOptions": { "content-manager": { "visible": false } },
  "attributes": {
    "recipient": { "type": "string", "required": true },
    "subject": { "type": "string", "required": true },
    "kind": { "type": "enumeration", "enum": ["registration"], "required": true, "default": "registration" },
    "registration": { "type": "relation", "relation": "manyToOne", "target": "api::registration-submission.registration-submission" },
    "status": { "type": "enumeration", "enum": ["queued", "sent", "failed"], "required": true, "default": "queued" },
    "attempts": { "type": "integer", "required": true, "default": 0, "min": 0 },
    "lastError": { "type": "text" },
    "sentAt": { "type": "datetime" }
  }
}
```

`src/api/email-job/services/email-job.ts`:

```ts
import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::email-job.email-job');
```

`src/api/email-job/routes/email-job.ts`:

```ts
import { factories } from '@strapi/strapi';

/** Private club data: no generated content-API routes (see registration-submission router, 2026-09-15). */
export default factories.createCoreRouter('api::email-job.email-job', { only: [] });
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npm test -- src/email/__tests__/email-job-schema.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Regenerate the types**

Run: `DATABASE_CLIENT=postgres npx strapi ts:generate-types`
Expected: "The task completed successfully"; `git diff --stat types/generated` shows `contentTypes.d.ts` with `ApiEmailJobEmailJob` added.

- [ ] **Step 6: Type-check, run everything, commit**

Run: `npx tsc --noEmit` and `npm test` (zero errors, all PASS).

```bash
git add src/api/email-job src/email/__tests__/email-job-schema.test.ts types/generated
git commit -m "feat(email): email-job content type (private queue)"
```

---

### Task 6: Job flow (queue, attempt, retry, resend, status)

**Files:**
- Create: `src/email/email-jobs.ts`
- Test: `src/email/__tests__/email-jobs.test.ts`

**Interfaces:**
- Consumes: Task 1 `blockedReason`, `deliveryTarget`, `BlockedReason`, `EmailConfig`, `readEmailConfig` (tests); Task 2 `Attachment`, `OutgoingEmail`, `SendResult`; Task 3 `isDue`, `nextJobState`, `AttemptOutcome`, `EmailJobStatus`, `JobState`; Task 4 `registrationSubject`, `renderRegistrationEmail`, `EmailLinks`; plan 2D `StoredDocument` (type only).
- Produces:
  - `QUIET_MS = 300000`, `RESEND_ACTION = 'email-resent'`, `RESEND_ERRORS` (`not-found`: "Înscrierea nu a fost găsită.", `no-documents`: "Înscrierea nu are documente.")
  - `type EmailJobRow = { documentId: string; recipient: string; subject: string; registrationDocumentId: string | null; status: EmailJobStatus; attempts: number; lastError: string | null; sentAt: string | null; updatedAt: string | null }`
  - `type NewEmailJob = { recipient: string; subject: string; registrationDocumentId: string }`, `type JobUpdate = JobState & { recipient?: string; subject?: string }`
  - `type RegistrationForEmail = { email: string; childName: string; registrationNumber: string; seasonLabel: string }`
  - `type HistoryNote = { subjectId: string; action: string; actor: string; changes: Record<string, unknown> }`
  - `type RetrySummary = { attempted: number; skipped: BlockedReason | null }`
  - `interface EmailJobStore { create; update; findQueued(limit); findLatest(registrationDocumentId) }`, `interface EmailDeps` (config, jobs, loadRegistration, listDocuments, readDocument, loadLinks, send, recordHistory, alert, log, defer, now)
  - `type RegistrationEmailStatus = { status: EmailJobStatus | 'none'; recipient: string; attempts: number; lastError: string | null; sentAt: string | null; updatedAt: string | null; documents: string[] }` (`recipient` is the address a resend goes to; `documents` are the file names it would carry)
  - `type ResendResult = { ok: true; status: RegistrationEmailStatus } | { ok: false; code: 'not-found' | 'no-documents'; error: string }`
  - `attemptJob(deps, job)`, `queueRegistrationEmail(deps, registrationDocumentId): Promise<EmailJobRow | null>`, `retryDueJobs(deps): Promise<RetrySummary>`, `registrationEmailStatus(deps, id): Promise<RegistrationEmailStatus | null>`, `resendRegistrationEmail(deps, id, actor): Promise<ResendResult>`

- [ ] **Step 1: Write the failing test**

`src/email/__tests__/email-jobs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { StoredDocument } from '../../club/documents';
import type { OutgoingEmail, SendResult } from '../brevo';
import { readEmailConfig } from '../config';
import {
  QUIET_MS,
  RESEND_ACTION,
  RESEND_ERRORS,
  attemptJob,
  queueRegistrationEmail,
  registrationEmailStatus,
  resendRegistrationEmail,
  retryDueJobs,
  type EmailDeps,
  type EmailJobRow,
  type HistoryNote,
  type JobUpdate,
  type NewEmailJob,
  type RegistrationForEmail,
} from '../email-jobs';
import type { EmailLinks } from '../registration-template';

const NOW = new Date('2026-10-20T09:00:00.000Z');
const LONG_AGO = '2026-10-20T07:00:00.000Z';
const REGISTRATION: RegistrationForEmail = { email: 'parinte@example.ro', childName: 'Maria Pop', registrationNumber: '2026-0008', seasonLabel: '2026-2027' };
const DOCUMENTS: StoredDocument[] = [
  { kind: 'acord', fileName: 'Pop_Maria_Acord_2026-2027.pdf', path: '/private/documents/a.pdf' },
  { kind: 'adeziune', fileName: 'Pop_Maria_Adeziune_2026-2027.pdf', path: '/private/documents/b.pdf' },
];
const LINKS: EmailLinks = {
  site: 'https://scoaladepatinaj.com',
  program: 'https://scoaladepatinaj.com/cursuri/program',
  privacy: 'https://scoaladepatinaj.com/protectia-datelor',
  headerImage: 'https://cms.scoaladepatinaj.com/email/edusport-header.png',
  whatsapp: null,
  phone: null,
  email: null,
  facebook: null,
};
const ENV = { BREVO_API_KEY: 'k', EMAIL_FROM_ADDRESS: 'inscrieri@scoaladepatinaj.com', EMAIL_TEST_RECIPIENT: 'test@codrin.space', NODE_ENV: 'test' };

type Options = { env?: Record<string, string | undefined>; send?: (m: OutgoingEmail) => Promise<SendResult>; documents?: StoredDocument[]; registration?: RegistrationForEmail | null };

function fakeDeps(options: Options = {}) {
  const jobs = new Map<string, EmailJobRow>();
  const sent: OutgoingEmail[] = [];
  const alerts: string[] = [];
  const history: HistoryNote[] = [];
  const deferred: (() => Promise<void>)[] = [];
  let seq = 0;
  const save = (row: EmailJobRow) => {
    jobs.set(row.documentId, row);
    return row;
  };
  const deps: EmailDeps = {
    config: readEmailConfig(options.env ?? ENV),
    jobs: {
      create: async (job: NewEmailJob) =>
        save({ documentId: `job-${++seq}`, ...job, status: 'queued', attempts: 0, lastError: null, sentAt: null, updatedAt: NOW.toISOString() }),
      update: async (id: string, data: JobUpdate) => save({ ...jobs.get(id)!, ...data, updatedAt: NOW.toISOString() }),
      findQueued: async () => [...jobs.values()].filter((j) => j.status === 'queued'),
      findLatest: async (regId: string) => [...jobs.values()].filter((j) => j.registrationDocumentId === regId).pop() ?? null,
    },
    loadRegistration: async () => (options.registration === undefined ? REGISTRATION : options.registration),
    listDocuments: async () => options.documents ?? DOCUMENTS,
    readDocument: async (d) => Buffer.from(`pdf:${d.fileName}`),
    loadLinks: async () => LINKS,
    send:
      options.send ??
      (async (m) => {
        sent.push(m);
        return { ok: true, messageId: '<m1>' };
      }),
    recordHistory: async (note) => {
      history.push(note);
    },
    alert: (m) => {
      alerts.push(m);
    },
    log: () => undefined,
    defer: (task) => {
      deferred.push(task);
    },
    now: () => NOW,
  };
  const runDeferred = async () => {
    for (const task of deferred.splice(0)) await task();
  };
  const age = (id: string) => jobs.set(id, { ...jobs.get(id)!, updatedAt: LONG_AGO });
  return { deps, jobs, sent, alerts, history, runDeferred, age };
}

const failing = async (): Promise<SendResult> => ({ ok: false, error: 'Brevo 500: down' });

describe('queueRegistrationEmail', () => {
  it('stores a queued job and sends it right after, not inside the submit request', async () => {
    const { deps, jobs, sent, runDeferred } = fakeDeps();
    const job = await queueRegistrationEmail(deps, 'reg-1');
    expect(job).toMatchObject({ status: 'queued', attempts: 0, recipient: 'parinte@example.ro', registrationDocumentId: 'reg-1', subject: 'Înscriere înregistrată: Maria Pop (nr. 2026-0008)' });
    expect(sent).toEqual([]);
    await runDeferred();
    expect(jobs.get(job!.documentId)).toMatchObject({ status: 'sent', attempts: 1, sentAt: NOW.toISOString(), lastError: null });
  });

  it('attaches the stored PDFs and uses the E1 subject', async () => {
    const { deps, sent, runDeferred } = fakeDeps();
    await queueRegistrationEmail(deps, 'reg-1');
    await runDeferred();
    expect(sent[0].subject).toBe('Înscriere înregistrată: Maria Pop (nr. 2026-0008)');
    expect(sent[0].attachments).toEqual([
      { name: 'Pop_Maria_Acord_2026-2027.pdf', content: Buffer.from('pdf:Pop_Maria_Acord_2026-2027.pdf').toString('base64') },
      { name: 'Pop_Maria_Adeziune_2026-2027.pdf', content: Buffer.from('pdf:Pop_Maria_Adeziune_2026-2027.pdf').toString('base64') },
    ]);
    expect(sent[0].text).toContain('Am atașat formularul de înscriere și cererea de adeziune.');
  });

  it('queues nothing for an unknown registration', async () => {
    const { deps, jobs } = fakeDeps({ registration: null });
    await expect(queueRegistrationEmail(deps, 'gone')).resolves.toBeNull();
    expect(jobs.size).toBe(0);
  });
});

describe('test recipient', () => {
  it('sends every e-mail outside production to EMAIL_TEST_RECIPIENT', async () => {
    const { deps, sent, jobs, runDeferred } = fakeDeps({ env: { ...ENV, NODE_ENV: 'development' } });
    const job = await queueRegistrationEmail(deps, 'reg-1');
    await runDeferred();
    expect(sent.map((m) => m.to)).toEqual(['test@codrin.space']);
    expect(jobs.get(job!.documentId)!.recipient).toBe('parinte@example.ro');
  });

  it('sends to the parent only in production with EMAIL_LIVE=true', async () => {
    const { deps, sent, runDeferred } = fakeDeps({ env: { ...ENV, NODE_ENV: 'production', EMAIL_LIVE: 'true' } });
    await queueRegistrationEmail(deps, 'reg-1');
    await runDeferred();
    expect(sent.map((m) => m.to)).toEqual(['parinte@example.ro']);
  });
});

describe('no Brevo key', () => {
  it('keeps the job queued, uncounted, and the cron does nothing', async () => {
    const { deps, jobs, sent, runDeferred, age } = fakeDeps({ env: { ...ENV, BREVO_API_KEY: '' } });
    const job = await queueRegistrationEmail(deps, 'reg-1');
    await runDeferred();
    age(job!.documentId);
    await expect(retryDueJobs(deps)).resolves.toEqual({ attempted: 0, skipped: 'no-key' });
    expect(jobs.get(job!.documentId)).toMatchObject({ status: 'queued', attempts: 0, lastError: null });
    expect(sent).toEqual([]);
  });

  it('sends the waiting job once a key is configured', async () => {
    const off = fakeDeps({ env: { ...ENV, BREVO_API_KEY: '' } });
    const job = await queueRegistrationEmail(off.deps, 'reg-1');
    await off.runDeferred();
    off.age(job!.documentId);
    const on = { ...off.deps, config: readEmailConfig(ENV) };
    await expect(retryDueJobs(on)).resolves.toEqual({ attempted: 1, skipped: null });
    expect(off.jobs.get(job!.documentId)).toMatchObject({ status: 'sent', attempts: 1 });
  });
});

describe('retries', () => {
  it('retries hourly and fails with one alert after 5 attempts', async () => {
    const { deps, jobs, alerts, runDeferred, age } = fakeDeps({ send: failing });
    const job = await queueRegistrationEmail(deps, 'reg-1');
    await runDeferred();
    for (let hour = 0; hour < 6; hour++) {
      age(job!.documentId);
      await retryDueJobs(deps);
    }
    expect(jobs.get(job!.documentId)).toMatchObject({ status: 'failed', attempts: 5, lastError: 'Brevo 500: down' });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain(job!.documentId);
    expect(alerts[0]).not.toContain('parinte@example.ro');
  });

  it('does not retry a job touched less than QUIET_MS ago', async () => {
    const { deps, jobs, runDeferred } = fakeDeps({ send: failing });
    const job = await queueRegistrationEmail(deps, 'reg-1');
    await runDeferred();
    expect(QUIET_MS).toBe(5 * 60_000);
    await expect(retryDueJobs(deps)).resolves.toEqual({ attempted: 0, skipped: null });
    expect(jobs.get(job!.documentId)!.attempts).toBe(1);
  });

  it('counts missing documents as a failed attempt', async () => {
    const { deps, jobs, sent, runDeferred } = fakeDeps({ documents: [] });
    const job = await queueRegistrationEmail(deps, 'reg-1');
    await runDeferred();
    expect(sent).toEqual([]);
    expect(jobs.get(job!.documentId)).toMatchObject({ status: 'queued', attempts: 1, lastError: 'no documents built for this registration' });
  });

  it('fails a job whose registration was deleted, without an alert', async () => {
    const { deps, alerts } = fakeDeps();
    const row: EmailJobRow = { documentId: 'job-x', recipient: 'p@example.ro', subject: 's', registrationDocumentId: null, status: 'queued', attempts: 2, lastError: null, sentAt: null, updatedAt: LONG_AGO };
    const updated = await attemptJob({ ...deps, jobs: { ...deps.jobs, update: async (_id, data) => ({ ...row, ...data }) } }, row);
    expect(updated).toMatchObject({ status: 'failed', attempts: 2, lastError: 'registration deleted' });
    expect(alerts).toEqual([]);
  });

  it('leaves sent and failed jobs alone', async () => {
    const { deps, sent } = fakeDeps();
    const row: EmailJobRow = { documentId: 'job-s', recipient: 'p@example.ro', subject: 's', registrationDocumentId: 'reg-1', status: 'sent', attempts: 1, lastError: null, sentAt: LONG_AGO, updatedAt: LONG_AGO };
    await expect(attemptJob(deps, row)).resolves.toBe(row);
    await expect(attemptJob(deps, { ...row, status: 'failed' })).resolves.toEqual({ ...row, status: 'failed' });
    expect(sent).toEqual([]);
  });
});

describe('resendRegistrationEmail', () => {
  it('logs a history entry, sends a new job now and returns the status', async () => {
    const { deps, history, sent, runDeferred } = fakeDeps();
    await queueRegistrationEmail(deps, 'reg-1');
    await runDeferred();
    const result = await resendRegistrationEmail(deps, 'reg-1', 'admin@edusport.ro');
    expect(history).toEqual([
      { subjectId: 'reg-1', action: RESEND_ACTION, actor: 'admin@edusport.ro', changes: { recipient: 'parinte@example.ro', documents: ['Pop_Maria_Acord_2026-2027.pdf', 'Pop_Maria_Adeziune_2026-2027.pdf'] } },
    ]);
    expect(sent).toHaveLength(2);
    expect(result).toEqual({
      ok: true,
      status: { status: 'sent', recipient: 'parinte@example.ro', attempts: 1, lastError: null, sentAt: NOW.toISOString(), updatedAt: NOW.toISOString(), documents: ['Pop_Maria_Acord_2026-2027.pdf', 'Pop_Maria_Adeziune_2026-2027.pdf'] },
    });
  });

  it('reuses a job that is still queued instead of adding a second one', async () => {
    const { deps, jobs, runDeferred } = fakeDeps({ send: failing });
    await queueRegistrationEmail(deps, 'reg-1');
    await runDeferred();
    await resendRegistrationEmail(deps, 'reg-1', 'admin@edusport.ro');
    expect(jobs.size).toBe(1);
    expect([...jobs.values()][0]).toMatchObject({ status: 'queued', attempts: 1 });
  });

  it('refuses an unknown registration and one without documents', async () => {
    await expect(resendRegistrationEmail(fakeDeps({ registration: null }).deps, 'x', 'a')).resolves.toEqual({ ok: false, code: 'not-found', error: RESEND_ERRORS['not-found'] });
    const empty = fakeDeps({ documents: [] });
    await expect(resendRegistrationEmail(empty.deps, 'reg-1', 'a')).resolves.toEqual({ ok: false, code: 'no-documents', error: RESEND_ERRORS['no-documents'] });
    expect(empty.history).toEqual([]);
  });

  it('with no key, logs the resend and leaves the job queued', async () => {
    const { deps, history, sent } = fakeDeps({ env: { ...ENV, BREVO_API_KEY: '' } });
    const result = await resendRegistrationEmail(deps, 'reg-1', 'admin@edusport.ro');
    expect(history).toHaveLength(1);
    expect(sent).toEqual([]);
    expect(result).toMatchObject({ ok: true, status: { status: 'queued', attempts: 0 } });
  });
});

describe('registrationEmailStatus', () => {
  it('reports none before any job, then the latest job', async () => {
    const { deps, runDeferred } = fakeDeps();
    await expect(registrationEmailStatus(deps, 'reg-1')).resolves.toMatchObject({ status: 'none', attempts: 0, recipient: 'parinte@example.ro' });
    await queueRegistrationEmail(deps, 'reg-1');
    await runDeferred();
    await expect(registrationEmailStatus(deps, 'reg-1')).resolves.toMatchObject({ status: 'sent', attempts: 1 });
  });

  it('is null for an unknown registration', async () => {
    await expect(registrationEmailStatus(fakeDeps({ registration: null }).deps, 'x')).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npm test -- src/email/__tests__/email-jobs.test.ts`
Expected: FAIL (cannot find module `../email-jobs`).

- [ ] **Step 3: Implement the flow**

`src/email/email-jobs.ts`:

```ts
/**
 * Registration e-mail jobs: queue, attempt, retry, resend, status.
 * Everything Strapi-, Brevo- or file-related comes in through `EmailDeps`, so the flow is
 * unit tested with fakes (src/email/__tests__/email-jobs.test.ts). Wiring: ./strapi-email.ts.
 */
import type { StoredDocument } from '../club/documents';
import type { Attachment, OutgoingEmail, SendResult } from './brevo';
import { blockedReason, deliveryTarget, type BlockedReason, type EmailConfig } from './config';
import { isDue, nextJobState, type AttemptOutcome, type EmailJobStatus, type JobState } from './job-state';
import { registrationSubject, renderRegistrationEmail, type EmailLinks } from './registration-template';

/** A job is not retried by the cron until it has been left alone this long (a first attempt may be running). */
export const QUIET_MS = 5 * 60_000;
export const RESEND_ACTION = 'email-resent';

export type EmailJobRow = {
  documentId: string;
  recipient: string;
  subject: string;
  registrationDocumentId: string | null;
  status: EmailJobStatus;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  updatedAt: string | null;
};
export type NewEmailJob = { recipient: string; subject: string; registrationDocumentId: string };
export type RegistrationForEmail = { email: string; childName: string; registrationNumber: string; seasonLabel: string };
export type JobUpdate = JobState & { recipient?: string; subject?: string };
export type RetrySummary = { attempted: number; skipped: BlockedReason | null };
export type HistoryNote = { subjectId: string; action: string; actor: string; changes: Record<string, unknown> };

export interface EmailJobStore {
  create(job: NewEmailJob): Promise<EmailJobRow>;
  update(documentId: string, data: JobUpdate): Promise<EmailJobRow>;
  findQueued(limit: number): Promise<EmailJobRow[]>;
  findLatest(registrationDocumentId: string): Promise<EmailJobRow | null>;
}

export interface EmailDeps {
  config: EmailConfig;
  jobs: EmailJobStore;
  loadRegistration(documentId: string): Promise<RegistrationForEmail | null>;
  listDocuments(registrationDocumentId: string): Promise<StoredDocument[]>;
  readDocument(document: StoredDocument): Promise<Buffer>;
  loadLinks(): Promise<EmailLinks>;
  send(message: OutgoingEmail): Promise<SendResult>;
  recordHistory(note: HistoryNote): Promise<void>;
  alert(message: string): void;
  log(level: 'info' | 'warn' | 'error', message: string): void;
  defer(task: () => Promise<void>): void;
  now(): Date;
}

export type RegistrationEmailStatus = {
  status: EmailJobStatus | 'none';
  recipient: string;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  updatedAt: string | null;
  documents: string[];
};

export type ResendResult =
  | { ok: true; status: RegistrationEmailStatus }
  | { ok: false; code: 'not-found' | 'no-documents'; error: string };

export const RESEND_ERRORS = {
  'not-found': 'Înscrierea nu a fost găsită.',
  'no-documents': 'Înscrierea nu are documente.',
} as const;

const message = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const RETRY_BATCH = 100;

async function attachmentsFor(deps: EmailDeps, documents: StoredDocument[]): Promise<Attachment[]> {
  return Promise.all(
    documents.map(async (d) => ({ name: d.fileName, content: (await deps.readDocument(d)).toString('base64') })),
  );
}

async function compose(deps: EmailDeps, registrationDocumentId: string, to: string): Promise<OutgoingEmail> {
  const registration = await deps.loadRegistration(registrationDocumentId);
  if (!registration) throw new Error('registration not found');
  const documents = await deps.listDocuments(registrationDocumentId);
  if (!documents.length) throw new Error('no documents built for this registration');
  const rendered = renderRegistrationEmail({
    childName: registration.childName,
    registrationNumber: registration.registrationNumber,
    seasonLabel: registration.seasonLabel,
    documents: documents.map((d) => d.kind),
    links: await deps.loadLinks(),
  });
  return { to, ...rendered, attachments: await attachmentsFor(deps, documents) };
}

async function tryOnce(deps: EmailDeps, registrationDocumentId: string, to: string): Promise<AttemptOutcome> {
  try {
    const result = await deps.send(await compose(deps, registrationDocumentId, to));
    return result.ok === true ? { ok: true } : { ok: false, error: result.error };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

/**
 * One delivery attempt for a queued job. Skipped (job unchanged) while e-mail cannot be sent here;
 * a job whose registration was deleted fails at once without an alert.
 */
export async function attemptJob(deps: EmailDeps, job: EmailJobRow): Promise<EmailJobRow> {
  if (job.status !== 'queued') return job;
  if (!job.registrationDocumentId) {
    return deps.jobs.update(job.documentId, { status: 'failed', attempts: job.attempts, lastError: 'registration deleted', sentAt: null });
  }
  const target = deliveryTarget(deps.config, job.recipient);
  if (target.ok === false) {
    deps.log('info', `[email-job] job ${job.documentId} stays queued: ${target.reason}`);
    return job;
  }
  const outcome = await tryOnce(deps, job.registrationDocumentId, target.to);
  const { alert, ...state } = nextJobState(job, outcome, deps.now());
  const updated = await deps.jobs.update(job.documentId, state);
  deps.log(state.status === 'sent' ? 'info' : 'warn', `[email-job] job ${job.documentId}: ${state.status} after attempt ${state.attempts}`);
  if (alert) deps.alert(`[email-job] registration e-mail failed after ${state.attempts} attempts (job ${job.documentId}): ${state.lastError}`);
  return updated;
}

/** Called by the submit flow once the documents are built: store the job, then try it right away (not awaited). */
export async function queueRegistrationEmail(deps: EmailDeps, registrationDocumentId: string): Promise<EmailJobRow | null> {
  const registration = await deps.loadRegistration(registrationDocumentId);
  if (!registration) {
    deps.log('warn', `[email-job] registration ${registrationDocumentId} not found, no e-mail queued`);
    return null;
  }
  const job = await deps.jobs.create({
    recipient: registration.email,
    subject: registrationSubject(registration.childName, registration.registrationNumber),
    registrationDocumentId,
  });
  deps.defer(async () => {
    await attemptJob(deps, job);
  });
  return job;
}

/** Hourly cron: one more attempt for every queued job left alone for QUIET_MS. Nothing happens while e-mail cannot be sent. */
export async function retryDueJobs(deps: EmailDeps): Promise<RetrySummary> {
  const skipped = blockedReason(deps.config);
  if (skipped) return { attempted: 0, skipped };
  const now = deps.now();
  const due = (await deps.jobs.findQueued(RETRY_BATCH)).filter((job) => isDue(job, now, QUIET_MS));
  for (const job of due) await attemptJob(deps, job);
  return { attempted: due.length, skipped: null };
}

function toStatus(registration: RegistrationForEmail, job: EmailJobRow | null, documents: StoredDocument[]): RegistrationEmailStatus {
  return {
    status: job ? job.status : 'none',
    recipient: registration.email,
    attempts: job?.attempts ?? 0,
    lastError: job?.lastError ?? null,
    sentAt: job?.sentAt ?? null,
    updatedAt: job?.updatedAt ?? null,
    documents: documents.map((d) => d.fileName),
  };
}

/** GET .../email-status: the latest job, the address a resend goes to and the documents it would carry. */
export async function registrationEmailStatus(deps: EmailDeps, registrationDocumentId: string): Promise<RegistrationEmailStatus | null> {
  const registration = await deps.loadRegistration(registrationDocumentId);
  if (!registration) return null;
  const [job, documents] = await Promise.all([deps.jobs.findLatest(registrationDocumentId), deps.listDocuments(registrationDocumentId)]);
  return toStatus(registration, job, documents);
}

/** A still-queued job is reused (fresh address and subject, counter reset); otherwise a new job. */
async function jobForResend(deps: EmailDeps, registrationDocumentId: string, registration: RegistrationForEmail): Promise<EmailJobRow> {
  const recipient = registration.email;
  const subject = registrationSubject(registration.childName, registration.registrationNumber);
  const latest = await deps.jobs.findLatest(registrationDocumentId);
  if (latest?.status === 'queued') {
    return deps.jobs.update(latest.documentId, { recipient, subject, status: 'queued', attempts: 0, lastError: null, sentAt: null });
  }
  return deps.jobs.create({ recipient, subject, registrationDocumentId });
}

/** POST .../resend-email: logged in Istoric, then one attempt now (awaited, so the admin sees the result). */
export async function resendRegistrationEmail(deps: EmailDeps, registrationDocumentId: string, actor: string): Promise<ResendResult> {
  const registration = await deps.loadRegistration(registrationDocumentId);
  if (!registration) return { ok: false, code: 'not-found', error: RESEND_ERRORS['not-found'] };
  const documents = await deps.listDocuments(registrationDocumentId);
  if (!documents.length) return { ok: false, code: 'no-documents', error: RESEND_ERRORS['no-documents'] };
  const job = await jobForResend(deps, registrationDocumentId, registration);
  await deps.recordHistory({
    subjectId: registrationDocumentId,
    action: RESEND_ACTION,
    actor,
    changes: { recipient: registration.email, documents: documents.map((d) => d.fileName) },
  });
  const attempted = await attemptJob(deps, job);
  return { ok: true, status: toStatus(registration, attempted, documents) };
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npm test -- src/email/__tests__/email-jobs.test.ts`
Expected: PASS (18 tests).

- [ ] **Step 5: Type-check, run everything, commit**

Run: `npx tsc --noEmit` and `npm test` (zero errors, all PASS).

```bash
git add src/email/email-jobs.ts src/email/__tests__/email-jobs.test.ts
git commit -m "feat(email): queue, retry and resend flow for registration e-mails"
```

---

### Task 7: Strapi wiring, GlitchTip alert, hourly cron

**Files:**
- Create: `src/email/strapi-email.ts`
- Modify: `src/sentry.ts` (append `captureMessage`), `config/cron-tasks.ts` (header comment, imports, new task), `config/server.ts` (comment above `cron`)
- Test: `src/email/__tests__/strapi-email.test.ts`, `src/email/__tests__/cron.test.ts`, `src/email/__tests__/sentry-message.test.ts`

**Interfaces:**
- Consumes: Task 5 UID `api::email-job.email-job` and generated types; Task 6 everything; Task 1 `readEmailConfig`; Task 2 `sendWithBrevo`; Task 4 `buildEmailLinks`; `recordHistory` (`src/club/history.ts`); plan 2D `listRegistrationDocuments(strapi, registrationDocumentId): Promise<StoredDocument[]>` from `src/club/documents`.
- Produces:
  - `buildEmailDeps(strapi: Core.Strapi, config?: EmailConfig): EmailDeps`
  - `enqueueRegistrationEmail(strapi: Core.Strapi, registrationDocumentId: string): Promise<void>` (cross-plan contract)
  - `retryRegistrationEmails(strapi: Core.Strapi): Promise<RetrySummary>`
  - `toJobRow(raw): EmailJobRow`
  - `captureMessage(message: string): void` in `src/sentry.ts`
  - cron task `registrationEmailRetry`, rule `30 * * * *`, tz `Europe/Bucharest` (minute 30, away from the Sheets pass at minute 0)
  - history entries: `subjectType: 'registration-submission'`, `action: 'email-resent'`, `changes: { recipient, documents: string[] }`

How the pieces are read: registration fields `email`, `childName`, `registrationNumber`, `season` (the Sezon label 2A stores at submit); documents through 2D's `listRegistrationDocuments`, and each file with `readFile(document.path)` (2D's `StoredDocument.path` is absolute); footer contact from `site-settings.contact`.

- [ ] **Step 1: Write the failing tests**

`src/email/__tests__/strapi-email.test.ts`:

```ts
import { expect, it } from 'vitest';
import { toJobRow } from '../strapi-email';

it('maps a stored job, with the registration documentId and ISO dates', () => {
  expect(
    toJobRow({
      documentId: 'job-1',
      recipient: 'parinte@example.ro',
      subject: 'Înscriere înregistrată: Maria Pop (nr. 2026-0008)',
      status: 'sent',
      attempts: 2,
      lastError: null,
      sentAt: new Date('2026-10-20T09:00:00.000Z'),
      updatedAt: '2026-10-20T09:00:01.000Z',
      registration: { documentId: 'reg-1' },
    }),
  ).toEqual({
    documentId: 'job-1',
    recipient: 'parinte@example.ro',
    subject: 'Înscriere înregistrată: Maria Pop (nr. 2026-0008)',
    registrationDocumentId: 'reg-1',
    status: 'sent',
    attempts: 2,
    lastError: null,
    sentAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-10-20T09:00:01.000Z',
  });
});

it('reads a job whose registration was deleted as having none', () => {
  expect(toJobRow({ documentId: 'job-2', registration: null })).toMatchObject({ registrationDocumentId: null, status: 'queued', attempts: 0, recipient: '' });
});
```

`src/email/__tests__/cron.test.ts`:

```ts
import { expect, it } from 'vitest';
import cronTasks from '../../../config/cron-tasks';

it('retries queued registration e-mails once an hour', () => {
  expect(cronTasks.registrationEmailRetry.options).toEqual({ rule: '30 * * * *', tz: 'Europe/Bucharest' });
  expect(typeof cronTasks.registrationEmailRetry.task).toBe('function');
});

it('keeps the Sheets reconcile task', () => {
  expect(cronTasks.sheetsReconcile.options.rule).toBe('0 * * * *');
});
```

`src/email/__tests__/sentry-message.test.ts`:

```ts
import { expect, it } from 'vitest';
import { captureMessage } from '../../sentry';

it('is inert without SENTRY_DSN', () => {
  expect(() => captureMessage('[email-job] test')).not.toThrow();
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm test -- src/email/__tests__/strapi-email.test.ts src/email/__tests__/cron.test.ts src/email/__tests__/sentry-message.test.ts`
Expected: FAIL (`../strapi-email` not found; `registrationEmailRetry` undefined; `captureMessage` is not a function).

- [ ] **Step 3: Add `captureMessage` to `src/sentry.ts`**

Append at the end of `src/sentry.ts`:

```ts
/**
 * Report a message (no exception object) as an error-level event. GlitchTip groups events by
 * message and alerts on a new issue, so callers keep personal data out of `message`.
 */
export function captureMessage(message: string): void {
  if (!initialized) return;
  try {
    Sentry.captureMessage(message, 'error');
  } catch {
    /* ignore */
  }
}
```

- [ ] **Step 4: Implement the wiring**

`src/email/strapi-email.ts`:

```ts
/**
 * The Strapi side of the registration e-mail: job store, registration and document reads,
 * Brevo, history, GlitchTip. The flow itself is in ./email-jobs.ts.
 */
import { readFile } from 'node:fs/promises';
import type { Core } from '@strapi/strapi';
import { listRegistrationDocuments } from '../club/documents';
import { recordHistory } from '../club/history';
import { captureMessage } from '../sentry';
import { sendWithBrevo } from './brevo';
import { readEmailConfig, type EmailConfig } from './config';
import {
  queueRegistrationEmail,
  retryDueJobs,
  type EmailDeps,
  type EmailJobRow,
  type EmailJobStore,
  type RegistrationForEmail,
  type RetrySummary,
} from './email-jobs';
import type { EmailJobStatus } from './job-state';
import { buildEmailLinks } from './links';

const JOB_UID = 'api::email-job.email-job' as const;
const REGISTRATION_UID = 'api::registration-submission.registration-submission' as const;
const SETTINGS_UID = 'api::site-settings.site-settings' as const;
const POPULATE: 'registration'[] = ['registration'];

type RawJob = {
  documentId: string;
  recipient?: string | null;
  subject?: string | null;
  status?: string | null;
  attempts?: number | null;
  lastError?: string | null;
  sentAt?: unknown;
  updatedAt?: unknown;
  registration?: { documentId?: string } | null;
};

const iso = (value: unknown): string | null =>
  value instanceof Date ? value.toISOString() : typeof value === 'string' && value ? value : null;

export function toJobRow(raw: RawJob): EmailJobRow {
  return {
    documentId: raw.documentId,
    recipient: raw.recipient ?? '',
    subject: raw.subject ?? '',
    registrationDocumentId: raw.registration?.documentId ?? null,
    status: (raw.status ?? 'queued') as EmailJobStatus,
    attempts: raw.attempts ?? 0,
    lastError: raw.lastError ?? null,
    sentAt: iso(raw.sentAt),
    updatedAt: iso(raw.updatedAt),
  };
}

function jobStore(strapi: Core.Strapi): EmailJobStore {
  const jobs = () => strapi.documents(JOB_UID);
  return {
    create: async (job) =>
      toJobRow(
        await jobs().create({
          data: { recipient: job.recipient, subject: job.subject, kind: 'registration', registration: job.registrationDocumentId, status: 'queued', attempts: 0 },
          populate: POPULATE,
        }),
      ),
    update: async (documentId, data) => toJobRow(await jobs().update({ documentId, data, populate: POPULATE })),
    findQueued: async (limit) =>
      (await jobs().findMany({ filters: { status: 'queued' }, sort: 'updatedAt:asc', limit, populate: POPULATE })).map(toJobRow),
    findLatest: async (registrationDocumentId) => {
      const rows = await jobs().findMany({ filters: { registration: { documentId: registrationDocumentId } }, sort: ['createdAt:desc', 'id:desc'], limit: 1, populate: POPULATE });
      return rows.length ? toJobRow(rows[0]) : null;
    },
  };
}

async function loadRegistration(strapi: Core.Strapi, documentId: string): Promise<RegistrationForEmail | null> {
  const r = await strapi.documents(REGISTRATION_UID).findOne({ documentId, fields: ['email', 'childName', 'registrationNumber', 'season'] });
  if (!r?.email || !r.registrationNumber) return null;
  return { email: r.email, childName: r.childName ?? '', registrationNumber: r.registrationNumber, seasonLabel: r.season ?? '' };
}

function deliver(config: EmailConfig): EmailDeps['send'] {
  return (message) =>
    config.apiKey && config.sender
      ? sendWithBrevo(message, { apiKey: config.apiKey, sender: config.sender, replyTo: config.replyTo })
      : Promise.resolve({ ok: false, error: 'e-mail not configured' });
}

export function buildEmailDeps(strapi: Core.Strapi, config: EmailConfig = readEmailConfig()): EmailDeps {
  return {
    config,
    jobs: jobStore(strapi),
    loadRegistration: (documentId) => loadRegistration(strapi, documentId),
    listDocuments: (documentId) => listRegistrationDocuments(strapi, documentId),
    readDocument: (document) => readFile(document.path),
    loadLinks: async () => buildEmailLinks(config, (await strapi.documents(SETTINGS_UID).findFirst({}))?.contact),
    send: deliver(config),
    recordHistory: (note) => recordHistory(strapi, { subjectType: 'registration-submission', ...note }),
    alert: (message) => {
      strapi.log.error(message);
      captureMessage(message);
    },
    log: (level, message) => strapi.log[level](message),
    defer: (task) => {
      setImmediate(() => task().catch((err) => strapi.log.error(`[email-job] attempt crashed: ${err instanceof Error ? err.message : String(err)}`)));
    },
    now: () => new Date(),
  };
}

/** Contract for the submit flow (plan 2D/2F): queue the registration e-mail after the documents are built. */
export async function enqueueRegistrationEmail(strapi: Core.Strapi, registrationDocumentId: string): Promise<void> {
  await queueRegistrationEmail(buildEmailDeps(strapi), registrationDocumentId);
}

/** Hourly cron entry (config/cron-tasks.ts). */
export function retryRegistrationEmails(strapi: Core.Strapi): Promise<RetrySummary> {
  return retryDueJobs(buildEmailDeps(strapi));
}
```

- [ ] **Step 5: Add the cron task**

In `config/cron-tasks.ts`, replace the end of the header comment and the first import:

```ts
 * own `lastReconcileAt`. A form set to 0 never runs the periodic pass.
 */
import { allForms } from '../src/sheets/registry';
```

with:

```ts
 * own `lastReconcileAt`. A form set to 0 never runs the periodic pass.
 *
 * `registrationEmailRetry` gives every queued registration e-mail one more attempt
 * per hour (src/email/email-jobs.ts); after 5 failed attempts a job is marked
 * `failed` and GlitchTip is alerted. Inert while Brevo is not configured: jobs
 * simply wait in the queue.
 */
import type { Core } from '@strapi/strapi';
import { retryRegistrationEmails } from '../src/email/strapi-email';
import { allForms } from '../src/sheets/registry';
```

Then add this entry after the `sheetsReconcile` entry, inside the exported object (before its closing `};`):

```ts
  registrationEmailRetry: {
    task: async ({ strapi }: { strapi: Core.Strapi }) => {
      try {
        const { attempted, skipped } = await retryRegistrationEmails(strapi);
        if (attempted) strapi.log.info(`[email-job][cron] ${attempted} queued e-mail(s) attempted`);
        if (skipped) strapi.log.debug(`[email-job][cron] skipped: ${skipped}`);
      } catch (err) {
        strapi.log.warn(`[email-job][cron] retry failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    options: {
      rule: '30 * * * *',
      tz: 'Europe/Bucharest',
    },
  },
```

In `config/server.ts`, replace the comment above `cron: {`:

```ts
  // Scheduled jobs (see config/cron-tasks.ts). Currently only the Google Sheets
  // reconcile pass, which is itself inert until a sheet is connected.
```

with:

```ts
  // Scheduled jobs (see config/cron-tasks.ts): the Google Sheets reconcile pass
  // and the registration e-mail retry. Both are inert until configured.
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `npm test -- src/email/__tests__/strapi-email.test.ts src/email/__tests__/cron.test.ts src/email/__tests__/sentry-message.test.ts`
Expected: PASS (2 + 2 + 1 tests).

- [ ] **Step 7: Type-check, run everything, commit**

Run: `npx tsc --noEmit` (zero errors; a mismatch between the `email-job` schema and `jobStore` shows up here, fix the code, never cast) and `npm test` (all PASS).

```bash
git add src/email/strapi-email.ts src/sentry.ts config/cron-tasks.ts config/server.ts \
  src/email/__tests__/strapi-email.test.ts src/email/__tests__/cron.test.ts src/email/__tests__/sentry-message.test.ts
git commit -m "feat(email): Strapi wiring, hourly retry and GlitchTip alert"
```

---

### Task 8: Admin routes (status and resend)

**Files:**
- Create: `src/api/email-job/controllers/email-job.ts`, `src/api/email-job/routes/02-admin.ts`, `src/utils/admin-actor.ts`
- Test: `src/email/__tests__/email-routes.test.ts`, `src/utils/__tests__/admin-actor.test.ts`

**Interfaces:**
- Consumes: Task 6 `registrationEmailStatus`, `resendRegistrationEmail`, `RESEND_ERRORS`; Task 7 `buildEmailDeps`.
- Produces (plan 2B calls these by exactly these paths):
  - `GET /api/club/registrations/:documentId/email-status` (admin): 200 `{ ok: true, data: RegistrationEmailStatus }`; 404 `{ ok: false, code: 'not-found', error }`.
  - `POST /api/club/registrations/:documentId/resend-email` (admin, no body): 200 `{ ok: true, data: RegistrationEmailStatus }` after one attempt (the status may be `queued` with `lastError` when Brevo failed or is not configured); 404 `not-found`; 409 `{ ok: false, code: 'no-documents', error: 'Înscrierea nu are documente.' }`. Every accepted resend writes a history entry `action: 'email-resent'`, `actor` = the admin's e-mail (fallback `admin`), `changes: { recipient, documents }`.
  - `actingAdminEmail(strapi, authorization: unknown): Promise<string | null>` in `src/utils/admin-actor.ts` (reads the admin JWT like `src/policies/is-admin.ts`; reusable by 2B for its history entries).

The confirmation popup in 2B ("names the recipient and the documents", spec 4.2) reads `recipient` and `documents` from the status route before calling the resend route.

- [ ] **Step 1: Write the failing tests**

`src/email/__tests__/email-routes.test.ts`:

```ts
import { expect, it } from 'vitest';
import adminRoutes from '../../api/email-job/routes/02-admin';

it('serves status and resend under /club/registrations, admin only', () => {
  expect(adminRoutes.routes.map((r) => `${r.method} ${r.path} ${r.handler}`)).toEqual([
    'GET /club/registrations/:documentId/email-status email-job.emailStatus',
    'POST /club/registrations/:documentId/resend-email email-job.resendEmail',
  ]);
  for (const route of adminRoutes.routes) expect(route.config).toEqual({ auth: false, policies: ['global::is-admin'], middlewares: [] });
});
```

`src/utils/__tests__/admin-actor.test.ts`:

```ts
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { actingAdminEmail } from '../admin-actor';

const SECRET = 'test-admin-secret';

function fakeStrapi(users: Record<string, string>) {
  return {
    config: { get: (key: string) => (key === 'admin.auth.secret' ? SECRET : undefined) },
    db: {
      query: () => ({
        findOne: async ({ where }: { where: { id: unknown } }) => (users[String(where.id)] ? { email: users[String(where.id)] } : null),
      }),
    },
  };
}

describe('actingAdminEmail', () => {
  it('reads the admin from the Bearer token', async () => {
    const token = jwt.sign({ userId: 3 }, SECRET);
    await expect(actingAdminEmail(fakeStrapi({ 3: 'ana@edusport.ro' }), `Bearer ${token}`)).resolves.toBe('ana@edusport.ro');
  });

  it('is null for a missing, foreign or unknown token', async () => {
    const strapi = fakeStrapi({ 3: 'ana@edusport.ro' });
    await expect(actingAdminEmail(strapi, undefined)).resolves.toBeNull();
    await expect(actingAdminEmail(strapi, `Bearer ${jwt.sign({ userId: 3 }, 'other')}`)).resolves.toBeNull();
    await expect(actingAdminEmail(strapi, `Bearer ${jwt.sign({ userId: 9 }, SECRET)}`)).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm test -- src/email/__tests__/email-routes.test.ts src/utils/__tests__/admin-actor.test.ts`
Expected: FAIL (`02-admin` and `../admin-actor` not found).

- [ ] **Step 3: Implement the admin actor**

`src/utils/admin-actor.ts`:

```ts
import jwt from 'jsonwebtoken';

type AdminLookup = {
  config: { get(key: string): unknown };
  db: { query(uid: 'admin::user'): { findOne(params: { where: { id: unknown }; select: string[] }): Promise<{ email?: unknown } | null> } };
};

function adminIdFrom(authorization: unknown, secret: unknown): unknown {
  const header = typeof authorization === 'string' ? authorization : '';
  if (!header.startsWith('Bearer ') || typeof secret !== 'string' || !secret) return null;
  const payload = jwt.verify(header.slice(7), secret);
  if (!payload || typeof payload !== 'object') return null;
  return payload.userId ?? payload.id ?? payload.sub ?? null;
}

/**
 * The e-mail of the admin behind an admin-guarded request (the admin JWT the CMS sends as a
 * Bearer token, carrying `userId`), for history entries. Null when it cannot be read.
 */
export async function actingAdminEmail(strapi: AdminLookup, authorization: unknown): Promise<string | null> {
  try {
    const id = adminIdFrom(authorization, strapi.config.get('admin.auth.secret'));
    if (!id) return null;
    const user = await strapi.db.query('admin::user').findOne({ where: { id }, select: ['email'] });
    return typeof user?.email === 'string' ? user.email : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Add the routes and the controller**

`src/api/email-job/routes/02-admin.ts`:

```ts
/**
 * Registration e-mail, admin only: status for the Înscrieri panel and "Retrimite e-mailul".
 * Content-API routes with auth off, guarded by `global::is-admin` like src/api/club/routes/02-admin.ts.
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/club/registrations/:documentId/email-status', handler: 'email-job.emailStatus', config: adminGuard },
    { method: 'POST', path: '/club/registrations/:documentId/resend-email', handler: 'email-job.resendEmail', config: adminGuard },
  ],
};
```

`src/api/email-job/controllers/email-job.ts`:

```ts
import { factories } from '@strapi/strapi';
import { RESEND_ERRORS, registrationEmailStatus, resendRegistrationEmail } from '../../../email/email-jobs';
import { buildEmailDeps } from '../../../email/strapi-email';
import { actingAdminEmail } from '../../../utils/admin-actor';

const FALLBACK_ACTOR = 'admin';

export default factories.createCoreController('api::email-job.email-job', ({ strapi }) => ({
  /** GET /api/club/registrations/:documentId/email-status (admin): 200 { ok, data } or 404. */
  async emailStatus(ctx) {
    const status = await registrationEmailStatus(buildEmailDeps(strapi), String(ctx.params.documentId ?? ''));
    if (!status) {
      ctx.status = 404;
      ctx.body = { ok: false, code: 'not-found', error: RESEND_ERRORS['not-found'] };
      return;
    }
    ctx.body = { ok: true, data: status };
  },

  /** POST /api/club/registrations/:documentId/resend-email (admin): logs Istoric, one attempt now. 200, 404 or 409. */
  async resendEmail(ctx) {
    const actor = (await actingAdminEmail(strapi, ctx.request.header.authorization)) ?? FALLBACK_ACTOR;
    const result = await resendRegistrationEmail(buildEmailDeps(strapi), String(ctx.params.documentId ?? ''), actor);
    if (result.ok === false) {
      ctx.status = result.code === 'not-found' ? 404 : 409;
      ctx.body = result;
      return;
    }
    ctx.body = { ok: true, data: result.status };
  },
}));
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npm test -- src/email/__tests__/email-routes.test.ts src/utils/__tests__/admin-actor.test.ts`
Expected: PASS (1 + 2 tests).

- [ ] **Step 6: Type-check, run everything, commit**

Run: `npx tsc --noEmit` and `npm test` (zero errors, all PASS).

```bash
git add src/api/email-job/controllers/email-job.ts src/api/email-job/routes/02-admin.ts src/utils/admin-actor.ts \
  src/email/__tests__/email-routes.test.ts src/utils/__tests__/admin-actor.test.ts
git commit -m "feat(email): admin e-mail status and resend routes"
```

---

### Task 9: Submit flow hook

**Files:**
- Create: `src/email/after-submit.ts`
- Modify: `src/api/registration-submission/controllers/registration-submission.ts` (imports, one line in `submitPublic`)
- Test: `src/email/__tests__/after-submit.test.ts`, `src/email/__tests__/no-email-on-edit.test.ts`

**Interfaces:**
- Consumes: Task 7 `enqueueRegistrationEmail(strapi, registrationDocumentId)`; plan 2D's `submitPublic`, which keeps 2A's result in `const saved = await submitRegistration(...)` (2D's `SubmitResult` success carries the internal `documentId`) and then calls `const result = await finishSubmit(saved, { ... })` to build the PDFs and the download token.
- Produces:
  - `type SavedRegistration = { ok: true; documentId: string } | { ok: false }` (2D's `SubmitResult` is assignable to it)
  - `queueEmailAfterSubmit(saved: SavedRegistration, enqueue: (registrationDocumentId: string) => Promise<void>, logError: (message: string) => void): Promise<void>`: queues only for a saved registration, never throws, logs `[inscriere] e-mail not queued for <documentId>: <message>`.
  - In `submitPublic`, right after `finishSubmit` (the PDFs are built), the e-mail is queued with `enqueueRegistrationEmail(strapi, saved.documentId)`; the response body is unchanged and never carries `documentId`. The edit path (`updateSubmission`, 2D) queues nothing.

The first delivery attempt is deferred inside `queueRegistrationEmail` (Task 6), so the submit only waits for the job row to be written, never for Brevo.

- [ ] **Step 1: Write the failing tests**

`src/email/__tests__/after-submit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { queueEmailAfterSubmit } from '../after-submit';

describe('queueEmailAfterSubmit', () => {
  it('queues the e-mail for a saved registration', async () => {
    const queued: string[] = [];
    await queueEmailAfterSubmit({ ok: true, documentId: 'reg-doc' }, async (id) => {
      queued.push(id);
    }, () => undefined);
    expect(queued).toEqual(['reg-doc']);
  });

  it('queues nothing for a refused submit', async () => {
    const queued: string[] = [];
    await queueEmailAfterSubmit({ ok: false }, async (id) => {
      queued.push(id);
    }, () => undefined);
    expect(queued).toEqual([]);
  });

  it('never throws when queueing fails, and logs it', async () => {
    const errors: string[] = [];
    const failing = async (): Promise<void> => {
      throw new Error('db down');
    };
    await expect(queueEmailAfterSubmit({ ok: true, documentId: 'reg-doc' }, failing, (m) => errors.push(m))).resolves.toBeUndefined();
    expect(errors).toEqual(['[inscriere] e-mail not queued for reg-doc: db down']);
  });
});
```

`src/email/__tests__/no-email-on-edit.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const controller = readFileSync(join(__dirname, '..', '..', 'api/registration-submission/controllers/registration-submission.ts'), 'utf8');
const method = (name: string, next: string) => controller.slice(controller.indexOf(`async ${name}(`), controller.indexOf(`async ${next}(`));

it('queues the e-mail once, in the public submit, after the documents', () => {
  expect(controller.match(/queueEmailAfterSubmit\(/g)).toHaveLength(1);
  const submit = method('submitPublic', 'list');
  expect(submit.indexOf('queueEmailAfterSubmit(')).toBeGreaterThan(submit.indexOf('finishSubmit('));
});

it('never e-mails from an admin edit (DECISIONS 2026-10-05)', () => {
  const edit = method('updateSubmission', 'deleteSubmission');
  expect(edit.length).toBeGreaterThan(0);
  expect(edit).not.toMatch(/queueEmailAfterSubmit|enqueueRegistrationEmail|resendRegistrationEmail/);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm test -- src/email/__tests__/after-submit.test.ts src/email/__tests__/no-email-on-edit.test.ts`
Expected: FAIL (`../after-submit` not found; "queues the e-mail once, in the public submit, after the documents" fails because the controller has no call yet). "never e-mails from an admin edit" already passes: it pins 2D's edit path.

- [ ] **Step 3: Implement the helper**

`src/email/after-submit.ts`:

```ts
/** The submit result as far as the e-mail needs it; plan 2D's `SubmitResult` (with its internal `documentId`) fits. */
export type SavedRegistration = { ok: true; documentId: string } | { ok: false };

/**
 * Called by `submitPublic` right after `finishSubmit` (the PDFs are built): queue the registration e-mail.
 * Never throws: a failure is logged and the parent's response is unchanged; the admin can resend.
 */
export async function queueEmailAfterSubmit(
  saved: SavedRegistration,
  enqueue: (registrationDocumentId: string) => Promise<void>,
  logError: (message: string) => void,
): Promise<void> {
  if (saved.ok === false) return;
  try {
    await enqueue(saved.documentId);
  } catch (err) {
    logError(`[inscriere] e-mail not queued for ${saved.documentId}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
```

- [ ] **Step 4: Call it from `submitPublic`**

In `src/api/registration-submission/controllers/registration-submission.ts`, under `import { buildSubmitDeps } from '../submit-deps';` add:

```ts
import { queueEmailAfterSubmit } from '../../../email/after-submit';
import { enqueueRegistrationEmail } from '../../../email/strapi-email';
```

In `submitPublic`, directly after the `finishSubmit` call that 2D added, which ends with

```ts
      logError: (message) => strapi.log.error(message),
    });
```

and before `ctx.status = result.ok ? 200 : 400;`, add:

```ts
    await queueEmailAfterSubmit(saved, (documentId) => enqueueRegistrationEmail(strapi, documentId), (message) => strapi.log.error(message));
```

The method then reads:

```ts
  async submitPublic(ctx) {
    const body = (ctx.request.body ?? {}) as Record<string, unknown>;
    const slug = typeof ctx.query.scoala === 'string' ? ctx.query.scoala : null;
    const saved = await submitRegistration(body, slug, buildSubmitDeps(strapi));
    const result = await finishSubmit(saved, {
      buildDocuments: (documentId) => buildRegistrationDocuments(strapi, documentId),
      createToken: (documentId) => createDownloadToken(documentId),
      logError: (message) => strapi.log.error(message),
    });
    await queueEmailAfterSubmit(saved, (documentId) => enqueueRegistrationEmail(strapi, documentId), (message) => strapi.log.error(message));
    ctx.status = result.ok ? 200 : 400;
    ctx.body = result;
  },
```

(2D's own lines in that method, such as the `submitBlockedReason` check at its start and the doc comment, stay as 2D wrote them.)

- [ ] **Step 5: Run the tests to see them pass**

Run: `npm test -- src/email/__tests__/after-submit.test.ts src/email/__tests__/no-email-on-edit.test.ts`
Expected: PASS (3 + 2 tests).

- [ ] **Step 6: Type-check, run everything, commit**

Run: `npx tsc --noEmit` (zero errors; `saved` type-checks against `SavedRegistration`) and `npm test` (all PASS).

```bash
git add src/email/after-submit.ts src/api/registration-submission/controllers/registration-submission.ts \
  src/email/__tests__/after-submit.test.ts src/email/__tests__/no-email-on-edit.test.ts
git commit -m "feat(inscrieri): queue the registration e-mail after the documents"
```

---

### Task 10: Boot check on a throwaway Postgres

**Files:** none changed (a check). Working files go in `.es2f/` at the repo root; delete it at the end.

**Interfaces:**
- Consumes: everything above, plans 2A, 2D and 2E merged.
- Produces: evidence that the schema boots, the cron registers, the submit queues a job, the admin routes are guarded and answer, and the Brevo, retry and alert paths behave on a real database. No real e-mail is sent: the addresses are `example.invalid` and the key is invalid.

- [ ] **Step 1: Start a throwaway database and build**

```bash
T="$PWD/.es2f"; mkdir -p "$T"
cat > "$T/env" <<'ENV'
DATABASE_CLIENT=postgres
DATABASE_HOST=127.0.0.1
DATABASE_PORT=55436
DATABASE_NAME=strapi
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=strapi
HOST=127.0.0.1
PORT=1342
APP_KEYS=throwawayA,throwawayB
API_TOKEN_SALT=throwaway
ADMIN_JWT_SECRET=throwaway
TRANSFER_TOKEN_SALT=throwaway
JWT_SECRET=throwaway
ENCRYPTION_KEY=throwaway
STRAPI_TELEMETRY_DISABLED=true
NODE_ENV=development
CMS_PUBLIC_URL=http://127.0.0.1:1342
EMAIL_FROM_ADDRESS=inscrieri@example.invalid
EMAIL_TEST_RECIPIENT=test@example.invalid
PRIVATE_FILES_DIR=/tmp/es2f-documents
ENV
docker run -d --name es2f-pg -e POSTGRES_USER=strapi -e POSTGRES_PASSWORD=strapi -e POSTGRES_DB=strapi -p 127.0.0.1:55436:5432 postgres:16
until docker exec es2f-pg pg_isready -U strapi >/dev/null 2>&1; do sleep 1; done
(set -a; . "$T/env"; set +a; npm run build)
```

Expected: the container starts, `npm run build` exits 0. (`PRIVATE_FILES_DIR` keeps 2D's PDFs out of the repo.)

- [ ] **Step 2: Start Strapi without a Brevo key**

```bash
(set -a; . "$T/env"; set +a; ./node_modules/.bin/strapi start > "$T/strapi.log" 2>&1 & echo $! > "$T/pid")
until curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:1342/_health | grep -q 204; do sleep 2; done
grep '\[cron\]' "$T/strapi.log"
docker exec es2f-pg psql -U strapi -d strapi -c '\d email_jobs' | grep -E 'recipient|attempts|last_error|sent_at'
curl -sI http://127.0.0.1:1342/email/edusport-header.png | grep -i -E '^HTTP|content-type'
```

Expected: `[cron] 4 scheduled task(s) registered: uploadWeekly, sendProjectInformation, sheetsReconcile, registrationEmailRetry`; the four columns exist; the header image answers `HTTP/1.1 200 OK` with `Content-Type: image/png`.

- [ ] **Step 3: Seed a season, a school, a price, an admin; submit a registration**

```bash
cat > "$T/fixture.js" <<'JS'
const { createStrapi, compileStrapi } = require('@strapi/strapi');
(async () => {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const d = (uid) => app.documents(uid);
  await d('api::site-settings.site-settings').create({ data: { registration: { open: true }, contact: { phone: '0723.623.712', email: 'edusporttrophy@gmail.com', whatsappChannelUrl: 'https://whatsapp.com/channel/test' } } });
  await d('api::season.season').create({ data: { label: '2026-2027', startMonth: '2026-10-01', endMonth: '2027-05-31', membershipFee: 270, isCurrent: true } });
  const school = await d('api::section.section').create({ data: { name: 'Școala de Patinaj', kind: 'school', slug: 'afi-cotroceni', publicPage: true } });
  await d('api::price-list.price-list').create({ data: { name: 'Standard', section: school.documentId, items: [
    { name: 'Abonament 8 ședințe grup', kind: 'subscription', sessions: 8, memberPrice: 770, nonMemberPrice: 890 },
  ] } });
  console.log('fixture ok');
  await app.destroy();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
JS
cat > "$T/body.json" <<'JSON'
{"email":"ana.pop@example.invalid","parentName":"Ana Pop","relationship":"parinte","phone":"0712345678",
 "childName":"Maria Pop","childBirthDate":"14.03.2016","childHeight":"132","shirtSize":"S",
 "lastSeason":"Nu a participat","priorExperience":"Nu este cazul","expectations":"Să învețe să patineze",
 "membershipAnswer":"da","subscriptionChoice":{"priceItemName":"Abonament 8 ședințe grup"},
 "source":"Facebook","gdprConsent":true,"regulationsConsent":true}
JSON
(set -a; . "$T/env"; set +a; node "$T/fixture.js")
(set -a; . "$T/env"; set +a; ./node_modules/.bin/strapi admin:create-user --firstname=Test --lastname=Admin --email=admin@example.invalid --password='Throwaway1!')
curl -s -X POST http://127.0.0.1:1342/api/forms/inscriere -H 'Content-Type: application/json' --data-binary @"$T/body.json"; echo
sleep 2
docker exec es2f-pg psql -U strapi -d strapi -tAc "select recipient, subject, kind, status, attempts, last_error from email_jobs"
```

Expected: `fixture ok`, `Successfully created new admin`, the submit answers `{"ok":true,"registrationNumber":"2026-0001",...}` (plus 2D's `downloadToken` and `documents`), and one job: `ana.pop@example.invalid|Înscriere înregistrată: Maria Pop (nr. 2026-0001)|registration|queued|0|` (no key: queued, 0 attempts, no error).

- [ ] **Step 4: Admin routes without a key**

```bash
REG=$(docker exec es2f-pg psql -U strapi -d strapi -tAc "select document_id from registration_submissions limit 1")
curl -s -o /dev/null -w 'no token: %{http_code}\n' http://127.0.0.1:1342/api/club/registrations/$REG/email-status
curl -s -X POST http://127.0.0.1:1342/admin/login -H 'Content-Type: application/json' -d '{"email":"admin@example.invalid","password":"Throwaway1!"}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).data.token))' > "$T/token"
AUTH="Authorization: Bearer $(cat "$T/token")"
curl -s http://127.0.0.1:1342/api/club/registrations/$REG/email-status -H "$AUTH"; echo
curl -s -w ' %{http_code}' http://127.0.0.1:1342/api/club/registrations/nu-exista/email-status -H "$AUTH"; echo
curl -s -X POST http://127.0.0.1:1342/api/club/registrations/$REG/resend-email -H "$AUTH"; echo
docker exec es2f-pg psql -U strapi -d strapi -tAc "select count(*), max(attempts), max(status) from email_jobs"
docker exec es2f-pg psql -U strapi -d strapi -tAc "select subject_type, action, actor, changes from history_entries where action = 'email-resent'"
```

Expected: `no token: 403`; the status `{"ok":true,"data":{"status":"queued","recipient":"ana.pop@example.invalid","attempts":0,"lastError":null,"sentAt":null,"updatedAt":"...","documents":[<2D's file names>]}}`; `{"ok":false,"code":"not-found","error":"Înscrierea nu a fost găsită."} 404`; the resend answers 200 with `status: "queued"`, still one job (`1|0|queued`, the queued job was reused); one history row `registration-submission|email-resent|admin@example.invalid|{"documents": [...], "recipient": "ana.pop@example.invalid"}`.

- [ ] **Step 5: A bogus key: real Brevo call, failed attempts**

```bash
kill "$(cat "$T/pid")"; sleep 3
(set -a; . "$T/env"; BREVO_API_KEY=xkeysib-invalid-throwaway; set +a; ./node_modules/.bin/strapi start > "$T/strapi2.log" 2>&1 & echo $! > "$T/pid")
until curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:1342/_health | grep -q 204; do sleep 2; done
curl -s -X POST http://127.0.0.1:1342/api/club/registrations/$REG/resend-email -H "$AUTH"; echo
curl -s -X POST http://127.0.0.1:1342/api/forms/inscriere -H 'Content-Type: application/json' --data-binary @"$T/body.json"; echo
sleep 3
docker exec es2f-pg psql -U strapi -d strapi -tAc "select subject, status, attempts, last_error from email_jobs order by id"
```

Expected: the resend answers 200 with `"attempts":1,"lastError":"Brevo 401: {\"message\":\"Key not found\",\"code\":\"unauthorized\"}"`; the second submit succeeds (`2026-0002`) and its deferred first attempt records the same error; both rows `queued|1|Brevo 401: ...`. (No network: the error reads `Brevo request failed: ...` instead; the rest holds.)

- [ ] **Step 6: The hourly retry, the quiet period and the alert**

```bash
cat > "$T/retry.js" <<'JS'
const { createStrapi, compileStrapi } = require('@strapi/strapi');
(async () => {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const tasks = require(process.cwd() + '/dist/config/cron-tasks').default;
  await tasks.registrationEmailRetry.task({ strapi: app });
  const { retryRegistrationEmails } = require(process.cwd() + '/dist/src/email/strapi-email');
  console.log('second tick:', JSON.stringify(await retryRegistrationEmails(app)));
  await app.destroy();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
JS
docker exec es2f-pg psql -U strapi -d strapi -tAc "update email_jobs set updated_at = now() - interval '2 hours'"
(set -a; . "$T/env"; BREVO_API_KEY=xkeysib-invalid-throwaway; set +a; node "$T/retry.js" 2>&1 | grep 'second tick')
docker exec es2f-pg psql -U strapi -d strapi -tAc "select status, attempts from email_jobs order by id"
docker exec es2f-pg psql -U strapi -d strapi -tAc "update email_jobs set attempts = 4, updated_at = now() - interval '2 hours'"
(set -a; . "$T/env"; BREVO_API_KEY=xkeysib-invalid-throwaway; set +a; node "$T/retry.js" 2>&1 | grep -E 'failed after|second tick')
docker exec es2f-pg psql -U strapi -d strapi -tAc "select status, attempts from email_jobs order by id"
```

Expected: first run `second tick: {"attempted":0,"skipped":null}` (the jobs it just tried are inside the 5-minute quiet period) and both jobs `queued|2`; second run prints two `[email-job] registration e-mail failed after 5 attempts (job ...): Brevo 401: ...` lines and both jobs `failed|5`.

- [ ] **Step 7: Clean up and re-run the suite**

```bash
kill "$(cat "$T/pid")"
docker rm -f es2f-pg
rm -rf "$T" /tmp/es2f-documents dist
npm test
npx tsc --noEmit
```

Expected: container removed; all tests PASS; zero type errors. No commit unless a check failed; a fix goes into the owning task's files with a `fix(email): ...` commit.

---

## Deliverability checklist (manual, outside the code, needs the club)

Done by the user with the club; nothing here is automated. Port 443 egress from the VM's containers is already allowed (`edusport-egress.service`), and ports 25/465/587 stay blocked: Brevo's HTTPS API needs no firewall change (DECISIONS 2026-10-03).

1. **Brevo account** (free plan, about 300 e-mails a day): create it with an address the club controls. Create a transactional API key (Brevo, SMTP & API, API keys). Store it only in the VM's `.env.production` as `BREVO_API_KEY` and in the local `.env` used for tests; never commit it.
2. **Test sender first (codrin.space):** in Brevo, add the domain `codrin.space` (Senders, Domains) and add exactly the DNS records Brevo shows (Brevo code TXT, DKIM, and the SPF include; if `codrin.space` already has an SPF TXT record, add the Brevo include to that one record, never a second SPF record; add a `_dmarc` TXT with `p=none` if none exists). Wait until Brevo shows the domain as authenticated. Add a sender on it (for example `inscrieri@codrin.space`).
3. **Local test send:** in the local `.env`: `BREVO_API_KEY`, `EMAIL_FROM_ADDRESS=<the codrin.space sender>`, `EMAIL_TEST_RECIPIENT=<your own Gmail>`, no `EMAIL_LIVE`. Submit a registration on the local form; the e-mail arrives at your Gmail, not at the address typed in the form. In Gmail, "Show original": SPF PASS, DKIM PASS, DMARC PASS. Check the header image loads, the PDFs open, the buttons work, and the phone layout (buttons stacked).
4. **mail-tester:** open mail-tester.com, copy its address into `EMAIL_TEST_RECIPIENT`, restart, submit again, open the result. Required: 9/10 or better. Fix what it lists (usually DNS) and repeat.
5. **Club domain (scoaladepatinaj.com, DNS at WordPress.com):** with the club, add the Brevo records for `scoaladepatinaj.com` the same way (one SPF record only, with the Brevo include merged in). Choose the sender with the club (the mockup shows `inscrieri@scoaladepatinaj.com`) and a reply-to inbox the club reads (for example `edusporttrophy@gmail.com`). Repeat steps 3 and 4 with this sender: Gmail SPF/DKIM/DMARC pass and mail-tester 9/10 or better.
6. **Go live on the VM:** in `.env.production` set `BREVO_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME=Școala de Patinaj EduSport`, `EMAIL_REPLY_TO`, `EMAIL_LIVE=true`; leave `EMAIL_TEST_RECIPIENT` empty. Deploy, then check `curl -sI https://cms.scoaladepatinaj.com/email/edusport-header.png` answers 200 `image/png`. `CMS_PUBLIC_URL=https://cms.scoaladepatinaj.com` must be set (plan 2E's deploy note; the e-mail builds the header image address from it). After the first real registration, `GET /api/club/registrations/<documentId>/email-status` shows `sent`.
7. **GlitchTip:** make sure the backend project has an alert rule that notifies someone on a new issue; the "registration e-mail failed after 5 attempts" message is only useful if it reaches a person. The project is chosen by the backend's `SENTRY_DSN`.
8. **Content:** the WhatsApp channel link is entered in Setări site, Contact, "Canal WhatsApp" (the same field the website and the success screen read; until then the e-mail has no WhatsApp button). The sign-off "Cu drag, Echipa Școlii de Patinaj EduSport" stays (user, F5).

## Handled by other plans

- 2B (admin): the Înscrieri panel shows the e-mail status (`GET .../email-status`) and the "Retrimite e-mailul" button with a confirmation naming `recipient` and `documents` (`POST .../resend-email`), and shows the history entry `email-resent` in Istoric. Labels and wording are 2B's (for example "E-mail retrimis").
- 2D (PDFs): builds and stores the documents, `listRegistrationDocuments`, the fonts in `assets/fonts`, `finishSubmit` and the `saved` variable in `submitPublic`, the edit path that rebuilds the PDF and sends no e-mail.
- 2E (Sheet): defines `CMS_PUBLIC_URL` (`.env.example`, `docker-compose.yml`, VM deploy note) and `cmsPublicUrl()`.

## Notes for later plans

- Other e-mails decided for later phases (DECISIONS 2026-10-19: portal invitation, password reset, login code, new-device login, "Plată înregistrată", schedule changes) can reuse `config.ts`, `brevo.ts`, `job-state.ts` and the queue: add a value to `email-job.kind`, a template module and a `queue...` function next to `queueRegistrationEmail`.
- `src/utils/admin-actor.ts` (`actingAdminEmail`) is a shared helper for "who did it" in history entries; `src/api/sheet-link/controllers/sheet-link.ts` has its own private copy that can switch to it in a later cleanup.
- The local `strapi_app` container reads env from `docker-compose.yml` only; to test e-mail locally, export the `EMAIL_*` and `BREVO_API_KEY` variables in the shell (or `.env` next to the compose file) before `docker compose up`.
