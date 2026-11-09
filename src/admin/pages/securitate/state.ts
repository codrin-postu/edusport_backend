import type { BackupBatch, MethodOn, SecurityView, TotpStart } from '../../../club/security/api-types';
import { SECURITY_COPY } from '../../../club/security/copy';
import type { SecurityApi } from './client';

export type Method = 'totp' | 'email';

/** What the 2FA section is showing under its rows. */
export type Panel =
  | { kind: 'idle' }
  | { kind: 'totp'; qrSvg: string; key: string }
  | { kind: 'email'; sentTo: string }
  | { kind: 'off'; method: Method; last: boolean }
  | { kind: 'regenerate' };

export type TwoFactorState = {
  view: SecurityView | null;
  panel: Panel;
  /** Backup codes on screen. Set only by a confirmed first method or a new batch; "Gata" sets it back to null. Never stored anywhere else. */
  codes: string[] | null;
  /** "Mai ai <n> coduri de rezervă." from the first read; the server clears it on that read, so it is shown once. */
  notice: number | null;
  /** The toast text of the last change (the page shows it as it dispatches). */
  toast: string | null;
};

export const INITIAL: TwoFactorState = { view: null, panel: { kind: 'idle' }, codes: null, notice: null, toast: null };

export type Action =
  | { type: 'view'; view: SecurityView; first?: boolean }
  | { type: 'panel'; panel: Panel }
  | { type: 'codes'; codes: string[] }
  | { type: 'codesDone' }
  | { type: 'toast'; toast: string };

export function reduce(state: TwoFactorState, a: Action): TwoFactorState {
  switch (a.type) {
    case 'view': return { ...state, view: a.view, notice: a.first ? a.view.backupNotice : state.notice };
    case 'panel': return { ...state, panel: a.panel };
    case 'codes': return { ...state, codes: a.codes };
    case 'codesDone': return { ...state, codes: null };
    case 'toast': return { ...state, toast: a.toast };
  }
}

export const apply = (state: TwoFactorState, actions: Action[]): TwoFactorState => actions.reduce(reduce, state);

const idle: Action = { type: 'panel', panel: { kind: 'idle' } };

/** Methods on, in the order of the page. The last one is the one whose removal turns 2FA off. */
export const methodsOn = (v: SecurityView): Method[] => [...(v.totp ? (['totp'] as const) : []), ...(v.emailCode ? (['email'] as const) : [])];
export const anyMethod = (v: SecurityView): boolean => methodsOn(v).length > 0;

/** Title of the turn-off confirmation: the last method names 2FA itself and the codes that go with it (6.2, 6.5). */
export function offTitle(method: Method, last: boolean): string {
  const C = SECURITY_COPY.twoFactor;
  return last ? C.turnOffLast : C.turnOff(method === 'totp' ? C.app : C.email);
}

export const askOff = (v: SecurityView, method: Method): Panel => ({ kind: 'off', method, last: methodsOn(v).length === 1 });

/** After a confirmed method or a turned-off one: a new read, the idle panel and the toast; a first method brings the backup codes. */
async function afterChange(api: SecurityApi, toast: string, codes: string[] | null): Promise<Action[]> {
  const view = await api.view();
  return [{ type: 'view', view }, idle, { type: 'toast', toast }, ...(codes ? ([{ type: 'codes', codes }] as Action[]) : [])];
}

const withCodes = (r: MethodOn, api: SecurityApi): Promise<Action[]> => afterChange(api, r.toast, r.backupCodes);

export async function startTotp(api: SecurityApi): Promise<Action[]> {
  const s: TotpStart = await api.totpStart();
  return [{ type: 'panel', panel: { kind: 'totp', qrSvg: s.qrSvg, key: s.key } }];
}

export async function confirmTotp(api: SecurityApi, code: string): Promise<Action[]> {
  return withCodes(await api.totpConfirm(code.trim()), api);
}

export async function startEmail(api: SecurityApi): Promise<Action[]> {
  return [{ type: 'panel', panel: { kind: 'email', sentTo: (await api.emailStart()).sentTo } }];
}

export async function confirmEmail(api: SecurityApi, code: string): Promise<Action[]> {
  return withCodes(await api.emailConfirm(code.trim()), api);
}

export async function turnOff(api: SecurityApi, method: Method): Promise<Action[]> {
  const r = await (method === 'totp' ? api.totpOff() : api.emailOff());
  return afterChange(api, r.toast, null);
}

export async function newBatch(api: SecurityApi): Promise<Action[]> {
  const b: BackupBatch = await api.newCodes();
  return afterChange(api, b.toast, b.backupCodes);
}

/** The codes as the downloaded text file: one per line (ruling 12). */
export const codesFile = (codes: string[]): string => `${codes.join('\n')}\n`;
export const CODES_FILE_NAME = 'edusport-coduri-de-rezerva.txt';

/** What a password change leads to: the toast, and whether this session ended too (the page then goes to `/login`). */
export function afterPassword(r: { toast: string; signedOut: boolean }): { toast: string; goTo: string | null } {
  return { toast: r.toast, goTo: r.signedOut ? '/login' : null };
}

/** The device's "2FA ținut minte până la" date, "6 nov 2026", or null. `until` is an ISO instant. */
export const untilDate = (until: string | null, format: (isoDate: string) => string): string | null => (until ? format(until.slice(0, 10)) : null);

/** A disconnected device that was this browser's own ends this session too: the page goes to `/login`. */
export const afterDisconnect = (r: { revokedCurrent: boolean }): string | null => (r.revokedCurrent ? '/login' : null);
