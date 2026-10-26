import { refuse, type AdminResult } from '../admin-result';
import { athleteChanges, isDataIncomplete, readAthleteInput, type AthleteStatus, type AthleteValues } from '../athlete-data';
import { HISTORY_ACTIONS, SUBJECT } from '../history-text';
import { ADMIN_ERRORS } from './errors';
import { refreshAllMatches, safely } from './matches';
import type { ServiceContext } from './store';

const NONE: AthleteValues = { name: null, birthDate: null, contactName: null, phone: null, email: null };

/** "Adaugă sportiv" after the search found nobody (spec 6.7): created "Activ" (3b s10). */
export async function addAthlete(ctx: ServiceContext, body: unknown): Promise<AdminResult<{ documentId: string }>> {
  const input = readAthleteInput(body, 'add');
  if (input.ok === false) return refuse(400, input.error);
  const { values } = input;
  const documentId = await ctx.store.transaction(async () => {
    const id = await ctx.store.createAthlete({ ...values, status: 'activ', dataIncomplete: isDataIncomplete(values) });
    await ctx.store.record({ subjectType: SUBJECT.athlete, subjectId: id, action: HISTORY_ACTIONS.created, changes: { fields: athleteChanges(NONE, values) }, actor: ctx.actor });
    return id;
  });
  await safely(() => refreshAllMatches(ctx.store), ctx.log, 'matches after adding an athlete');
  return { ok: true, data: { documentId } };
}

/** "Marchează inactiv" / "Marchează activ" (spec 6.6, gaps #36). */
export async function setAthleteStatus(ctx: ServiceContext, id: string, body: unknown): Promise<AdminResult<{ status: AthleteStatus }>> {
  const to = body && typeof body === 'object' ? (body as Record<string, unknown>).status : undefined;
  if (to !== 'activ' && to !== 'inactiv') return refuse(400, ADMIN_ERRORS.invalid);
  const athlete = await ctx.store.athlete(id);
  if (!athlete) return refuse(404, ADMIN_ERRORS.notFound);
  if (athlete.status !== to) {
    await ctx.store.transaction(async () => {
      await ctx.store.updateAthlete(id, { status: to });
      await ctx.store.record({ subjectType: SUBJECT.athlete, subjectId: id, action: HISTORY_ACTIONS.statusChanged, changes: { from: athlete.status, to }, actor: ctx.actor });
    });
  }
  await safely(() => refreshAllMatches(ctx.store), ctx.log, 'matches after changing an athlete status');
  return { ok: true, data: { status: to } };
}
