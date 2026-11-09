import type { AdminDeviceView, BackupBatch, CodeSent, MethodOn, PasskeyRegisterOptions, PasskeyRow, SecurityView, TotpStart } from '../../../club/security/api-types';

/** The admin fetch client's shape (Strapi's `useFetchClient`), so the calls are testable without the Strapi package. */
export type Client = {
  get: (url: string) => Promise<{ data: unknown }>;
  post: (url: string, data?: unknown) => Promise<{ data: unknown }>;
  put: (url: string, data?: unknown) => Promise<{ data: unknown }>;
  del: (url: string) => Promise<{ data: unknown }>;
};

/** One row of `GET /api/admin-auth/admins` (src/club/admin-login/security.ts `AdminListRow`; kept here so the admin bundle imports no server file). */
export type AdminListRow = { id: number; name: string; email: string; twoFactor: boolean; self: boolean };
export type Toast = { toast: string };

const BASE = '/api/admin-auth';
const enc = encodeURIComponent;

/** The admin Securitate routes (routes/02-security.ts, 03-admins.ts). Every answer is `{ data }`; refusals throw the client's error. */
export function createSecurityApi(client: Client) {
  const data = async <T>(p: Promise<{ data: unknown }>): Promise<T> => ((await p).data as { data: T }).data;
  return {
    view: () => data<SecurityView>(client.get(`${BASE}/me/security`)),
    totpStart: () => data<TotpStart>(client.post(`${BASE}/me/2fa/totp`, {})),
    totpConfirm: (code: string) => data<MethodOn>(client.post(`${BASE}/me/2fa/totp/confirm`, { code })),
    totpOff: () => data<Toast>(client.del(`${BASE}/me/2fa/totp`)),
    emailStart: () => data<CodeSent>(client.post(`${BASE}/me/2fa/email`, {})),
    emailConfirm: (code: string) => data<MethodOn>(client.post(`${BASE}/me/2fa/email/confirm`, { code })),
    emailOff: () => data<Toast>(client.del(`${BASE}/me/2fa/email`)),
    newCodes: () => data<BackupBatch>(client.post(`${BASE}/me/backup-codes`, {})),
    devices: () => data<AdminDeviceView[]>(client.get(`${BASE}/me/devices`)),
    disconnect: (id: string) => data<{ revokedCurrent: boolean }>(client.del(`${BASE}/me/devices/${enc(id)}`)),
    changePassword: (body: { current: string; password: string }) => data<Toast & { signedOut: boolean }>(client.post(`${BASE}/me/password`, body)),
    google: () => data<{ email: string | null }>(client.get(`${BASE}/me/google`)),
    unlinkGoogle: () => data<Toast>(client.del(`${BASE}/me/google`)),
    passkeyOptions: () => data<PasskeyRegisterOptions>(client.post(`${BASE}/me/passkeys/options`, {})),
    passkeyAdd: (response: unknown) => data<Toast & { passkey: PasskeyRow }>(client.post(`${BASE}/me/passkeys`, { response })),
    passkeyRename: (id: string, name: string) => data<Toast>(client.put(`${BASE}/me/passkeys/${enc(id)}`, { name })),
    passkeyDelete: (id: string) => data<Toast>(client.del(`${BASE}/me/passkeys/${enc(id)}`)),
    reauth: (body: { password: string } | { method: 'totp' | 'email' | 'backup'; code: string }) => data<{ ok: true }>(client.post(`${BASE}/me/reauth`, body)),
    admins: () => data<AdminListRow[]>(client.get(`${BASE}/admins`)),
    resetAdmin: (id: number) => data<Toast>(client.post(`${BASE}/admins/${id}/reset-2fa`, {})),
  };
}

export type SecurityApi = ReturnType<typeof createSecurityApi>;
