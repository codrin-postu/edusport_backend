import type { Charge } from '../types';
import { listDate, longDate, monthName } from '../dates';
import { ron } from '../money';
import { PRESENCE_WORDS } from './core';

const CHARGE_LABELS: Record<Charge['type'], string> = { grup: 'Grup', uscat: 'Uscat' };

export const PAYMENT_COPY = {
  titleNew: 'Plată nouă',
  titleEdit: 'Editează plata',
  athlete: 'Sportiv',
  amount: 'Sumă',
  date: 'Data',
  method: 'Metodă',
  forWhat: 'Pentru',
  atRink: 'Încasat la patinoar',
  sendEmail: 'Trimite e-mail "Plată înregistrată"',
  note: 'Notă',
  noteHint: 'Opțional',
  cancel: 'Renunță',
  record: 'Înregistrează',
  save: 'Salvează',
  noEmail: 'Sportivul nu are e-mail.',
  errors: {
    amount: 'Suma trebuie să fie mai mare decât 0.',
    future: 'Data nu poate fi în viitor.',
    purpose: 'Alege pentru ce este plata.',
  },
  recorded: (sum: number, name: string): string => `Plată înregistrată: ${ron(sum)}, ${name}.`,
  saved: 'Salvat.',
  unchanged: 'Nicio modificare.',
  cancelled: 'Plată anulată.',
  cancelConfirm: (sum: number, date: string): string => `Anulezi plata de ${ron(sum)} din ${date}? Rândul rămâne, marcat anulată.`,
  cancelAction: 'Anulează plata',
  optAbonament: (item: string, startText: string): string => `${item} (activ din ${startText})`,
  optFee: (season: string): string => `Cotizație membru ${season}`,
  optMonth: (month: string): string => `Club, ${monthName(month)}`,
  optLesson: (date: string): string => `Lecție individuală, ${longDate(date)}`,
  rink: ', la patinoar',
  sessionsText(grup: number, uscat: number, lessons: number): string {
    const parts = [[grup, 'grup'], [uscat, 'uscat'], [lessons, 'individuală']].filter(([n]) => n !== 0).map(([n, word]) => `${n} ${word}`);
    return parts.length === 0 ? '0' : `${grup + uscat + lessons} (${parts.join(', ')})`;
  },
  chargeText(charge: Charge): string {
    const label = CHARGE_LABELS[charge.type];
    if (charge.included) return `${label} ${PRESENCE_WORDS.included}`;
    return charge.price === null ? `${label} ${PRESENCE_WORDS.noPrice}` : `${label} ${ron(charge.price)}`;
  },
  lessonLine: (date: string, price: number | null): string =>
    `${listDate(date)}, Lecție individuală ${price === null ? PRESENCE_WORDS.noPrice : ron(price)}`,
  due: 'De încasat',
  dueSchool: 'Școala de patinaj',
  dueClub: 'Club',
  dueNothing: 'Nimic de încasat în luna asta.',
  fromDate: (startText: string): string => `din ${startText}`,
};
