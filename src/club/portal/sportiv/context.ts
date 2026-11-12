import type { Core } from '@strapi/strapi';
import type { ServiceContext } from '../../athletes/store';
import { strapiClubStore, transactionScope } from '../../athletes/strapi-store';
import { todayInBucharest } from '../../birth-date';
import { strapiSessionPort, type GroupContext } from '../../groups/context';
import { todayIso } from '../../groups/http';
import { strapiGroupStore } from '../../groups/strapi-store';
import type { PresenceContext } from '../../presence/context';
import { strapiPresenceStore } from '../../presence/strapi-store';
import { pingRevalidate } from '../../../utils/revalidate';
import { attemptScheduleChangeJobs } from '../../../email/strapi-email';
import type { AccessStore } from '../access/store';
import { strapiAccessStore } from '../access/strapi-store';
import type { PortalStore } from '../store';
import { strapiPortalStore } from '../strapi-store';
import { nullSportivCompetitions, type SportivCompetitionSource } from './competitions';
import type { HolderState } from './holder';

export type SportivContext = {
  holder: HolderState; today: string; presence: PresenceContext; groups: GroupContext; club: ServiceContext; portal: PortalStore; access: AccessStore;
  /** Where competition results come from (a null source until phase 7-3 is merged). */
  competitions: SportivCompetitionSource;
};

/** Written on every history line a holder causes. */
const SPORTIV_ACTOR = 'Portal sportiv';

/** A fresh set per request: the portal and access stores share one transaction scope and nothing else does. */
export function sportivContext(strapi: Core.Strapi, holder: HolderState): SportivContext {
  const actor = SPORTIV_ACTOR;
  const today = todayIso();
  const log = (message: string): void => { strapi.log.error(message); };
  const now = (): Date => new Date();
  const scope = transactionScope(strapi);
  return {
    holder, today,
    presence: { store: strapiPresenceStore(strapi), actor, today, now, log, paymentEmails: () => undefined },
    groups: {
      store: strapiGroupStore(strapi), actor, today, log, now,
      revalidate: () => { void pingRevalidate(); },
      emails: (changeKey) => attemptScheduleChangeJobs(strapi, changeKey),
      sessions: strapiSessionPort(strapi),
    },
    club: { store: strapiClubStore(strapi), actor, today: todayInBucharest(), log },
    portal: strapiPortalStore(strapi, scope),
    access: strapiAccessStore(strapi, scope),
    competitions: nullSportivCompetitions,
  };
}
