import { respond, type AdminCtx } from '../../admin-http';
import type { AdminResult } from '../../admin-result';
import type { DeleteOutcome } from '../../athletes/delete';
import { deleteBlockedText } from '../copy/lifecycle';

/** 200 `{ data: { documentId } }`, or 409 with the counts in `data` (plan 5-6 reads them) and the sentence as the error. */
export function respondDelete(ctx: AdminCtx, result: AdminResult<DeleteOutcome>): void {
  if (result.ok === false) return respond(ctx, result);
  if (result.data.deleted === true) return respond(ctx, { ok: true, data: { documentId: result.data.documentId } });
  const { payments, subscriptions } = result.data.blocked;
  ctx.status = 409;
  ctx.body = { data: { payments, subscriptions }, error: { status: 409, name: 'ClubAdminError', message: deleteBlockedText(payments, subscriptions) } };
}
