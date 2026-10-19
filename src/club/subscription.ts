function toUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function weekendKey(isoDate: string): string {
  const d = toUtc(isoDate);
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() - 1);
  return toIso(d);
}

/** Valid for `weekends` school weekends from the start; days missing from schoolDays (free weekends) do not count. */
export function subscriptionValidUntil(startsOn: string, schoolDays: string[], weekends = 4): string | null {
  const days = [...new Set(schoolDays)].filter((d) => d >= startsOn).sort();
  const keys: string[] = [];
  const lastDayOfKey = new Map<string, string>();
  for (const day of days) {
    const key = weekendKey(day);
    if (!lastDayOfKey.has(key)) keys.push(key);
    lastDayOfKey.set(key, day);
  }
  if (keys.length < weekends) return null;
  return lastDayOfKey.get(keys[weekends - 1]) ?? null;
}

export interface SubscriptionState {
  priceListId: string;
  slots: number;
  used: number;
  startsOn: string;
  validUntil: string | null;
}

export function canUseSlot(sub: SubscriptionState, session: { date: string; priceListId: string }): boolean {
  if (sub.priceListId !== session.priceListId) return false;
  if (sub.used >= sub.slots) return false;
  if (session.date < sub.startsOn) return false;
  if (sub.validUntil !== null && session.date > sub.validUntil) return false;
  return true;
}
