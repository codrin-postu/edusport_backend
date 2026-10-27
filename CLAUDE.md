# CLAUDE.md

Guidance for Claude Code in the EduSport backend. Start of a session: read `docs/HANDOFF.md` (state of every phase, branches, open items).

## Project

Strapi 5.52.1 (TypeScript) on PostgreSQL for the EduSport skating club and school (Reșița). It serves the website (Next.js, repo `edusport_frontend`) and the club admin: registrations (Înscrieri), athletes (Sportivi), seasons, prices, documents, personal data, and from phase 4 groups and schedules.

## Where logic lives

- `src/club/**`: the rules. Pure TypeScript modules (planners, matching, copy strings, view models for the admin screens), tested with Vitest in `__tests__/` next to them. Subfolders: `athletes/` (store, confirm, undo, merge, delete, locks), `confirm/`, `documents/` (PDFs with pdfkit), `personal-data/` (3C export, anonymize, sweep), `sportivi/`, `deploy/` and `migrate/` (deploy planners). Phase 4 adds `src/club/groups/` and `src/club/grupe/`.
- `src/admin/**`: admin UI (React). Shared components in `src/admin/ui/` (tokens in `tokens.ts`, styles in `styles.ts`); screens in `src/admin/dashboard/` (`inscrieri/`, `sportivi/`) and `src/admin/pages/`. Vitest does not run in the admin bundle: admin components stay thin, their rules live in `src/club/**`, and they are pinned by source-reading tests in `src/club/__tests__/` (for example `ui-sheet.test.ts`).
- `src/api/**`: content types (`schema.json`), routes, controllers. Club admin API is `src/api/club/routes/0N-*.ts` + `controllers/`. Every admin route is `{ auth: false, policies: ['global::is-admin'] }`; anonymize and hiding the yearly review use `global::is-super-admin` (`src/policies/`, both through `src/club/admin-auth.ts`: access token of an active session, active admin).
- `scripts/`: seeds and the idempotent deploy migrations (`migrate-*.js`, CommonJS, read the compiled planners from `dist/src/club`).

## Store pattern

- Services take a store interface, never Strapi directly. `ClubStore` (`src/club/athletes/store.ts`) has the real `strapiClubStore` (`strapi-store.ts`) and the in-memory `__tests__/fake-store.ts`. Keep both in parity: every store method gets a fake implementation and a test (`fake-store.test.ts`, `strapi-store.test.ts`). Phase 4 follows the same pattern with `GroupStore`.
- Writes run inside `store.transaction(...)` (nested calls reuse the outer transaction). Row locks: always registrations first, then athletes, each set sorted by id (`lockAthletesWithRegistrations`, `src/club/athletes/locks.ts`); re-read rows after taking the lock.
- Work after the commit that must never fail the request (match refresh, history convenience, file and media cleanup) goes through `safely(work, log, what)` (`src/club/athletes/matches.ts`): logged, never thrown. Log no personal data (error codes, not file paths).

## Code rules (checked in review on every task)

- TypeScript, no `any` (Strapi UIDs: `UID.ContentType`). Single quotes, semicolons, 2-space indent (match the surrounding file). Functions under 30 lines, cyclomatic complexity under 10. No dead code, no comments that restate code.
- Admin UI uses only `src/admin/ui` components and tokens: colours `var(--theme-*)` / `var(--palette-*)`, radius `var(--ui-radius-*)`, no raw hex/rgb, no `--adm-` variables. `node scripts/admin-ui-check.mjs --strict` must exit 0.
- Visual rules: no dashed or dotted lines, no pills or circles (square marks; only the spinner is round), buttons and badges flat.
- Copy: Romanian UI text exactly as decided, terse, no em dash, no middle dot, no emoji, straight quotes "..." (never „ ” “). Missing copy is a question for the user, never invented.
- Commits: Conventional Commits, no AI attribution, never push, never commit `.env`.

## Commands

- Tests: `npm test` (= `npx vitest run`; one file: `npx vitest run src/club/athletes/__tests__/merge.test.ts`)
- Types, both: `npx tsc --noEmit` and `npx tsc --noEmit -p src/admin/tsconfig.json`
- Admin UI tokens: `node scripts/admin-ui-check.mjs --strict` (`--list` for line numbers)
- Build: `npm run build` (needed before any `migrate:*` script; they load `dist/`)
- Phase 3 deploy data: `npm run migrate:athletes -- --step=<step> [--apply]`, steps in order `athlete-name`, `profile-athletes`, `past-registrations`, `match-backfill`, `duplicates`, `status`. Dry run by default, one step per run, idempotent, no big transaction, actor `migrare`.
- Local environment (one only): Strapi on 1340 and the website on 3010, database container `edusport-test-pg` (127.0.0.1:55442), run from the worktrees `test-main` in both repos; admin login in `docs/HANDOFF.md`. The old `strapi_app` / `strapi_db` (1337 / 5432) is stopped, its data kept in its volume. Agents never modify the local environment except to update it on request; destructive checks use a throwaway Postgres they remove afterwards.

## Docs

- `docs/HANDOFF.md`: current state and how work is run.
- `docs/architecture/`: `10-spec.md` (whole system spec), `12-phase2-deploy-runbook.md`, `13-roadmap.md`, `09-open-items.md`, `diagrams/` (PlantUML + SVG; steps in `docs/architecture/README.md`).
- `docs/superpowers/specs/` (design per phase) and `docs/superpowers/plans/` (task plans per phase).
- Decisions: `edusport_frontend/docs/portal/DECISIONS.md` (index at the top; a later dated entry wins over specs, plans and mockups).

## Agents

`.claude/agents/` holds generic role prompts (orchestrator, developer, reviewer, tester, security, performance, api-contract, dependency-audit, cicd, i18n, database). The phase work does not use them: it runs subagent-driven per `docs/HANDOFF.md`.

<!-- dgc-policy-v11 -->
# Dual-Graph Context Policy

This project uses a local dual-graph MCP server for efficient context retrieval.

## MANDATORY: Always follow this order

1. **Call `graph_continue` first** — before any file exploration, grep, or code reading.

2. **If `graph_continue` returns `needs_project=true`**: call `graph_scan` with the
   current project directory (`pwd`). Do NOT ask the user.

3. **If `graph_continue` returns `skip=true`**: project has fewer than 5 files.
   Do NOT do broad or recursive exploration. Read only specific files if their names
   are mentioned, or ask the user what to work on.

4. **Read `recommended_files`** using `graph_read` — **one call per file**.
   - `graph_read` accepts a single `file` parameter (string). Call it separately for each
     recommended file. Do NOT pass an array or batch multiple files into one call.
   - `recommended_files` may contain `file::symbol` entries (e.g. `src/auth.ts::handleLogin`).
     Pass them verbatim to `graph_read(file: "src/auth.ts::handleLogin")` — it reads only
     that symbol's lines, not the full file.
   - Example: if `recommended_files` is `["src/auth.ts::handleLogin", "src/db.ts"]`,
     call `graph_read(file: "src/auth.ts::handleLogin")` and `graph_read(file: "src/db.ts")`
     as two separate calls (they can be parallel).

5. **Check `confidence` and obey the caps strictly:**
   - `confidence=high` -> Stop. Do NOT grep or explore further.
   - `confidence=medium` -> If recommended files are insufficient, call `fallback_rg`
     at most `max_supplementary_greps` time(s) with specific terms, then `graph_read`
     at most `max_supplementary_files` additional file(s). Then stop.
   - `confidence=low` -> Call `fallback_rg` at most `max_supplementary_greps` time(s),
     then `graph_read` at most `max_supplementary_files` file(s). Then stop.

## Token Usage

A `token-counter` MCP is available for tracking live token usage.

- To check how many tokens a large file or text will cost **before** reading it:
  `count_tokens({text: "<content>"})`
- To log actual usage after a task completes (if the user asks):
  `log_usage({input_tokens: <est>, output_tokens: <est>, description: "<task>"})`
- To show the user their running session cost:
  `get_session_stats()`

Live dashboard URL is printed at startup next to "Token usage".

## Rules

- Do NOT use `rg`, `grep`, or bash file exploration before calling `graph_continue`.
- Do NOT do broad/recursive exploration at any confidence level.
- `max_supplementary_greps` and `max_supplementary_files` are hard caps - never exceed them.
- Do NOT dump full chat history.
- Do NOT call `graph_retrieve` more than once per turn.
- After edits, call `graph_register_edit` with the changed files. Use `file::symbol` notation (e.g. `src/auth.ts::handleLogin`) when the edit targets a specific function, class, or hook.

## Context Store

Whenever you make a decision, identify a task, note a next step, fact, or blocker during a conversation, call `graph_add_memory`.

**To add an entry:**
```
graph_add_memory(type="decision|task|next|fact|blocker", content="one sentence max 15 words", tags=["topic"], files=["relevant/file.ts"])
```

**Do NOT write context-store.json directly** — always use `graph_add_memory`. It applies pruning and keeps the store healthy.

**Rules:**
- Only log things worth remembering across sessions (not every minor detail)
- `content` must be under 15 words
- `files` lists the files this decision/task relates to (can be empty)
- Log immediately when the item arises — not at session end

## Session End

When the user signals they are done (e.g. "bye", "done", "wrap up", "end session"), proactively update `CONTEXT.md` in the project root with:
- **Current Task**: one sentence on what was being worked on
- **Key Decisions**: bullet list, max 3 items
- **Next Steps**: bullet list, max 3 items

Keep `CONTEXT.md` under 20 lines total. Do NOT summarize the full conversation — only what's needed to resume next session.
