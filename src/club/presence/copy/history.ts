import { countWords } from '../../ro-count';

/** Istoric copy of phase 5 (spec 8). Templates take values already formatted by history-lines.ts. */
export const PRESENCE_LINES = {
  sessionSaved: (present: number, listed: number, coaches: string): string => `Prezență salvată: ${present} din ${listed}${coaches ? `, antrenor ${coaches}` : ''}.`,
  sessionCorrected: (parts: { added: string[]; removed: string[]; uscat: string[] }): string => {
    const { added, removed, uscat } = parts;
    const addedLine = added.length === 1 ? `Sportiv adăugat: ${added[0]}.` : added.length > 1 ? `Sportivi adăugați: ${added.join(', ')}.` : '';
    const removedLine = removed.length === 1 ? `Sportiv scos: ${removed[0]}.` : removed.length > 1 ? `Sportivi scoși: ${removed.join(', ')}.` : '';
    const uscatLine = uscat.length ? `Uscat bifat: ${uscat.join(', ')}.` : '';
    return ['Prezență corectată.', addedLine, removedLine, uscatLine].filter(Boolean).join(' ');
  },
  sessionCoaches: (from: string, to: string): string => `Antrenori: "${from}" → "${to}"`,
  visitorPresent: (group: string, date: string): string => `Prezent la ${group}, ${date}, doar la ședința asta.`,
  subscriptionAdded: (item: string, from: string, until: string, covered: number): string[] => [
    `Abonament adăugat: ${item}, din ${from}, expiră pe ${until}.`,
    ...(covered > 0 ? [`Acoperă ${countWords(covered, 'prezență fără abonament', 'prezențe fără abonament')}.`] : []),
  ],
  subscriptionExtendedAthlete: (weeks: number, to: string): string =>
    `Abonament prelungit cu ${countWords(weeks, 'săptămână', 'săptămâni')}: expiră pe ${to}.`,
  subscriptionExtendedSubscription: (weeks: number, from: string, to: string): string =>
    `Prelungit cu ${countWords(weeks, 'săptămână', 'săptămâni')}: ${from} → ${to}.`,
  subscriptionCarried: (listName: string): string => `Valabil și în lista ${listName}.`,
  subscriptionCancelled: 'Abonament anulat.',
  paymentRecorded: (amount: string, method: string, purpose: string): string => `Plată înregistrată: ${amount}, ${method}, ${purpose}.`,
  paymentRecordedShort: 'Plată înregistrată.',
  paymentCancelled: (amount: string, paidOn: string): string => `Plată anulată: ${amount}, ${paidOn}.`,
  paymentCancelledShort: 'Plată anulată.',
  paymentEmailSent: (recipient: string | null): string =>
    recipient ? `E-mail "Plată înregistrată" trimis la ${recipient}.` : 'E-mail "Plată înregistrată" trimis.',
  lessonPlanned: (date: string, startTime: string, durationMin: number): string => `Lecție programată: ${date}, ${startTime}, ${durationMin} min.`,
  lessonSaved: (present: boolean): string => `Lecție salvată: ${present ? 'prezent' : 'absent'}.`,
  lessonDeleted: 'Lecție ștearsă.',
};

/** Labels of the changed fields of a payment and of a lesson (Istoric field lines). */
export const PAYMENT_FIELD_LABELS: Readonly<Record<string, string>> = {
  amount: 'Sumă',
  paidOn: 'Data',
  method: 'Metodă',
  purposeText: 'Pentru',
  collectedAtRink: 'Încasat la patinoar',
  note: 'Notă',
};

export const LESSON_FIELD_LABELS: Readonly<Record<string, string>> = {
  date: 'Data',
  startTime: 'Ora',
  durationMin: 'Durată',
  coaches: 'Antrenor',
};
