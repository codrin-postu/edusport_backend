# CLAUDE.md

This file provides guidance to Claude Code when working with the EduSport backend.

## Project Overview

EduSport backend — Strapi v5 CMS (v5.23.0) with PostgreSQL for a Romanian skating school (EduSport Reșița). Provides content management and REST API for the Next.js frontend.

## Development Commands

- `npm run dev` / `npm run develop` — Start Strapi in development mode
- `npm run build` — Build admin panel
- `npm run start` — Start production server
- `npm run seed:content` — Seed homepage/about content (runs via docker exec)
- `npm run seed:regulations` — Seed course regulations
- `npm run seed:pricing` — Seed pricing data
- `npm run seed:cursuri-page` — Seed courses page
- `docker-compose up --build` — Start full stack (Strapi + PostgreSQL)
- `docker-compose down` — Stop containers

## Architecture

### Directory Structure
- `src/api/` — Content type definitions (schema, controllers, routes, services)
- `src/components/` — Reusable Strapi components (shared, homepage, pricing, etc.)
- `src/plugins/` — Custom Strapi plugins
- `src/admin/` — Admin panel customization
- `scripts/` — Seed data scripts
- `config/` — Strapi configuration (database, server, admin, middlewares)
- `types/generated/` — Auto-generated TypeScript types

### Content Types
- `homepage` (singleType) — Landing page content with hero, registration, about components
- `article` — News/blog articles
- `competition` — Competition entries
- `course-regulations` — Course regulation documents
- `cursuri-page` — Courses page content
- `historic-page` — History page
- `history-milestone` — Timeline milestones
- `pricing` — Pricing plans
- `program-page` — Program schedule page
- `realizari-page` — Achievements page
- `site-settings` (singleType) — Global site configuration
- `team-member` — Team/staff members
- `team-page` — Team page layout

### Strapi v5 Patterns
- Content types use `schema.json` for field definitions
- Controllers/routes/services use factory pattern: `export default factories.createCoreController('api::name.name')`
- Components are namespaced: `{namespace}.{name}` (e.g., `homepage.hero`, `pricing.plan`)
- Single types vs collection types defined by `kind` in schema.json

### Component Namespaces
- `homepage` — Hero, registration, about sections
- `pricing` — Plan details, features
- `competition` — Competition-related components
- `cursuri` — Course-related components
- `regulations` — Regulation sections
- `shared` — Media, rich-text, SEO, disclaimer (cross-cutting)

## Code Style
- TypeScript with strict mode
- ESLint + Prettier
- Double quotes, semicolons, 2-space indentation

## Docker Development
- Strapi runs on port 1337
- PostgreSQL on port 5432
- Volumes for persistent data

## Multi-Agent Quality System

This project uses a multi-agent system for quality enforcement. Agents are in `.claude/agents/`:

- **orchestrator** — Master coordinator, analyzes tasks and delegates to specialized agents
- **developer** — Implements code following Strapi v5 patterns
- **reviewer** — Code quality analysis with structured findings
- **tester** — Test creation targeting 80% coverage
- **security** — OWASP-based security audit
- **performance** — Query efficiency and API performance
- **api-contract** — Cross-repo schema validation with frontend
- **dependency-audit** — Supply chain and dependency health
- **cicd** — GitHub Actions pipeline management
- **i18n** — Internationalization validation
- **database** — Database health and seed data validation

### Running Agents
```bash
claude --agent orchestrator "add a new content type for sponsors"
claude --agent reviewer          # reviews uncommitted changes
claude --agent api-contract      # validates schemas against frontend types
```

### Quality Rules
- Cyclomatic complexity < 10
- Functions < 30 lines
- No `any` types in TypeScript
- Target 80% test coverage
- All content types must have seed coverage

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
