import { expect, it } from 'vitest';
import { SCRIPT_FORM_TAIL } from '../../sheets/script-form';

it('ends the new-form Sheet tab with the "E-mail" column, after Document', () => {
  expect(SCRIPT_FORM_TAIL.map((c) => c.label).slice(-2)).toEqual(['Document', 'E-mail']);
  const column = SCRIPT_FORM_TAIL[SCRIPT_FORM_TAIL.length - 1];
  expect(column.key).toBe('emailStatus');
  const row = { emailJobs: [{ status: 'sent', sentAt: '2026-10-03T11:23:00.000Z', createdAt: '2026-10-03T11:22:58.000Z' }] };
  expect(column.cell?.(row)).toBe('Trimis 03.10.2026, 14:23');
  expect(column.cell?.({})).toBe('Niciun e-mail trimis');
});
