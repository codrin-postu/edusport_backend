import { ron } from '../money';

/** "Plată înregistrată" e-mail (spec 9). */
export const PAYMENT_EMAIL_COPY = {
  subject: (name: string): string => `Plată înregistrată: ${name}`,
  greeting: 'Bună ziua,',
  recorded: (sum: number, name: string): string => `Am înregistrat plata de ${ron(sum)} pentru ${name}.`,
  details: (purpose: string, method: string, date: string): string => `Pentru: ${purpose}. Metodă: ${method}. Data: ${date}.`,
  notFiscal: 'Acesta nu este un document fiscal.',
  signature: 'Echipa EduSport',
};
