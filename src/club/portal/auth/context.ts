import { randomBytes } from 'node:crypto';
import type { Core } from '@strapi/strapi';
import bcrypt from 'bcryptjs';
import type { AdminCtx } from '../../admin-http';
import type { AdminResult, AuthRefusal } from '../../admin-result';
import { portalMailSender, type SendPortalMail } from '../../../email/portal-direct';
import { loadCommonPasswords } from '../passwords';
import { portalSessions, type PortalSessions } from '../sessions';
import type { PortalStore } from '../store';
import { strapiPortalStore } from '../strapi-store';
import { PORTAL_HOSTS, clientIp, userAgent } from './bff';
import { limiter, type Limiter } from './limit';

type Headers = Record<string, string | string[] | undefined>;

/** The Koa context the portal auth controllers use: the admin one plus the request headers. */
export type PortalCtx = AdminCtx & { request: { headers: Headers } };

/** An answer of a portal auth action: an admin result or a 401 / 429 refusal. */
export type PortalResult<T> = AdminResult<T> | AuthRefusal;

export type PortalAuthContext = {
  store: PortalStore; sessions: PortalSessions; limits: Limiter; mail: SendPortalMail; common: ReadonlySet<string>;
  hosts: string[]; ip: string; userAgent: string | null; now: () => Date; log: (m: string) => void;
  hash: (password: string) => Promise<string>; compare: (password: string, hash: string) => Promise<boolean>;
};

const COST = 10;

/** What a login with an unknown e-mail is compared against, so the time does not tell (spec 5.3). */
export const DUMMY_HASH: string = bcrypt.hashSync(randomBytes(16).toString('hex'), COST);

/** A fresh context per request: one store, so one transaction variable, for the sessions and the limiter too. */
export function portalAuthContext(strapi: Core.Strapi, ctx: PortalCtx): PortalAuthContext {
  const store = strapiPortalStore(strapi);
  const now = (): Date => new Date();
  return {
    store,
    sessions: portalSessions(store, now),
    limits: limiter(store, now),
    mail: portalMailSender(strapi),
    common: loadCommonPasswords(strapi.dirs.app.root),
    hosts: PORTAL_HOSTS(),
    ip: clientIp(ctx.request.headers),
    userAgent: userAgent(ctx.request.headers),
    now,
    log: (m) => strapi.log.error(m),
    hash: (password) => bcrypt.hash(password, COST),
    compare: (password, hash) => bcrypt.compare(password, hash),
  };
}
