import { ACS_WORDS } from '../acs';
import { STATUS_WORDS } from '../history-text';
import { METHOD_WORDS, SUBSCRIPTION_STATE_WORDS } from '../presence/copy/core';
import type { CatalogColumn, ColumnType, GroupKey, Subject } from './types';

const col = (key: string, label: string, type: ColumnType, values?: string[]): CatalogColumn => (values ? { key, label, type, values } : { key, label, type });

export const PAYMENT_STATE_VALUES = ['Achitat', 'Parțial', 'Neachitat'];
export const TYPE_VALUES = ['Grup', 'Individual'];
export const YES_NO = ['Da', 'Nu'];
export const CANCELLED_WORD = 'anulată';

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
};

export const GROUP_LABELS: Record<GroupKey, string> = { grupa: 'Grupă', sectiune: 'Secțiune', luna: 'Lună', antrenor: 'Antrenor' };
export const NO_GROUP_LABEL = 'Fără';
