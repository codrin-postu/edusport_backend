export function normalizeGroupName(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/ş/g, 'ș')
    .replace(/Ş/g, 'Ș')
    .replace(/ţ/g, 'ț')
    .replace(/Ţ/g, 'Ț')
    .trim()
    .replace(/\s+/g, ' ');
}

export function nameKey(raw: string): string {
  return normalizeGroupName(raw)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function splitPersonName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? '', lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

export function parsePrice(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw !== 'string') return null;
  const m = /(\d+(?:[.,]\d+)?)/.exec(raw.replace(/\s/g, ''));
  return m ? Number(m[1].replace(',', '.')) : null;
}
