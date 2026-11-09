import type { Core } from '@strapi/strapi';
import { attemptScheduleChangeJobs } from '../../../email/strapi-email';
import { pingRevalidate } from '../../../utils/revalidate';
import type { ServiceContext } from '../../athletes/store';
import { strapiClubStore } from '../../athletes/strapi-store';
import { todayInBucharest } from '../../birth-date';
import type { GroupContext } from '../../groups/context';
import { todayIso } from '../../groups/http';
import { strapiGroupStore } from '../../groups/strapi-store';
import type { PresenceContext } from '../../presence/context';
import { strapiPresenceStore } from '../../presence/strapi-store';
import type { AdminResult } from '../../admin-result';
import type { PortalStore } from '../store';
import { nullCoachCompetitions, type CoachCompetitionSource } from './competitions';
import { strapiPortalStore } from '../strapi-store';

/** The coach of the request, as `global::is-coach` read it. `sessionId` is never put in an answer or a log. */
export type CoachState = { accountId: string; userId: number; sessionId: string; teamMemberId: string; name: string };

export type CoachContexts = {
  coach: CoachState; today: string; presence: PresenceContext; groups: GroupContext; club: ServiceContext; portal: PortalStore;
  /** Where competition results come from (a null source until phase 7-3 is merged). */
  competitions: CoachCompetitionSource;
};

/** A coach refusal the admin result has no status for: no right on the group. */
export type Forbidden = { ok: false; status: 403; error: string };
export type CoachResult<T> = AdminResult<T> | Forbidden;
export const forbidden = (error: string): Forbidden => ({ ok: false, status: 403, error });

/** Local clock time in Bucharest, `HH:mm`. */
export const clockOf = (d: Date): string => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);

/** Written on every history line a coach causes. */
export const coachActor = (name: string): string => `Antrenor ${name}`;

/** A fresh set per request: the portal store shares its transaction variable with nothing else. */
export function coachContexts(strapi: Core.Strapi, coach: CoachState): CoachContexts {
  const actor = coachActor(coach.name);
  const today = todayIso();
  const log = (message: string): void => { strapi.log.error(message); };
  const now = (): Date => new Date();
  return {
    coach, today,
    presence: { store: strapiPresenceStore(strapi), actor, today, now, log, paymentEmails: () => undefined },
    groups: {
      store: strapiGroupStore(strapi), actor, today, log, now,
      revalidate: () => { void pingRevalidate(); },
      emails: (changeKey) => attemptScheduleChangeJobs(strapi, changeKey),
    },
    club: { store: strapiClubStore(strapi), actor, today: todayInBucharest(), log },
    portal: strapiPortalStore(strapi),
    competitions: nullCoachCompetitions,
  };
}
