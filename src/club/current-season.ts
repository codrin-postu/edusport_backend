import type { Core } from '@strapi/strapi';
import { normalizeSeasonLabel } from './season';

export type CurrentSeason = {
  documentId: string;
  label: string;
  startMonth: string;
  endMonth: string;
  membershipFee: number | null;
};

export type RawSeason = {
  documentId?: unknown;
  label?: unknown;
  startMonth?: unknown;
  endMonth?: unknown;
  membershipFee?: unknown;
  isCurrent?: unknown;
};

const isText = (v: unknown): v is string => typeof v === 'string' && v !== '';

function toCurrentSeason(row: RawSeason): CurrentSeason | null {
  const { documentId, label, startMonth, endMonth, membershipFee } = row;
  if (!isText(documentId) || !isText(label) || normalizeSeasonLabel(label) !== label) return null;
  if (!isText(startMonth) || !isText(endMonth)) return null;
  const fee = typeof membershipFee === 'number' && Number.isFinite(membershipFee) ? membershipFee : null;
  return { documentId, label, startMonth, endMonth, membershipFee: fee };
}

/** The Sezon marked current. Several marked current should not happen; the latest label wins. */
export function pickCurrentSeason(rows: RawSeason[]): CurrentSeason | null {
  const current = rows
    .filter((r) => r.isCurrent === true)
    .map(toCurrentSeason)
    .filter((s): s is CurrentSeason => s !== null)
    .sort((a, b) => b.label.localeCompare(a.label));
  return current[0] ?? null;
}

export async function findCurrentSeason(strapi: Core.Strapi): Promise<CurrentSeason | null> {
  const rows = await strapi.documents('api::season.season').findMany({ filters: { isCurrent: true }, limit: 10 });
  return pickCurrentSeason(rows);
}
