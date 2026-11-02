import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The admin bundle has no test runner; these read its source.
const src = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');

describe('money UI source', () => {
  it('the bar draws square segments with tokens, no circle (decided 8)', () => {
    const s = src('admin/dashboard/bani/AbonamentBar.tsx') + src('admin/dashboard/bani/styles.ts');
    expect(s).toMatch(/barSegments\(/);
    expect(s).toMatch(/SUBSCRIPTION_COPY\.(usedText|leftText)/);
    expect(s).not.toMatch(/border-radius:\s*50%|borderRadius:\s*'50%'|dashed|dotted|#[0-9a-f]{3,6}\b/i);
  });
  it('one submit per click (decided 1)', () => {
    expect(src('admin/dashboard/bani/useSubmitOnce.ts')).toMatch(/inFlight\.current/);
  });
  it('undo toasts use the server action id and 8 s', () => {
    expect(src('admin/dashboard/bani/undo.ts')).toMatch(/UNDO_MS/);
  });
  it('the payment window and the cancel dialog (5.10)', () => {
    const w = src('admin/dashboard/bani/PaymentWindow.tsx');
    for (const name of ['useSubmitOnce', 'newDraft', 'checkDraft', 'toBody', 'emailBox']) expect(w).toContain(name);
    expect(w).not.toMatch(/sendEmail:\s*true/);
    expect(w).toMatch(/mode !== 'new'|mode === 'new'/);
    expect(w).toMatch(/PAYMENT_COPY\.(titleNew|record)/);
    expect(w).not.toMatch(/['`](Înregistrează|Renunță|Plată nouă|Salvează)['`]/);
    const c = src('admin/dashboard/bani/CancelPaymentDialog.tsx');
    expect(c).toMatch(/cancelText\(/);
    expect(c).toMatch(/moneyUndoToast\(/);
  });
  it('the Plăți list (5.10)', () => {
    const l = src('admin/dashboard/bani/PlatiList.tsx');
    for (const name of ['platiCells', 'rowMenu', 'totalLine', 'PaymentWindow', 'CancelPaymentDialog']) expect(l).toContain(name);
    expect(src('admin/dashboard/bani/styles.ts')).toMatch(/text-decoration:\s*line-through/);
    expect(l + src('admin/dashboard/bani/styles.ts')).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i);
    expect(src('admin/dashboard/PlatiPage.tsx')).toContain('PlatiList');
  });
});
