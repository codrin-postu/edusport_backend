import { refuse, type AdminResult } from '../admin-result';
import { HISTORY_ACTIONS, SUBJECT } from '../history-text';
import type { MoveSchoolResponse } from './api-types';
import { ADMIN_ERRORS } from './errors';
import type { SectionRow, ServiceContext } from './store';

/**
 * "Mută la altă școală" (spec 3.6): only with 2+ schools, only before confirmation; the number and the frozen
 * subscription choice stay (gaps #27); no PDF rebuild; Istoric "Mutată la <școală>".
 *
 * `skipped` in the response counts only rows skipped because they are already confirmed/linked ("deja confirmate").
 * A row already in the target school, or an id that does not exist, is silently not moved but not counted here.
 *
 * Each row moves inside its own `transaction` + `lockRegistration`, re-reading the row once locked (same shape as
 * `confirm-service.ts`/`undo-service.ts`), so a registration confirmed concurrently is seen as linked and skipped,
 * never moved. A row whose write throws is logged and left unmoved without blocking the rest of the batch
 * (`season-move.ts`'s per-row try/catch); if every row in the batch failed, the whole call answers 500.
 */
const MAX_BULK_IDS = 500;

export function schoolSections(sections: SectionRow[]): SectionRow[] {
  return sections.filter((s) => s.kind === 'school' && s.publicPage).sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
}

export function readMoveSchool(body: unknown): { ids: string[]; sectionId: string } | null {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const ids = Array.isArray(b.documentIds) ? b.documentIds.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];
  const sectionId = typeof b.sectionId === 'string' ? b.sectionId.trim() : '';
  if (!ids.length || !sectionId || ids.length > MAX_BULK_IDS) return null;
  return { ids, sectionId };
}

type LockedOutcome = 'moved' | 'confirmed' | 'skip';
type MoveOutcome = LockedOutcome | 'failed';

async function moveLocked(ctx: ServiceContext, id: string, target: SectionRow): Promise<LockedOutcome> {
  await ctx.store.lockRegistration(id);
  const reg = await ctx.store.registration(id);
  if (!reg) return 'skip';
  if (reg.athleteId) return 'confirmed';
  if (reg.sectionId === target.id) return 'skip';
  await ctx.store.updateRegistration(id, { sectionId: target.id });
  await ctx.store.record({ subjectType: SUBJECT.registration, subjectId: id, action: HISTORY_ACTIONS.schoolMoved, changes: { schoolName: target.name }, actor: ctx.actor });
  return 'moved';
}

async function moveOne(ctx: ServiceContext, id: string, target: SectionRow): Promise<MoveOutcome> {
  try {
    return await ctx.store.transaction(() => moveLocked(ctx, id, target));
  } catch (err) {
    ctx.log(`[school-move] moving ${id} to ${target.name} failed: ${err instanceof Error ? err.message : String(err)}`);
    return 'failed';
  }
}

export async function moveToSchool(ctx: ServiceContext, ids: string[], sectionId: string): Promise<AdminResult<MoveSchoolResponse>> {
  const schools = schoolSections(await ctx.store.sections());
  const target = schools.find((s) => s.id === sectionId);
  if (schools.length < 2 || !target) return refuse(400, ADMIN_ERRORS.invalid);
  let moved = 0;
  let skipped = 0;
  let failed = 0;
  for (const id of ids) {
    const outcome = await moveOne(ctx, id, target);
    if (outcome === 'moved') moved += 1;
    else if (outcome === 'confirmed') skipped += 1;
    else if (outcome === 'failed') failed += 1;
  }
  if (ids.length > 0 && failed === ids.length) return refuse(500, ADMIN_ERRORS.failed);
  return { ok: true, data: { moved, skipped } };
}
