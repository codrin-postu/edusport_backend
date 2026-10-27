import { refuseWith, type AdminCtx } from '../../admin-http';
import { respondAction } from '../../groups/http';
import type { SaveOutcome } from './save';

/** The save's answer: the inactive 409 carries the athletes to ask about (decided 2); everything else is a plain action answer. */
export function respondSave(ctx: AdminCtx, outcome: SaveOutcome): void {
  if (outcome.ok === false && 'inactive' in outcome) {
    refuseWith(ctx, outcome.status, outcome.error);
    ctx.body = { data: null, error: { status: outcome.status, name: 'ClubAdminError', message: outcome.error, details: { inactive: outcome.inactive } } };
    return;
  }
  respondAction(ctx, outcome);
}
