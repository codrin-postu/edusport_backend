import { refuse, type AdminResult } from '../../admin-result';
import type { PortalAuthContext, PortalResult } from '../auth/context';
import { PORTAL_ERRORS, PORTAL_TOASTS } from '../copy';
import { changePasswordFor, listDevicesFor, readPhone, revokeDeviceFor, type MeScope } from '../me-shared';
import type { CoachDevice, CoachMe } from './api-types';
import { coachActor, type CoachContexts } from './context';

const initialsOf = (name: string): string => {
  const words = name.split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words.slice(0, 1);
  return letters.map((w) => [...w][0] ?? '').join('').toUpperCase();
};

export async function readMe(c: CoachContexts): Promise<AdminResult<CoachMe>> {
  const account = await c.portal.account(c.coach.accountId);
  const user = await c.portal.user(c.coach.userId);
  if (!account || !user) return refuse(404, PORTAL_ERRORS.notFound);
  const name = c.coach.name;
  const [team, groups] = await Promise.all([c.presence.store.teamMembers(), c.presence.store.groups()]);
  const coaching = new Set(groups.flatMap((g) => g.coachIds));
  return {
    ok: true,
    data: {
      name, firstName: name.split(/\s+/)[0] ?? name, initials: initialsOf(name), email: account.email, phone: account.phone,
      hasPassword: user.passwordHash !== null, google: account.googleSub !== null,
      coachId: c.coach.teamMemberId, coachOptions: team.filter((t) => coaching.has(t.id)).map((t) => ({ id: t.id, name: t.name })),
    },
  };
}

const HOST = 'antrenor';

/** The account, session and clock of the coach, as the shared settings code takes them. */
const scopeOf = (c: CoachContexts): MeScope => ({
  portal: c.portal, accountId: c.coach.accountId, userId: c.coach.userId, sessionId: c.coach.sessionId, host: HOST, now: () => c.presence.now(), actor: coachActor(c.coach.name),
});

export async function saveMe(c: CoachContexts, body: unknown): Promise<AdminResult<{ toast: string }>> {
  const read = readPhone(body);
  if (!read) return refuse(400, PORTAL_ERRORS.invalid);
  await c.portal.transaction(async () => {
    await c.portal.lockAccount(c.coach.accountId);
    await c.portal.updateAccount(c.coach.accountId, { phone: read.phone });
  });
  return { ok: true, data: { toast: PORTAL_TOASTS.saved } };
}

/** As login (count before compare): a wrong current password spends one of the 5 attempts of the e-mail. */
export const changePassword = (c: CoachContexts & { auth: PortalAuthContext }, body: unknown): Promise<PortalResult<{ toast: string }>> => changePasswordFor(scopeOf(c), c.auth, body);

export async function listDevices(c: CoachContexts, deviceKey: string | null): Promise<AdminResult<CoachDevice[]>> {
  return { ok: true, data: await listDevicesFor(scopeOf(c), deviceKey) };
}

export const revokeDevice = (c: CoachContexts, deviceId: string): Promise<AdminResult<{ revokedCurrent: boolean }>> => revokeDeviceFor(scopeOf(c), deviceId);
