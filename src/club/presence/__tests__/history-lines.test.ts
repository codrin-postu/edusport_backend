import { describe, expect, it } from 'vitest';
import { GROUP_LINES } from '../../groups/copy';
import { historyTexts } from '../../history-text';
import { SUBJECT } from '../../subjects';
import { phase5Lines, sessionHistoryTexts } from '../history-lines';

// Dates use the phase 4 short months ('noi' for November, ruling 2026-10-27), not 'nov'.
const names = { a1: 'Ana Ionescu', a2: 'Mihai Pop', a3: 'Ioana Dinu', 'tm-virgil': 'Virgil Pascu', 'tm-andreea': 'Andreea Pascu' };
const lines = (action: string, changes: object, subject = 'athlete') => phase5Lines(action, changes, subject, names);

describe('phase 5 Istoric lines', () => {
  it('session lines (8)', () => {
    expect(sessionHistoryTexts('session-saved', { present: 6, listed: 9, coachIds: ['tm-virgil'] }, names)).toEqual(['Prezență salvată: 6 din 9, antrenor Virgil Pascu.']);
    expect(sessionHistoryTexts('session-corrected', { added: ['a1', 'a2'], removed: ['a3'], uscat: ['a1'] }, names))
      .toEqual(['Prezență corectată. Sportivi adăugați: Ana Ionescu, Mihai Pop. Sportiv scos: Ioana Dinu. Uscat bifat: Ana Ionescu.']);
    expect(sessionHistoryTexts('session-corrected', { added: ['a1'], removed: [], uscat: [] }, names)).toEqual(['Prezență corectată. Sportiv adăugat: Ana Ionescu.']);
    expect(sessionHistoryTexts('session-coaches', { from: ['tm-virgil'], to: ['tm-virgil', 'tm-andreea'] }, names))
      .toEqual(['Antrenori: "Virgil Pascu" → "Virgil Pascu, Andreea Pascu"']);
    expect(sessionHistoryTexts('session-corrected', { added: ['gone'], removed: [], uscat: [] }, names)).toEqual([`Prezență corectată. Sportiv adăugat: ${GROUP_LINES.deletedAthlete}.`]);
  });

  it('an unknown coach reads "Antrenor șters", never "Sportiv șters" (ruling 5-2)', () => {
    expect(sessionHistoryTexts('session-saved', { present: 1, listed: 2, coachIds: ['tm-gone'] }, names)).toEqual(['Prezență salvată: 1 din 2, antrenor Antrenor șters.']);
    expect(sessionHistoryTexts('session-coaches', { from: ['tm-virgil'], to: ['tm-virgil', 'tm-gone'] }, names)).toEqual(['Antrenori: "Virgil Pascu" → "Virgil Pascu, Antrenor șters"']);
    expect(lines('lesson-edited', { fields: { coaches: { from: ['tm-gone'], to: ['tm-andreea'] } } }, 'lesson')).toEqual(['Antrenor: "Antrenor șters" → "Andreea Pascu"']);
  });

  it('athlete and subscription lines (8)', () => {
    expect(lines('visitor-present', { groupName: 'Intermediari Bronze', date: '2026-10-27' })).toEqual(['Prezent la Intermediari Bronze, 27 oct 2026, doar la ședința asta.']);
    expect(lines('subscription-added', { itemName: 'Abonament 8 ședințe', startsOn: '2026-10-27', validUntil: '2026-11-23', covered: 2 }))
      .toEqual(['Abonament adăugat: Abonament 8 ședințe, din 27 oct 2026, expiră pe 23 noi 2026.', 'Acoperă 2 prezențe fără abonament.']);
    expect(lines('subscription-added', { itemName: 'Abonament 8 ședințe', startsOn: '2026-10-27', validUntil: '2026-11-23', covered: 1 })[1]).toBe('Acoperă 1 prezență fără abonament.');
    expect(lines('subscription-extended', { weeks: 2, from: '2026-11-23', to: '2026-12-07' })).toEqual(['Abonament prelungit cu 2 săptămâni: expiră pe 7 dec 2026.']);
    expect(lines('subscription-extended', { weeks: 1, from: '2026-11-23', to: '2026-11-30' }, 'subscription')).toEqual(['Prelungit cu 1 săptămână: 23 noi 2026 → 30 noi 2026.']);
    expect(lines('subscription-carried', { listName: 'Avansați Gold' }, 'subscription')).toEqual(['Valabil și în lista Avansați Gold.']);
    expect(lines('subscription-cancelled', {}, 'subscription')).toEqual(['Abonament anulat.']);
  });

  it('history lines end with the code and the number, old lines read as before (S11)', () => {
    const added = { itemName: 'Abonament 8 ședințe', startsOn: '2026-11-01', validUntil: '2026-11-30', covered: 0 };
    expect(lines('subscription-added', { ...added, code: 'A-0124' })).toEqual(['Abonament adăugat: Abonament 8 ședințe, din 1 noi 2026, expiră pe 30 noi 2026 (A-0124)']);
    expect(lines('subscription-added', { ...added, covered: 2, code: 'A-0124' })).toEqual([
      'Abonament adăugat: Abonament 8 ședințe, din 1 noi 2026, expiră pe 30 noi 2026 (A-0124)', 'Acoperă 2 prezențe fără abonament.',
    ]);
    expect(lines('subscription-added', added)).toEqual(['Abonament adăugat: Abonament 8 ședințe, din 1 noi 2026, expiră pe 30 noi 2026.']);
    const paid = { amount: 320, method: 'numerar', purposeText: 'Abonament' };
    expect(lines('payment-recorded', { ...paid, receiptNo: '2026-0412' })?.[0]).toMatch(/\(nr\. 2026-0412\)$/);
    expect(lines('payment-recorded', { ...paid, receiptNo: '2026-0412' })).toEqual(['Plată înregistrată: 320 RON, Numerar, Abonament (nr. 2026-0412)']);
    expect(lines('payment-recorded', paid)).toEqual(['Plată înregistrată: 320 RON, Numerar, Abonament.']);
  });

  it('payment lines (8)', () => {
    expect(lines('payment-recorded', { amount: 320, method: 'numerar', purposeText: 'Abonament 8 ședințe' })).toEqual(['Plată înregistrată: 320 RON, Numerar, Abonament 8 ședințe.']);
    expect(lines('payment-recorded', { amount: 320, method: 'numerar', purposeText: 'x' }, 'payment')).toEqual(['Plată înregistrată.']);
    expect(lines('payment-edited', { fields: { amount: { from: 300, to: 320 }, collectedAtRink: { from: false, to: true } } }, 'payment'))
      .toEqual(['Sumă: "300 RON" → "320 RON"', 'Încasat la patinoar: "Nu" → "Da"']);
    expect(lines('payment-cancelled', { amount: 12.5, paidOn: '2026-10-27' })).toEqual(['Plată anulată: 12,50 RON, 27 oct 2026.']);
    expect(lines('payment-cancelled', { amount: 12.5, paidOn: '2026-10-27' }, 'payment')).toEqual(['Plată anulată.']);
    expect(lines('payment-email-sent', { recipient: 'ana@example.com' }, 'payment')).toEqual(['E-mail "Plată înregistrată" trimis la ana@example.com.']);
    expect(lines('payment-email-sent', { recipient: null }, 'payment')).toEqual(['E-mail "Plată înregistrată" trimis.']);
  });

  it('lesson lines (8)', () => {
    expect(lines('lesson-planned', { date: '2026-10-28', startTime: '18:00', durationMin: 50 }, 'lesson')).toEqual(['Lecție programată: 28 oct 2026, 18:00, 50 min.']);
    expect([lines('lesson-saved', { present: true }, 'lesson'), lines('lesson-saved', { present: false }, 'lesson')]).toEqual([['Lecție salvată: prezent.'], ['Lecție salvată: absent.']]);
    expect(lines('lesson-edited', { fields: { durationMin: { from: 50, to: 60 } } }, 'lesson')).toEqual(['Durată: "50 min" → "60 min"']);
    expect(lines('lesson-deleted', {}, 'lesson')).toEqual(['Lecție ștearsă.']);
    expect(lines('group-created', {})).toBeNull();
  });

  it('Istoric renders phase 5 lines and their undo (3.11, 7.3)', () => {
    expect(historyTexts('payment-cancelled', { amount: 320, paidOn: '2026-10-27' }, 'athlete')).toEqual(['Plată anulată: 320 RON, 27 oct 2026.']);
    expect(historyTexts('undone', { undoneAction: 'subscription-cancelled', undoneChanges: {} }, 'subscription')).toEqual(['Anulat: Abonament anulat.']);
    expect(SUBJECT).toMatchObject({ session: 'session', lesson: 'lesson', subscription: 'subscription', payment: 'payment' });
  });

  it('stores no child name in session lines (decided 6)', () => {
    expect(JSON.stringify({ added: ['a1'], removed: [], uscat: [] })).not.toContain('Ana');
  });
});
