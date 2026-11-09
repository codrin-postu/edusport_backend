import {
  generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse,
  type AuthenticationResponseJSON, type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import type { PortalResult } from '../portal/auth/context';
import { PORTAL_ERRORS } from '../portal/copy';
import type { PasskeyLoginOptions, PasskeyRegisterOptions, PasskeyRow as PasskeyRowView } from './api-types';
import { packMac, tokenMac } from './code-mac';
import { keysOrRefusal, type SecurityContext } from './context';
import { SECURITY_ACTIONS, SECURITY_ERRORS } from './copy';
import { safeMail } from './factors';
import type { Keys } from './keys';
import type { ChallengePurpose, ChallengeRow, PasskeyRow, Subject, SubjectType } from './store';

export type RpConfig = { rpId: string; origins: string[] };
export type PasskeyOwner = { subject: Subject; userHandle: string; userName: string };
export type PasskeyLogin = { subject: Subject; passkeyId: string };

export const PASSKEY_LIMIT = 10;
export const PASSKEY_CHALLENGE_TTL_MS = 300_000;
export const PASSKEY_NAME_MAX = 60;
const RP_NAME = 'EduSport';
const ALGORITHMS = [-7, -257];

/** `WEBAUTHN_RP_ID` and the exact origin list `WEBAUTHN_ORIGINS`; null when either is missing or an origin is a wildcard (routes answer 503). */
export function rpConfig(env: NodeJS.ProcessEnv = process.env): RpConfig | null {
  const rpId = env.WEBAUTHN_RP_ID?.trim();
  const origins = (env.WEBAUTHN_ORIGINS ?? '').split(',').map((o) => o.trim()).filter((o) => o !== '');
  if (!rpId || origins.length === 0 || origins.some((o) => o.includes('*'))) return null;
  return { rpId, origins };
}

const refuse = (status: 400 | 401 | 404 | 409, error: string): PortalResult<never> => ({ ok: false, status, error });
const failed = refuse(401, SECURITY_ERRORS.passkeyFailed);
const sameSubject = (a: Subject, b: Subject): boolean => a.type === b.type && a.id === b.id;

const view = (p: PasskeyRow, rp: RpConfig): PasskeyRowView => ({ id: p.id, name: p.name, createdAt: p.createdAt, lastUsedAt: p.lastUsedAt, old: p.rpId !== rp.rpId });

async function openChallenge(c: SecurityContext, keys: Keys, purpose: ChallengePurpose, subject: Subject | null, challenge: string): Promise<string> {
  await c.store.createChallenge({
    purpose, subject, secretMac: packMac(tokenMac(keys.code, challenge)), data: {},
    expiresAt: new Date(c.now().getTime() + PASSKEY_CHALLENGE_TTL_MS).toISOString(),
  });
  return challenge;
}

const asRecord = (v: unknown): Record<string, unknown> | null => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** The challenge the browser signed, read from `clientDataJSON` (it is only a lookup key: the library checks it again against the stored value). */
function signedChallenge(response: unknown): string | null {
  const inner = asRecord(asRecord(response)?.response);
  const raw = inner?.clientDataJSON;
  if (typeof raw !== 'string' || raw.length > 4096) return null;
  try {
    const data = asRecord(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')));
    return typeof data?.challenge === 'string' ? data.challenge : null;
  } catch {
    return null;
  }
}

/**
 * Finds the challenge row of the purpose by the MAC of the signed value (current or old key), checks purpose, owner and expiry, and uses it up by one
 * guarded UPDATE before anything is verified, so a challenge never serves two attempts and a failed attempt does not leave it open.
 */
async function takeChallenge(c: SecurityContext, keys: Keys, purpose: ChallengePurpose, subject: Subject | null, challenge: string): Promise<boolean> {
  let row: ChallengeRow | null = null;
  for (const key of [keys.code, keys.codeOld]) {
    if (!key || row) continue;
    row = await c.store.challengeByMac(packMac(tokenMac(key, challenge)));
  }
  if (!row || row.purpose !== purpose || row.usedAt !== null || Date.parse(row.expiresAt) <= c.now().getTime()) return false;
  if (subject !== null && (row.subject === null || !sameSubject(row.subject, subject))) return false;
  return c.store.consumeOnce('challenge', row.id, c.now().toISOString());
}

/** Library messages can echo client-controlled text (origin, challenge, type): control characters are stripped so a line cannot be forged. */
const logFailure = (c: SecurityContext, what: string, err: unknown): void =>
  c.log(`[passkey] ${what} refused: ${err instanceof Error ? err.message.slice(0, 200).replace(/[\u0000-\u001f\u007f]/g, ' ') : 'error'}`);

export async function registerOptions(c: SecurityContext, rp: RpConfig, o: PasskeyOwner): Promise<PortalResult<PasskeyRegisterOptions>> {
  const gate = keysOrRefusal(c);
  if ('refusal' in gate) return gate.refusal;
  const have = await c.store.passkeys(o.subject);
  if (have.length >= PASSKEY_LIMIT) return refuse(409, SECURITY_ERRORS.passkeyLimit);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rp.rpId,
    userName: o.userName,
    userID: new Uint8Array(Buffer.from(o.userHandle, 'base64url')),
    attestationType: 'none',
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    supportedAlgorithmIDs: ALGORITHMS,
    excludeCredentials: have.map((p) => ({ id: p.credentialId, transports: p.transports })),
  });
  await openChallenge(c, gate.keys, 'passkey-register', o.subject, options.challenge);
  return { ok: true, data: { options } };
}

export async function verifyRegister(
  c: SecurityContext, rp: RpConfig, o: PasskeyOwner, response: unknown, name: string,
): Promise<PortalResult<PasskeyRowView>> {
  const gate = keysOrRefusal(c);
  if ('refusal' in gate) return gate.refusal;
  const challenge = signedChallenge(response);
  if (challenge === null || !(await takeChallenge(c, gate.keys, 'passkey-register', o.subject, challenge))) return refuse(400, SECURITY_ERRORS.passkeyFailed);
  if ((await c.store.passkeys(o.subject)).length >= PASSKEY_LIMIT) return refuse(409, SECURITY_ERRORS.passkeyLimit);
  let verified;
  try {
    verified = await verifyRegistrationResponse({
      response: response as RegistrationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin: rp.origins,
      expectedRPID: rp.rpId,
      requireUserVerification: true,
      supportedAlgorithmIDs: ALGORITHMS,
    });
  } catch (err) {
    logFailure(c, 'registration', err);
    return refuse(400, SECURITY_ERRORS.passkeyFailed);
  }
  if (!verified.verified || !verified.registrationInfo) return refuse(400, SECURITY_ERRORS.passkeyFailed);
  const info = verified.registrationInfo;
  const label = name.trim().slice(0, PASSKEY_NAME_MAX);
  const row: Omit<PasskeyRow, 'id' | 'lastUsedAt'> = {
    subject: o.subject, credentialId: info.credential.id, publicKey: Buffer.from(info.credential.publicKey).toString('base64url'),
    counter: info.credential.counter, transports: [...(info.credential.transports ?? [])], deviceType: info.credentialDeviceType,
    backedUp: info.credentialBackedUp, rpId: rp.rpId, name: label, createdAt: c.now().toISOString(),
  };
  let id: string;
  try {
    id = await c.store.transaction(async () => {
      const made = await c.store.createPasskey(row);
      await c.store.record({ subjectType: o.subject.type, subjectId: o.subject.id, action: SECURITY_ACTIONS.passkeyCreated, changes: { name: label }, actor: c.actor });
      return made;
    });
  } catch (err) {
    logFailure(c, 'registration store', err);
    return refuse(400, SECURITY_ERRORS.passkeyFailed);
  }
  await safeMail(c, o.userName, 'changed', { passkey: label });
  return { ok: true, data: view({ ...row, id, lastUsedAt: null }, rp) };
}

export async function loginOptions(c: SecurityContext, rp: RpConfig): Promise<PortalResult<PasskeyLoginOptions>> {
  const gate = keysOrRefusal(c);
  if ('refusal' in gate) return gate.refusal;
  const options = await generateAuthenticationOptions({ rpID: rp.rpId, userVerification: 'required' });
  await openChallenge(c, gate.keys, 'passkey-login', null, options.challenge);
  return { ok: true, data: { options } };
}

/** The owner's opaque user handle, to compare with the one the authenticator returns. */
async function handleOf(c: SecurityContext, s: Subject): Promise<string | null> {
  if (s.type === 'admin') return (await c.store.adminAccount(Number(s.id)))?.webauthnUserId ?? null;
  return (await c.store.portalAccountExtra(s.id)).webauthnUserId;
}

/**
 * Discoverable sign-in. Order: keys, the challenge (single use), the credential, the page kind, the rpId, the owner's handle, the signature and counter.
 * Every refusal is the same 401 except the wrong page kind; nothing here says whether an account exists.
 */
export async function verifyLogin(c: SecurityContext, rp: RpConfig, kind: SubjectType, response: unknown): Promise<PortalResult<PasskeyLogin>> {
  const gate = keysOrRefusal(c);
  if ('refusal' in gate) return gate.refusal;
  const body = asRecord(response);
  const challenge = signedChallenge(response);
  if (!body || typeof body.id !== 'string' || challenge === null || !(await takeChallenge(c, gate.keys, 'passkey-login', null, challenge))) return failed;
  const key = await c.store.passkeyByCredential(body.id);
  if (!key) return failed;
  if (key.rpId !== rp.rpId) return failed;
  const userHandle = asRecord(body.response)?.userHandle;
  if (typeof userHandle === 'string' && userHandle !== (await handleOf(c, key.subject))) return failed;
  let verified;
  try {
    verified = await verifyAuthenticationResponse({
      response: response as AuthenticationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin: rp.origins,
      expectedRPID: rp.rpId,
      requireUserVerification: true,
      credential: { id: key.credentialId, publicKey: new Uint8Array(Buffer.from(key.publicKey, 'base64url')), counter: key.counter, transports: key.transports as never },
    });
  } catch (err) {
    logFailure(c, 'sign-in', err);
    return failed;
  }
  if (!verified.verified) return failed;
  // The kind is told only to the holder of the key (a valid signature), never for a bare credential id; nothing is saved for the wrong page.
  if (key.subject.type !== kind) return refuse(401, SECURITY_ERRORS.passkeyOtherKind);
  await c.store.updatePasskey(key.id, { counter: verified.authenticationInfo.newCounter, lastUsedAt: c.now().toISOString() });
  return { ok: true, data: { subject: key.subject, passkeyId: key.id } };
}

/** The subject's keys, newest first; `old` when the key belongs to another rpId. */
export async function passkeyRows(c: SecurityContext, rp: RpConfig, s: Subject): Promise<PasskeyRowView[]> {
  const rows = await c.store.passkeys(s);
  return rows.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map((p) => view(p, rp));
}

const owned = async (c: SecurityContext, s: Subject, id: string): Promise<PasskeyRow | null> => (await c.store.passkeys(s)).find((p) => p.id === id) ?? null;
const notFound = refuse(404, PORTAL_ERRORS.notFound);

export async function renamePasskey(c: SecurityContext, s: Subject, id: string, name: unknown): Promise<PortalResult<{ ok: true }>> {
  const label = typeof name === 'string' ? name.trim() : '';
  if (label.length < 1 || label.length > PASSKEY_NAME_MAX) return refuse(400, PORTAL_ERRORS.invalid);
  if (!(await owned(c, s, id))) return notFound;
  await c.store.updatePasskey(id, { name: label });
  return { ok: true, data: { ok: true } };
}

/** History line with the name, no mail (a key the person deleted themselves). */
export async function deletePasskey(c: SecurityContext, s: Subject, id: string): Promise<PortalResult<{ ok: true }>> {
  const key = await owned(c, s, id);
  if (!key) return notFound;
  await c.store.transaction(async () => {
    await c.store.deletePasskey(id);
    await c.store.record({ subjectType: s.type, subjectId: s.id, action: SECURITY_ACTIONS.passkeyDeleted, changes: { name: key.name }, actor: c.actor });
  });
  return { ok: true, data: { ok: true } };
}
