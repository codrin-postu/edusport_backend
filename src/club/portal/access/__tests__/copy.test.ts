import { describe, expect, it } from 'vitest';
import { ACCESS_ACTIONS, ACCESS_COPY, ACCESS_ERRORS, ACCESS_HISTORY } from '../copy';

const strings = (v: unknown): string[] => {
  if (typeof v === 'string') return [v];
  if (typeof v === 'function') return strings((v as (...a: unknown[]) => unknown)(['Ana', 'Matei'], 'b@example.invalid'));
  return v && typeof v === 'object' ? Object.values(v).flatMap(strings) : [];
};

describe('access copy', () => {
  it('has no em or en dash, middle dot, curly quote or "Email"', () => {
    const all = strings([ACCESS_COPY, ACCESS_ERRORS, ACCESS_ACTIONS, ACCESS_HISTORY]);
    expect(all.length).toBeGreaterThan(20);
    for (const s of all) expect(s).not.toMatch(/[—–·‘’“”]|\bEmail\b/);
  });
});
