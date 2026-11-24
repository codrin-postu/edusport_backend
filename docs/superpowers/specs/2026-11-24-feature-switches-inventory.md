# Feature switches: inventory of touch points

Companion to `2026-11-24-feature-switches-design.md`. Gathered 2026-11-24 from backend `main` / `chore/env-cleanup` and frontend `feat/ghid` (worktree polish). Paths without prefix are backend; `FE/` is edusport_frontend. Line numbers are approximate; re-check in the plan.

## Portals today (chore/env-cleanup)
- Backend: `src/club/portal/auth/bff.ts:42-46` (`PORTAL_HOSTS()`, `portalsEnabled()`); `src/policies/portal-session.ts:30` (404); `src/api/portal/controllers/portal-auth.ts:21`; invites refused 409 in `club/portal/access/invite.ts:109,161` and `club/portal/accounts/invite.ts:69,99`; `src/email/email-jobs.ts:220` keeps portal jobs queued; `config/cron-tasks.ts:81-110` (`portalNotices`, `portalPurge`).
- Frontend: `FE/src/middleware.ts:15-16`, `FE/src/lib/portal/host.ts` (`PORTAL_HOST_ANTRENOR`, `PORTAL_HOST_SPORTIV`).

## prezenta
- Admin: menu `src/admin/dashboard/menu.tsx:154`, route ~308; phone menu `src/admin/MobileNav.tsx:171`; group tab `grupe/GroupPage.tsx:42,88`, `club/grupe/group-view.ts:7,18`; Tabele subjects `prezenta`, `sedinte` (`club/tables/types.ts:1`); `prezenta/PanelLinks.tsx`; presence history in `bani/PresenceHistory.tsx`; lessons and coach presence pages under `prezenta/`.
- Routes: `src/api/club/routes/09-attendance.ts:9-28` (`club`; coach CSVs `money`).
- Portal API: `src/api/portal/routes/02-coach.ts:16-17,29-37`; `04-sportiv.ts:21` (home presences), `:24` (history).
- Frontend coach: `(antrenor)/antrenor/(app)/prezenta/*`, `lectie/*`, `antrenament/nou`, `calendar/SessionSheet.tsx`, `grupe/[id]/GroupView.tsx`, `_lib/nav.ts`, `(app)/page.tsx`, `_ui/SessionRow.tsx`, `istoric/page.tsx`. Parent: `[athleteId]/page.tsx` presences card, `[athleteId]/istoric`. Allow-lists `FE/src/lib/portal/coach-routes.ts`, `sportiv-routes.ts`.
- Settings: `site-settings.attendanceStartDate`.

## abonamente
- Admin: menu Contabilitate `menu.tsx:155`; redirects `menu.tsx:335-338`; Tabele `menu.tsx:156` (area `money`), subjects `plati`, `abonamente`; record tabs `club/sportivi/record-view.ts:13,34,58-68`, `AthleteRecordPage.tsx:85-86`; Sportivi column and filter `club/sportivi/list-view.ts`, `AthleteTable.tsx`, `AthleteCards.tsx`; `grupe/MoveDialog.tsx`, `club/bani/move-bar.ts`; `prezenta/RowMoneyMenu.tsx`; folder `src/admin/dashboard/bani/*`. Delete refusal (`club/bani/delete-refusal.ts`) stays.
- Routes: `10-subscriptions.ts`, `11-payments.ts`, `13-tables.ts` (per subject), coach CSVs in `09-attendance.ts:18,27`.
- Portal API: `04-sportiv.ts:32-34` (`/money`, `/payments`, `/subscriptions`), home abonament card.
- Jobs: `payment` (`club/presence/strapi-store.ts:320`, `src/email/payment-email.ts`).
- Frontend parent: `[athleteId]/plati`, `_parts/AbonamentCard`, nav money item.
- Billing facts: memberships are session based (`subscription.slots`, `presence/subscriptions.ts`); `club_luna` and `lectie` billed from attendance (`presence/billing.ts`, `due/settlement.ts`).

## portalAntrenori
- Admin: `AccountBlock.tsx` in `MembriEchipaPage.tsx:341`, `grupe/GroupPage.tsx:58`.
- Routes: `12-portal-accounts.ts` (area `coachAccounts`); portal `02-coach.ts` (40 routes).
- Jobs: `portal-invite`. Crons shared with the parent portal.
- Frontend: all of `FE/src/app/(antrenor)/*`.

## portalParinti
- Admin: `sportivi/BulkInviteDialog.tsx`, `SportiviList.tsx` (BulkInviteBar), `sportivi/DateTab.tsx` + `AccessBlock.tsx`; Anunțuri portal option `AnuntEditPage.tsx`, `anunturi/PortalRecipients.tsx`, `AutoNoticeView.tsx`, `AnunturiPage.tsx`.
- Routes: `14-athlete-access.ts`; portal `04-sportiv.ts` (24 routes, notices included).
- Jobs: `portal-access`. Cron `portalNotices`.
- Frontend: all of `FE/src/app/(sportiv)/*`.
- Schedule-change e-mail does not depend on it (`club/groups/schedule-mail.ts`); opt-out `notifySchedule` lives in the portal account.

## parcurs
- Admin: record tab `parcurs` (`record-view.ts`, `AthleteRecordPage.tsx:95`, `sportivi/ParcursTab.tsx`).
- Routes: `05-athletes.ts:25-28`; portal `02-coach.ts:40-42`, `04-sportiv.ts:29-31`; possibly home level/promotion (`portal/sportiv/level.ts`).
- Computed on read (`club/parcurs/counted.ts`, `facts.ts`): attendance, competition results, membership anniversaries, manual awards and friendship pins. Merge and delete (`athletes/merge.ts`, `athletes/delete.ts`) and personal-data export keep handling it regardless of the switch.
- Frontend: coach `sportiv/[id]/ParcursSection.tsx`; parent `[athleteId]/parcurs`, nav path item.

## Gating and settings
- Areas: `src/club/admin-area.ts`, `src/policies/has-role.ts`, `club/roles/map.ts`; admin `src/admin/lib/useAreas.ts`, `AreaGate.tsx`, `visibleLinks` (`menu.tsx:202`), `club/dashboard-parts.ts`; pages `src/admin/pages/routes.ts`.
- Settings: `site-settings` single type (editable by Administrator club); navigation single type `pages[{key, enabled}]` is the closest existing switch pattern (`FE/src/lib/strapi-navigation.ts`).
EOF
git add docs/superpowers/specs && git commit -qm "docs: feature switches design and inventory" && git log --oneline -1