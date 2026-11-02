import type { AbonamentBar } from '../presence/subscriptions/rules';
import type { MovePreview } from '../presence/subscriptions/views';

/** The move window's abonament (5.12): nothing without a preview or a bar; the Gold line only when the carry happens. */
export const moveBarView = (p: MovePreview | null): { bar: AbonamentBar | null; goldLine: boolean } => ({
  bar: p?.bar ?? null, goldLine: !!p?.bar && p.carries,
});
