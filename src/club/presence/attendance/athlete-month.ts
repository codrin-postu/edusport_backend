import type { AdminResult } from '../../admin-result';
import { PRESENCE_ERRORS } from '../copy/core';
import { isMonth, monthRange } from '../dates';
import type { PresenceStore } from '../store';
import { typesText } from './view';
import type { AthleteMonthRow } from './api-types';

/** The athlete's "Prezențe" month (spec 5.7): attendances of the month, newest first. */
export async function readAthleteMonth(store: PresenceStore, athleteId: string, month: unknown): Promise<AdminResult<AthleteMonthRow[]>> {
  if (!isMonth(month)) return { ok: false, status: 400, error: PRESENCE_ERRORS.invalid };
  if (!(await store.athlete(athleteId))) return { ok: false, status: 404, error: PRESENCE_ERRORS.notFound };
  const { from, to } = monthRange(month);
  const [atts, groups] = await Promise.all([store.attendances({ athleteId, from, to }), store.groups()]);
  const rows = atts
    .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
    .map((a): AthleteMonthRow => ({
      sessionId: a.sessionId, date: a.sessionDate, groupName: groups.find((g) => g.id === a.groupId)?.name ?? '', types: typesText(a),
      noSubscription: a.billing === 'fara_abonament',
    }));
  return { ok: true, data: rows };
}
