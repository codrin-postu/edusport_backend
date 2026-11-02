import { SUBSCRIPTION_STATE_WORDS } from '../presence/copy/core';
import type { AbonamentBar } from '../presence/subscriptions/rules';
import type { SubscriptionState } from '../presence/types';
import { countWords } from '../ro-count';

/** One flag per slot of the bar, true for a used one. */
export const barSegments = (bar: AbonamentBar): boolean[] => Array.from({ length: bar.slots }, (_, i) => i < bar.used);

export const slotsText = (n: number): string => countWords(n, 'ședință', 'ședințe');

export const stateWord = (s: SubscriptionState): string => SUBSCRIPTION_STATE_WORDS[s];

/** ISO dates compare as text. */
export const isPastDate = (date: string, today: string): boolean => date < today;

/** The filled cells of a card's line, joined by ", ". */
export const cardLine = (cells: (string | null)[]): string => cells.filter((c): c is string => !!c).join(', ');
