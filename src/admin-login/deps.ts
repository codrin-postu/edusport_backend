import type { AdminHandoff } from '../club/security/api-types';
import type { Webauthn } from '../admin/lib/webauthn';
import type { Post } from './api';

/** What a move to another screen carries: a refusal text for the password form, or the e-mail the code went to. */
export type Carry = { flash?: string; email?: string; token?: string };

/** What every screen is given: the API, navigation inside `/login`, the session handoff and the address query. */
export type Deps = {
  post: Post;
  go: (url: string, carry?: Carry) => void;
  handoff: (h: AdminHandoff) => void;
  search: string;
  /** A refusal text carried to the password form (an ended pending login), shown once. */
  flash: string | null;
  /** The e-mail the login answer named for the e-mail code; null when the page was opened by address (a reload, the Google first link). */
  email: string | null;
  /** The access token of a login that ended in the passkey offer (`/login/passkey`); null when the page was opened by address. */
  token: string | null;
  webauthn: Webauthn;
};
