import type { Core } from '@strapi/strapi';
import { baseContext, type AccountContext } from '../accounts/read';

/** The account context carries the access store and the access mail queue (both share its transaction scope). */
export type AccessContext = AccountContext;

/** A context without a request (athlete hooks, tests): `actor` is the history actor. */
export const accessContext = (strapi: Core.Strapi, actor: string): AccessContext => baseContext(strapi, actor);
