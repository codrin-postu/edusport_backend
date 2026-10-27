import { expect, it, vi } from 'vitest';

/** The copy modules must load from any entry point: a fresh module graph per import. */
const ENTRIES = ['../schedule-mail', '../copy', '../copy/email', '../../history-text', '../../../email/schedule-change-template'];

for (const entry of ENTRIES) {
  it(`GROUP_ERRORS is defined when ${entry} is imported first`, async () => {
    vi.resetModules();
    await import(/* @vite-ignore */ entry);
    const copy = await import('../copy');
    expect(copy.GROUP_ERRORS.invalid).toBeTypeOf('string');
    const plan = await import('../program-plan');
    expect(plan).toBeDefined();
  });
}
