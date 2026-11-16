import { ACS_WORDS } from '../acs';
import { STATUS_WORDS } from '../history-text';
import { METHOD_WORDS, SUBSCRIPTION_STATE_WORDS } from '../presence/copy/core';
import type { CatalogColumn, ColumnType, GroupKey, Subject } from './types';

const col = (key: string, label: string, type: ColumnType, values?: string[]): CatalogColumn => (values ? { key, label, type, values } : { key, label, type });

export const PAYMENT_STATE_VALUES = ['Achitat', 'Parțial', 'Neachitat'];
export const TYPE_VALUES = ['Grup', 'Individual'];
export const YES_NO = ['Da', 'Nu'];
export const CANCELLED_WORD = 'anulată';
/** What a present cell of Prezență pe ședințe holds (the screen draws a small square for it; a file keeps the letter). */
export const SESSION_MARK = 'X';

const sportiv = col('sportiv', 'Sportiv', 'text');
const grupa = col('grupa', 'Grupă', 'label');
const data = col('data', 'Data', 'date');
const expira = col('expira', 'Expiră', 'date');
const abonament = col('abonament', 'Abonament', 'text');
const platit = col('platit', 'Plătit', 'money');
const ramas = col('ramas', 'Rămas', 'money');
const suma = col('suma', 'Sumă', 'money');
const antrenor = col('antrenor', 'Antrenor', 'text');
const sectiune = col('sectiune', 'Secțiune', 'label');

export type CatalogSubject = { label: string; columns: CatalogColumn[]; groupBy: GroupKey[] };

export const CATALOG: Record<Subject, CatalogSubject> = {
  sportivi: {
    label: 'Sportivi',
    columns: [
      sportiv, col('varsta', 'Vârstă', 'number'), col('dataNasterii', 'Data nașterii', 'date'), grupa, col('grupe', 'Grupe', 'text'),
      sectiune, antrenor, col('parinte', 'Părinte', 'text'), col('telefon', 'Telefon', 'text'), col('email', 'E-mail', 'text'),
      col('membruAcs', 'Membru A.C.S.', 'label', Object.values(ACS_WORDS)), col('stare', 'Stare', 'label', Object.values(STATUS_WORDS)),
      abonament, expira, col('prezente', 'Prezențe', 'number'), col('dePlatit', 'De plătit', 'money'), platit, ramas,
      col('starePlata', 'Stare plată', 'label', PAYMENT_STATE_VALUES),
    ],
    groupBy: ['grupa', 'sectiune', 'antrenor'],
  },
  plati: {
    label: 'Plăți',
    columns: [
      data, col('nrChitanta', 'Nr. chitanță', 'text'), sportiv, grupa, sectiune, col('pentru', 'Pentru', 'text'),
      col('metoda', 'Metodă', 'label', Object.values(METHOD_WORDS)), col('laPatinoar', 'La patinoar', 'label', YES_NO), suma,
      col('inregistratDe', 'Înregistrat de', 'text'), col('stare', 'Stare', 'label', [CANCELLED_WORD]), col('nota', 'Notă', 'text'),
    ],
    groupBy: ['grupa', 'sectiune', 'luna', 'antrenor'],
  },
  abonamente: {
    label: 'Abonamente',
    columns: [
      col('cod', 'Cod', 'text'), sportiv, grupa, abonament, col('inceput', 'Început', 'date'), expira, col('folosite', 'Folosite', 'number'),
      col('pret', 'Preț', 'money'), platit, ramas, col('stare', 'Stare', 'label', Object.values(SUBSCRIPTION_STATE_WORDS)),
    ],
    groupBy: ['grupa', 'sectiune', 'luna', 'antrenor'],
  },
  prezenta: {
    label: 'Prezență',
    columns: [data, col('ora', 'Ora', 'text'), sportiv, grupa, col('tip', 'Tip', 'label', TYPE_VALUES), antrenor, col('plata', 'Plată', 'text'), suma],
    groupBy: ['grupa', 'sectiune', 'luna', 'antrenor'],
  },
  /** The session columns are generated per group and month (rows-sedinte.ts); only these two are fixed. */
  sedinte: { label: 'Prezență pe ședințe', columns: [sportiv, col('total', 'Total', 'number')], groupBy: [] },
};

/** Columns a type offers as a filter chip, each a pick from a list of values (a word list, or the group and section names). */
export const FILTERABLE: Record<Subject, string[]> = {
  sportivi: ['grupa', 'sectiune', 'antrenor', 'stare', 'membruAcs'],
  plati: ['grupa', 'sectiune', 'metoda', 'laPatinoar'],
  abonamente: ['grupa', 'sectiune', 'stare'],
  prezenta: ['grupa', 'antrenor', 'tip'],
  sedinte: ['grupa'],
};

/** Prezență pe ședințe has no group column (its group is the scope), yet the group is its one filter. */
export const GROUP_COLUMN = grupa;

export const GROUP_LABELS: Record<GroupKey, string> = { grupa: 'Grupă', sectiune: 'Secțiune', luna: 'Lună', antrenor: 'Antrenor' };
export const NO_GROUP_LABEL = 'Fără';
