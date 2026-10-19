const SUBSCRIPTION_WEEKS = 4;

function toUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Last valid day = startsOn + (SUBSCRIPTION_WEEKS + extraWeeks) * 7 - 1 days */
export function subscriptionValidUntil(startsOn: string, extraWeeks?: number): string {
  const weeks = extraWeeks ?? 0;
  if (!Number.isInteger(weeks) || weeks < 0) {
    throw new RangeError('extraWeeks must be a non-negative integer');
  }
  const d = toUtc(startsOn);
  d.setUTCDate(d.getUTCDate() + (SUBSCRIPTION_WEEKS + weeks) * 7 - 1);
  return toIso(d);
}

/** Extend a validity date by the given number of weeks */
export function extendValidUntil(validUntil: string, weeks: number): string {
  if (!Number.isInteger(weeks) || weeks < 1) {
    throw new RangeError('weeks must be a positive integer >= 1');
  }
  const d = toUtc(validUntil);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return toIso(d);
}

export interface SubscriptionState {
  priceListId: string;
  slots: number;
  used: number;
  startsOn: string;
  validUntil: string;
}

export function canUseSlot(sub: SubscriptionState, session: { date: string; priceListId: string }): boolean {
  if (sub.priceListId !== session.priceListId) return false;
  if (sub.used >= sub.slots) return false;
  if (session.date < sub.startsOn) return false;
  if (session.date > sub.validUntil) return false;
  return true;
}
