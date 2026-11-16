import type { AccessBlock } from '../portal/access/api-types';
import { ACCESS_ACTIONS, ACCESS_COPY } from '../portal/access/copy';

export type AccessAction = 'invite' | 'resend' | 'remove';

/** Buttons of the "Acces portal" block (spec 4.6): invite without a live access, resend while the account is invited, remove on a live access. */
export function accessActions(block: Pick<AccessBlock, 'state' | 'canInvite'>): AccessAction[] {
  if (block.state === 'invited') return ['resend', 'remove'];
  if (block.state === 'active' || block.state === 'disabled') return ['remove'];
  return block.canInvite ? ['invite'] : [];
}

export const ACCESS_LABELS: Record<AccessAction, string> = {
  invite: ACCESS_ACTIONS.invite,
  resend: ACCESS_ACTIONS.resend,
  remove: ACCESS_ACTIONS.remove,
};

/** Spec 4.4: the hint under the e-mail field while the edited value differs from the one holding the access. */
export function emailHint(draft: string, block: AccessBlock | null): string | null {
  if (!block || block.state === 'none' || block.email === null) return null;
  const next = draft.trim().toLowerCase();
  if (next === block.email.trim().toLowerCase()) return null;
  return next === '' ? ACCESS_COPY.stopHint : ACCESS_COPY.moveHint(draft.trim());
}
