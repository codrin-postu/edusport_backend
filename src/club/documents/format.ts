import { RELATIONSHIP_OPTIONS } from '../registration-form-options';
import type { DocumentKind } from './types';

const MONTHS = [
  'ianuarie',
  'februarie',
  'martie',
  'aprilie',
  'mai',
  'iunie',
  'iulie',
  'august',
  'septembrie',
  'octombrie',
  'noiembrie',
  'decembrie',
];

const pad2 = (n: string) => n.padStart(2, '0');

/** "2026-10-01" -> "octombrie 2026" (the Sezon stores months as dates). */
export function monthYear(isoDate: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(isoDate ?? '');
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined;
  return month ? `${month} ${m[1]}` : null;
}

/** Birth date as dd.mm.yyyy (DECISIONS 2026-10-03), from "yyyy-mm-dd" or "d.m.yyyy"; anything else as typed. */
export function formatBirthDate(raw: string | null | undefined): string | null {
  const text = (raw ?? '').trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (iso) return `${pad2(iso[3])}.${pad2(iso[2])}.${iso[1]}`;
  const dmy = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text);
  if (dmy) return `${pad2(dmy[1])}.${pad2(dmy[2])}.${dmy[3]}`;
  return text || null;
}

/** The day of an ISO timestamp in Romania, as dd.mm.yyyy ("Data" on the Acord). */
export function formatDay(iso: string | null | undefined): string | null {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Bucharest',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('day')}.${part('month')}.${part('year')}`;
}

/** 270 -> "270 ron", 270.5 -> "270,5 ron" (as the Cerere prints it). */
export function formatFee(fee: number | null | undefined): string | null {
  if (typeof fee !== 'number' || !Number.isFinite(fee)) return null;
  return `${String(fee).replace('.', ',')} ron`;
}

/** "in calitate de ..." on the Acord: the option label, or the free text for Alta. */
export function relationshipLabel(value: string | null | undefined, other: string | null | undefined): string | null {
  if (value === 'alta') return (other ?? '').trim() || null;
  return RELATIONSHIP_OPTIONS.find((o) => o.value === value)?.label ?? null;
}

/** Letters and digits only, words joined by "_", no diacritics: "Maria Ștefănescu" -> "Maria_Stefanescu". */
export function asciiWords(text: string | null | undefined): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const TYPE_IN_NAME: Record<DocumentKind, string> = { acord: 'Acord', adeziune: 'Adeziune' };
const seasonPart = (season: string | null) => (season && /^\d{4}-\d{4}$/.test(season) ? season : 'fara-sezon');

/** `Nume_Prenume_Tip-document_Sezon.pdf`, no diacritics (DECISIONS, CMS admin proposal). */
export function documentFileName(kind: DocumentKind, childName: string | null, season: string | null, fallback: string): string {
  const name = asciiWords(childName) || asciiWords(fallback) || 'Inscriere';
  return `${name}_${TYPE_IN_NAME[kind]}_${seasonPart(season)}.pdf`;
}

/** Blank forms: `Formular-gol_Acord_2026-2027.pdf`. */
export function blankFileName(kind: DocumentKind, season: string | null): string {
  return `Formular-gol_${TYPE_IN_NAME[kind]}_${seasonPart(season)}.pdf`;
}

/** The kind encoded in a stored file name, or null for any other file. */
export function kindFromFileName(fileName: string): DocumentKind | null {
  const m = /_(Acord|Adeziune)_[^_]+\.pdf$/.exec(fileName);
  if (!m) return null;
  return m[1] === 'Acord' ? 'acord' : 'adeziune';
}
