# 07. Mapping to Strapi content types

Status (phase 1, branch `feat/club-foundation`): new types created; `sportsperson` kept under its current API name and linked one-to-one from `athlete` (rename later); migration script `npm run migrate:club` (dry run) / `-- --apply`.

What exists today, what changes, what is new. Facts from the code inventory (2026-10-11).

## Changes to existing types

| Today | Becomes | Change |
|---|---|---|
| `sportsperson` (public fields) | `public-profile` | Renamed; becomes the optional part of Athlete (0..1). Only this table is served to the website. |
| (none) | `athlete` | New main record per person, private data. |
| `team-member` | `team-member` | `groups` (json text) replaced by a relation to Group; optional link to a portal account. |
| `registration-submission` | same | Add `registrationNumber`, relation to `season` (today a string), relation to `athlete` (set on confirm). |
| `calendar-event` | same | Add optional relation to `group`. Only group events produce sessions. |
| `calendar-blackout` | same | Unchanged. Needs an admin screen (none today). |
| `program.scheduleGroups` | removed | Course series list derived from groups and their events. |
| `pricing` | `price-list` + `price-item` | Website Prețuri page reads Skating School lists; `footerNotes` stay as page text. |
| `site-settings.registration` | same + `season` | `open` stays; `currentSeason`, `seasonStartDate`, `seasonEndDate` move to `season`. |
| `users-permissions.user` | same | Roles Coach and Parent (if decided, see below). |

## New types

`season`, `group`, `membership`, `session`, `individual-lesson`, `attendance`,
`price-list`, `price-item`, `subscription`, `payment`, `document-type`, `document`,
`parent-access`, `history-entry`.

## Unchanged

`form-config`, `sheet-link`, `sheet-sync-log`, `competition`, `discipline`, and all website-content types.

## Data migrations (one-time)

1. Seasons: one `season` per distinct registration season, current one from site settings.
2. Groups: from `program.scheduleGroups` and `team-member.groups` text; similar names merged (e.g. "Intermediar Silver" / "Intermediari Silver"); admin reviews.
3. Athletes: one per existing `sportsperson` (about 60), flagged "Date incomplete".
4. Registration numbers: backfilled per season in `submittedAt` order.
5. Price lists: from today's `pricing` tiers.
6. Calendar: Skating School series events linked to their groups.
