import { countWords } from '../../ro-count';
import type { PaymentMethod, PaymentPurpose, SessionState, SubscriptionState } from '../types';

export const PRESENCE_ERRORS = {
  notFound: 'Nu a fost găsit.',
  invalid: 'Cerere invalidă.',
  stale: 'Datele s-au schimbat. Reîncarcă pagina.',
  failed: 'Acțiunea nu a reușit. Nimic nu a fost salvat.',
  conflict: 'Prezența s-a schimbat între timp. Reîncarcă.',
  undoChanged: 'Nu se mai poate anula. Datele s-au schimbat între timp.',
  loadFailed: 'Nu am putut încărca datele.',
  periodTooLong: 'Perioada e prea lungă.',
  downloadFailed: 'Descărcarea nu a reușit.',
};

export const PRESENCE_WORDS = {
  noSubscription: 'Fără abonament',
  included: 'inclus',
  cancelledPayment: 'anulată',
  outsideSchedule: 'În afara programului',
  noPrice: 'fără preț',
};

export const SESSION_STATE_WORDS: Record<SessionState, string> = { salvata: 'salvată', urmeaza: 'urmează', nefacuta: 'nefăcută' };

export const SUBSCRIPTION_STATE_WORDS: Record<SubscriptionState, string> = { activ: 'activ', epuizat: 'epuizat', expirat: 'expirat', anulat: 'anulat' };

export const METHOD_WORDS: Record<PaymentMethod, string> = { numerar: 'Numerar', card: 'Card (POS)', transfer: 'Transfer bancar' };

export const PURPOSE_WORDS: Record<PaymentPurpose, string> = {
  abonament: 'Abonament',
  cotizatie: 'Cotizație membru',
  club_luna: 'Club',
  lectie: 'Lecție individuală',
  altceva: 'Altceva',
};

export const remainingText = (n: number): string => countWords(n, 'ședință rămasă', 'ședințe rămase');

export const noPriceListNotice = (n: number): string =>
  `${countWords(n, 'grupă fără listă de prețuri', 'grupe fără listă de prețuri')}: prezența se înregistrează, nimic nu se calculează.`;
