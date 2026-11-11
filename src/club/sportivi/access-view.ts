import type { AccessBlock } from '../portal/access/api-types';
import { ACCESS_ACTIONS, ACCESS_COPY } from '../portal/access/copy';
import { longDate } from '../presence/dates';

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

const STATE_WORD = { invited: ACCESS_COPY.invited, active: ACCESS_COPY.active, disabled: ACCESS_COPY.disabled } as const;

/** "Activ" or "Invitat" or "Cont dezactivat", with "Sportiv 18+" beside it for an adult. */
export function statusText(block: AccessBlock): string {
  if (block.state === 'none') return ACCESS_COPY.none;
  return block.adult ? `${STATE_WORD[block.state]}, ${ACCESS_COPY.adult}` : STATE_WORD[block.state];
}

/** "din 6 nov 2026", or empty when the date is unknown. */
export const sinceText = (since: string | null): string => (since ? `din ${longDate(since)}` : '');

/** Spec 4.4: the hint under the e-mail field while the edited value differs from the one holding the access. */
export function emailHint(draft: string, block: AccessBlock | null): string | null {
  if (!block || block.state === 'none' || block.email === null) return null;
  const next = draft.trim().toLowerCase();
  if (next === block.email.trim().toLowerCase()) return null;
  return next === '' ? ACCESS_COPY.stopHint : ACCESS_COPY.moveHint(draft.trim());
}
