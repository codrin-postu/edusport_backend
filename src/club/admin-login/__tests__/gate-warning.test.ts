import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { warnGateOff } from '../gate-warning';

describe('warnGateOff (B3 L5)', () => {
  const run = (env: Record<string, string | undefined>) => {
    const warn = vi.fn();
    const capture = vi.fn();
    const warned = warnGateOff({ log: { warn } } as never, env as never, capture);
    return { warned, warn, capture };
  };

  it('production with ADMIN_GATE=off: one boot warning and one Sentry message', () => {
    const r = run({ NODE_ENV: 'production', ADMIN_GATE: 'off' });
    expect(r.warned).toBe(true);
    expect(r.warn).toHaveBeenCalledOnce();
    expect(r.capture).toHaveBeenCalledOnce();
    expect(r.warn.mock.calls[0][0]).toContain('ADMIN_GATE=off');
  });

  it('anything else is silent: production unset or on, a typo, or not production', () => {
    for (const env of [{ NODE_ENV: 'production' }, { NODE_ENV: 'production', ADMIN_GATE: 'on' }, { NODE_ENV: 'production', ADMIN_GATE: 'OFF' }, { NODE_ENV: 'development', ADMIN_GATE: 'off' }, {}]) {
      const r = run(env);
      expect(r.warned).toBe(false);
      expect(r.warn).not.toHaveBeenCalled();
      expect(r.capture).not.toHaveBeenCalled();
    }
  });

  it('bootstrap calls it', () => {
    expect(readFileSync(join(__dirname, '../../../index.ts'), 'utf8')).toMatch(/^\s*warnGateOff\(strapi\);/m);
  });
});
