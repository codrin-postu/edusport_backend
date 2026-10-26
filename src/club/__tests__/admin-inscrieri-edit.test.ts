import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const dir = join(__dirname, '..', '..', 'admin', 'dashboard', 'inscrieri');
const form = readFileSync(join(dir, 'EditForm.tsx'), 'utf8');
const dateTab = readFileSync(join(dir, 'DateTab.tsx'), 'utf8');

it('"Editează" sits on the first field row, no extra row (spec 3.4)', () => {
  expect(dateTab).toContain('label={i === 0 ? <EditLabel label={r.label} onEdit={() => setEditing(true)} /> : r.label}');
  expect(dateTab).toContain('if (editing) return <EditForm row={row} api={api} onDone={() => setEditing(false)} />;');
});

it('one form: the birth date picker, the wish under "Abonament", Salvează / Anulează', () => {
  expect(form).toContain('<BirthDatePicker value={draft.birth}');
  expect(form).toContain('birthTouched: true');
  expect(form).toContain('{abonament.length > 0 && <div className="ins-edit-h">{PANEL_COPY.abonamentHeading}</div>}');
  expect(form).toContain('{PANEL_COPY.save}');
  expect(form).toContain('{PANEL_COPY.cancel}');
});

it('saves the changed answers in one PUT, toasts from the answer, reloads; never an e-mail', () => {
  expect(form).toContain('const { patch, error: refused } = editPatch(row, fields, draft);');
  expect(form).toContain('if (Object.keys(patch).length === 0) {');
  expect(form).toContain('await put(CLUB_URLS.edit(row.documentId), patch)');
  expect(form).toContain('const toast = editToast(res.data);');
  expect(form).toContain('api.refetch();');
  expect(form).not.toMatch(/resend|Retrimite/);
});
