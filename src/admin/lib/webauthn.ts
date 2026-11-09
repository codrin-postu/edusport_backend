/**
 * The browser side of WebAuthn, over `navigator.credentials` directly. Options come from `@simplewebauthn/server` as JSON (base64url strings),
 * answers go back in the same JSON shape (RegistrationResponseJSON / AuthenticationResponseJSON), so the server needs no change. Kept free of
 * React and of `window` globals: every function takes the environment, so tests pass a fake.
 */

type Bytes = ArrayBuffer;
type Json = Record<string, unknown>;

export type WebAuthnEnv = {
  credentials?: { create: (o: unknown) => Promise<unknown>; get: (o: unknown) => Promise<unknown> };
  PublicKeyCredential?: {
    isConditionalMediationAvailable?: () => Promise<boolean>;
    isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
  };
};

/** The real browser, or an empty environment where there is none (server render, old browsers). */
export function browserEnv(): WebAuthnEnv {
  if (typeof window === 'undefined') return {};
  return {
    credentials: typeof navigator !== 'undefined' ? (navigator.credentials as unknown as WebAuthnEnv['credentials']) : undefined,
    PublicKeyCredential: (window as unknown as { PublicKeyCredential?: WebAuthnEnv['PublicKeyCredential'] }).PublicKeyCredential,
  };
}

export const webauthnSupported = (env: WebAuthnEnv = browserEnv()): boolean =>
  env.PublicKeyCredential !== undefined && env.credentials !== undefined && typeof env.credentials.get === 'function';

export async function autofillSupported(env: WebAuthnEnv = browserEnv()): Promise<boolean> {
  if (!webauthnSupported(env)) return false;
  try {
    return (await env.PublicKeyCredential?.isConditionalMediationAvailable?.()) === true;
  } catch {
    return false;
  }
}

export async function platformKeyAvailable(env: WebAuthnEnv = browserEnv()): Promise<boolean> {
  if (!webauthnSupported(env)) return false;
  try {
    return (await env.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable?.()) === true;
  } catch {
    return false;
  }
}

export function toBase64Url(bytes: Bytes): string {
  let text = '';
  for (const b of new Uint8Array(bytes)) text += String.fromCharCode(b);
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(value: string): Bytes {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const text = atob(padded);
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i);
  return out.buffer as Bytes;
}

const asJson = (v: unknown): Json => (typeof v === 'object' && v !== null ? (v as Json) : {});
const list = (v: unknown): Json[] => (Array.isArray(v) ? v.map(asJson) : []);
const withBytes = (d: Json): Json => ({ ...d, id: fromBase64Url(String(d.id)) });

/** Server options (JSON) to what the browser takes: the challenge, the user handle and every credential id as bytes. */
export function creationOptions(options: unknown): { publicKey: Json } {
  const o = asJson(options);
  return {
    publicKey: {
      ...o,
      challenge: fromBase64Url(String(o.challenge)),
      user: withBytes(asJson(o.user)),
      excludeCredentials: list(o.excludeCredentials).map(withBytes),
    },
  };
}

export function requestOptions(options: unknown): { publicKey: Json } {
  const o = asJson(options);
  return { publicKey: { ...o, challenge: fromBase64Url(String(o.challenge)), allowCredentials: list(o.allowCredentials).map(withBytes) } };
}

type Credential = {
  id: string; rawId: Bytes; type: string; authenticatorAttachment?: string | null;
  response: { clientDataJSON: Bytes; attestationObject?: Bytes; authenticatorData?: Bytes; signature?: Bytes; userHandle?: Bytes | null; getTransports?: () => string[] };
  getClientExtensionResults?: () => unknown;
};

function asCredential(raw: unknown): Credential {
  const c = raw as Credential | null;
  if (!c || !c.response || !c.rawId) throw new Error('no credential');
  return c;
}

export function registrationJson(raw: unknown): Json {
  const c = asCredential(raw);
  if (!c.response.attestationObject) throw new Error('no attestation');
  return {
    id: c.id, rawId: toBase64Url(c.rawId), type: c.type, authenticatorAttachment: c.authenticatorAttachment ?? undefined,
    clientExtensionResults: c.getClientExtensionResults?.() ?? {},
    response: {
      clientDataJSON: toBase64Url(c.response.clientDataJSON), attestationObject: toBase64Url(c.response.attestationObject),
      transports: c.response.getTransports?.() ?? [],
    },
  };
}

export function authenticationJson(raw: unknown): Json {
  const c = asCredential(raw);
  if (!c.response.authenticatorData || !c.response.signature) throw new Error('no assertion');
  return {
    id: c.id, rawId: toBase64Url(c.rawId), type: c.type, authenticatorAttachment: c.authenticatorAttachment ?? undefined,
    clientExtensionResults: c.getClientExtensionResults?.() ?? {},
    response: {
      clientDataJSON: toBase64Url(c.response.clientDataJSON), authenticatorData: toBase64Url(c.response.authenticatorData),
      signature: toBase64Url(c.response.signature), userHandle: c.response.userHandle ? toBase64Url(c.response.userHandle) : undefined,
    },
  };
}

/** The browser dialog for a new key; throws when cancelled or refused. */
export async function startRegistration(options: unknown, env: WebAuthnEnv = browserEnv()): Promise<Json> {
  if (!env.credentials) throw new Error('unsupported');
  return registrationJson(await env.credentials.create(creationOptions(options)));
}

/** The browser dialog (or, with `conditional`, the silent autofill request) for a sign-in; throws when cancelled, refused or aborted. */
export async function startAuthentication(options: unknown, opts: { conditional?: boolean; signal?: AbortSignal } = {}, env: WebAuthnEnv = browserEnv()): Promise<Json> {
  if (!env.credentials) throw new Error('unsupported');
  const request = { ...requestOptions(options), ...(opts.conditional ? { mediation: 'conditional' } : {}), ...(opts.signal ? { signal: opts.signal } : {}) };
  return authenticationJson(await env.credentials.get(request));
}

/** What the screens are given, so a test can pass a fake in place of the browser. */
export type Webauthn = {
  supported: boolean;
  autofill: () => Promise<boolean>;
  platformKey: () => Promise<boolean>;
  register: (options: unknown) => Promise<Json>;
  authenticate: (options: unknown, opts?: { conditional?: boolean; signal?: AbortSignal }) => Promise<Json>;
};

export const browserWebauthn = (): Webauthn => ({
  supported: webauthnSupported(),
  autofill: () => autofillSupported(),
  platformKey: () => platformKeyAvailable(),
  register: (o) => startRegistration(o),
  authenticate: (o, opts) => startAuthentication(o, opts),
});
