/** Season labels are stored as "YYYY-YYYY" with a hyphen; older data uses an en dash. */
export function normalizeSeasonLabel(raw: string | null | undefined): string | null {
  const m = /^\s*(\d{4})\s*[-–—]\s*(\d{4})\s*$/.exec(raw ?? '');
  if (!m) return null;
  const start = Number(m[1]);
  const end = Number(m[2]);
  if (end !== start + 1) return null;
  return `${start}-${end}`;
}

export function seasonStartYear(label: string): number {
  const normalized = normalizeSeasonLabel(label);
  if (!normalized || normalized !== label) throw new Error(`Invalid season label: ${label}`);
  return Number(label.slice(0, 4));
}
