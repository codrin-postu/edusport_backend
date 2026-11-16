import { countWords } from '../../ro-count';
import { listDate, longDate } from '../dates';

const lei = (n: number): string => `${Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',')} lei`;
const weeksText = (n: number): string => countWords(n, 'săptămână', 'săptămâni');

export const SUBSCRIPTION_COPY = {
  windowTitle: (name: string): string => `Adaugă abonament, ${name}`,
  itemLabel: (list: string): string => `Abonament (lista ${list})`,
  memberBox: (season: string): string => `Membru A.C.S. ${season}`,
  addFee: (fee: number): string => `Adaugă cotizația (${lei(fee)})`,
  feeRow: (fee: number): string => `Cotizație ${lei(fee)}`,
  total: (sum: number): string => `Total ${lei(sum)}`,
  price: (price: number): string => lei(price),
  startsOn: 'Data de start',
  expires: 'Expiră (estimat)',
  cover: (n: number): string => `Acoperă prezențe fără abonament (${n})`,
  coverRow: (date: string, group: string): string => `${listDate(date)}, ${group}`,
  paymentBlock: 'Plată',
  payNow: 'Înregistrează plata acum',
  cancel: 'Renunță',
  submit: 'Adaugă abonament',
  noItems: (list: string): string => `Lista ${list} nu are abonamente pentru acest sportiv.`,
  added: (name: string): string => `Abonament adăugat: ${name}.`,
  addedWithPayment: (name: string): string => `Abonament și plată înregistrate: ${name}.`,
  cancelAction: 'Anulează abonamentul',
  cancelled: 'Abonament anulat.',
  extendTitle: 'Prelungește abonamentele Școlii de patinaj',
  weeks: 'Număr de săptămâni',
  extendText: (n: number, x: number): string =>
    `Se prelungesc ${countWords(n, 'abonament activ', 'abonamente active')} cu ${weeksText(x)}. Noua dată de expirare se calculează pentru fiecare.`,
  extendButton: (n: number): string => `Prelungește ${countWords(n, 'abonament', 'abonamente')}`,
  extended: (n: number, x: number): string => `${countWords(n, 'abonament prelungit', 'abonamente prelungite')} cu ${weeksText(x)}.`,
  extendStale: 'Abonamentele s-au schimbat. Reîncarcă pagina.',
  barTitle: (itemName: string, slots: number): string => (itemName === `Abonament ${slots} ședințe` ? `Abonament Școala de patinaj, ${slots} ședințe` : itemName),
  expiresOn: (date: string): string => `Expiră pe ${longDate(date)}`,
  usedText: (n: number): string => (n === 1 ? '1 folosită' : `${n} folosite`),
  leftText: (n: number): string => (n === 1 ? '1 rămasă' : `${n} rămase`),
  goldLine: 'Abonamentul actual rămâne valabil. Următorul, la prețul Avansați Gold.',
};
