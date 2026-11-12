import { refuse, type AdminResult } from '../../admin-result';
import type { PortalAuthContext, PortalResult } from '../auth/context';
import { PORTAL_ERRORS, PORTAL_TOASTS } from '../copy';
import { changePasswordFor, listDevicesFor, liveDevices, readPhone, revokeDeviceFor, type MeScope } from '../me-shared';
import type { PortalDevice, SportivMe } from './api-types';
import type { SportivContext } from './context';

const HOST = 'sportiv';
const NAME_MAX = 80;

/** The account, session and clock of the holder, as the shared settings code takes them. */
const scopeOf = (c: SportivContext): MeScope => ({
  portal: c.portal, accountId: c.holder.accountId, userId: c.holder.userId, sessionId: c.holder.sessionId, host: HOST, now: c.presence.now, actor: c.presence.actor,
});

/** Field by field: the account row carries more (google sub, status, team member) that never leaves. */
export async function readMe(c: SportivContext): Promise<SportivMe> {
  const account = await c.portal.account(c.holder.accountId);
  const user = await c.portal.user(c.holder.userId);
  if (!account || !user) throw new Error('sportiv me: account or user not found');
  return {
    email: account.email, name: account.name, phone: account.phone, hasPassword: user.passwordHash !== null, google: account.googleSub !== null,
    passwordChangedAt: account.passwordChangedAt, notifySchedule: account.notifySchedule, devices: (await liveDevices(scopeOf(c))).length,
  };
}

type Edit = { name?: string; phone?: string | null };

/** `name` (trimmed, 1 to 80 characters) and/or `phone`; any other key (the e-mail among them) is ignored. Null: not valid, a string: the refusal text. */
function readEdit(body: unknown): Edit | string | null {
  if (typeof body !== 'object' || body === null) return null;
  const edit: Edit = {};
  if ('name' in body) {
    const raw = (body as { name: unknown }).name;
    if (typeof raw !== 'string') return null;
    const name = raw.trim();
    if ([...name].length < 1 || [...name].length > NAME_MAX) return PORTAL_ERRORS.nameLength;
    edit.name = name;
  }
  if ('phone' in body) {
    const phone = readPhone(body);
    if (!phone) return null;
    edit.phone = phone.phone;
  }
  return 'name' in edit || 'phone' in edit ? edit : null;
}

export async function saveMe(c: SportivContext, body: unknown): Promise<AdminResult<{ toast: string }>> {
  const edit = readEdit(body);
  if (edit === null) return refuse(400, PORTAL_ERRORS.invalid);
  if (typeof edit === 'string') return refuse(400, edit);
  await c.portal.transaction(async () => {
    await c.portal.lockAccount(c.holder.accountId);
    await c.portal.updateAccount(c.holder.accountId, edit);
  });
  return { ok: true, data: { toast: PORTAL_TOASTS.saved } };
}

/** `{ schedule: boolean }`: the switch "E-mail la schimbări de program". */
export async function saveNotifications(c: SportivContext, body: unknown): Promise<AdminResult<{ toast: string }>> {
  const schedule = typeof body === 'object' && body !== null ? (body as { schedule?: unknown }).schedule : undefined;
  if (typeof schedule !== 'boolean') return refuse(400, PORTAL_ERRORS.invalid);
  await c.portal.transaction(async () => {
    await c.portal.lockAccount(c.holder.accountId);
    await c.portal.updateAccount(c.holder.accountId, { notifySchedule: schedule });
  });
  return { ok: true, data: { toast: PORTAL_TOASTS.saved } };
}

/** As login (count before compare): a wrong current password spends one of the 5 attempts of the e-mail. */
export const changePassword = (c: SportivContext & { auth: PortalAuthContext }, body: unknown): Promise<PortalResult<{ toast: string }>> => changePasswordFor(scopeOf(c), c.auth, body);

export const listDevices = (c: SportivContext, deviceKey: string | null): Promise<PortalDevice[]> => listDevicesFor(scopeOf(c), deviceKey);

export const revokeDevice = (c: SportivContext, deviceId: string): Promise<AdminResult<{ revokedCurrent: boolean }>> => revokeDeviceFor(scopeOf(c), deviceId);
