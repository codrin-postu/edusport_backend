import { expect, it } from 'vitest';
import { SECURITY_ERRORS } from '../copy';
import type { SecurityContext } from '../context';
import { openPending, verifySecondStep } from '../second-step';
import type { Subject } from '../store';
import { totpAt } from '../totp';

export type RaceEnv = {
  /** A fresh context for request `n`: one store per request, as production builds it, and a distinct IP. */
  ctx(n: number): SecurityContext;
  /** A subject with a confirmed TOTP factor whose secret is `secret`. */
  subject(): Promise<Subject>;
  secret: Buffer;
  /** Calls that reached the TOTP check since `reset`. */
  totpChecks(): number;
  reset(): void;
  lockoutMails(): number;
};

const D = { rememberMe: false, host: 'antrenor', deviceKeyHash: null };
const EMAIL = 'ana@x.ro';
const stepOf = (c: SecurityContext): number => Math.floor(c.now().getTime() / 30_000);

/**
 * Parallel wrong TOTP guesses (spec 5.5): at most 5 may be evaluated per subject however many requests arrive at once,
 * and a right code after the limit is refused. Runs on the memory store and on Postgres.
 */
export function parallelGuessRace(make: () => RaceEnv): void {
  const burst = async (env: RaceEnv, secrets: string[], per: number) => {
    let n = 0;
    const calls = secrets.flatMap((secret) =>
      Array.from({ length: per }, () => {
        const c = env.ctx((n += 1));
        return verifySecondStep(c, secret, 'totp', totpAt(env.secret, stepOf(c) + 5));
      }),
    );
    return Promise.all(calls);
  };
  const open = async (env: RaceEnv, subject: Subject, n: number): Promise<string> => (await openPending(env.ctx(1000 + n), subject, EMAIL, D, 'totp')).secret;

  it('20 parallel wrong codes on one pending: at most 5 are evaluated, one lockout mail, the subject is locked', async () => {
    const env = make();
    const subject = await env.subject();
    const secret = await open(env, subject, 1);
    env.reset();
    await burst(env, [secret], 20);
    expect(env.totpChecks()).toBeLessThanOrEqual(5);
    expect(env.lockoutMails()).toBe(1);
    const c = env.ctx(2000);
    const fresh = await open(env, subject, 2);
    const late = await verifySecondStep(c, fresh, 'totp', totpAt(env.secret, stepOf(c)));
    expect(late).toEqual({ ok: false, status: 429, error: SECURITY_ERRORS.paused });
    const same = await verifySecondStep(c, secret, 'totp', totpAt(env.secret, stepOf(c)));
    expect(same.ok).toBe(false);
  });

  it('5 parallel wrong codes on each of 4 pendings of one subject: at most 5 are evaluated, one lockout mail, a right code is refused', async () => {
    const env = make();
    const subject = await env.subject();
    const secrets = await Promise.all([1, 2, 3, 4].map((n) => open(env, subject, n)));
    env.reset();
    await burst(env, secrets, 5);
    expect(env.totpChecks()).toBeLessThanOrEqual(5);
    expect(env.lockoutMails()).toBe(1);
    const c = env.ctx(3000);
    for (const secret of secrets) expect((await verifySecondStep(c, secret, 'totp', totpAt(env.secret, stepOf(c)))).ok).toBe(false);
  });
}
