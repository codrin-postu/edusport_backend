/**
 * The browser side of WebAuthn, over the official `@simplewebauthn/browser`. Options come from `@simplewebauthn/server` as JSON, answers go
 * back in the library's JSON shape, so the server needs no change. The screens take a `Webauthn` object, so a test passes a fake.
 * The library keeps one ceremony at a time: starting the button flow cancels a running autofill request by itself.
 */
import {
  WebAuthnAbortService,
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';

type Json = Record<string, unknown>;
type RegistrationOptions = Parameters<typeof startRegistration>[0]['optionsJSON'];
type AuthenticationOptions = Parameters<typeof startAuthentication>[0]['optionsJSON'];

/** What the screens are given, so a test can pass a fake in place of the browser. */
export type Webauthn = {
  supported: boolean;
  autofill: () => Promise<boolean>;
  platformKey: () => Promise<boolean>;
  register: (options: unknown) => Promise<Json>;
  /** `conditional` is the silent autofill request; aborting `signal` ends it. Throws when cancelled, refused or aborted. */
  authenticate: (options: unknown, opts?: { conditional?: boolean; signal?: AbortSignal }) => Promise<Json>;
};

const quiet = async (check: () => Promise<boolean>): Promise<boolean> => {
  try {
    return await check();
  } catch {
    return false;
  }
};

export const browserWebauthn = (): Webauthn => ({
  supported: browserSupportsWebAuthn(),
  autofill: () => quiet(browserSupportsWebAuthnAutofill),
  platformKey: () => quiet(platformAuthenticatorIsAvailable),
  register: async (options) => (await startRegistration({ optionsJSON: options as RegistrationOptions })) as unknown as Json,
  authenticate: async (options, opts = {}) => {
    if (opts.signal?.aborted) throw new Error('aborted');
    const stop = (): void => WebAuthnAbortService.cancelCeremony();
    opts.signal?.addEventListener('abort', stop, { once: true });
    try {
      return (await startAuthentication({ optionsJSON: options as AuthenticationOptions, useBrowserAutofill: opts.conditional === true })) as unknown as Json;
    } finally {
      opts.signal?.removeEventListener('abort', stop);
    }
  },
});
