import type { ClubStore } from '../athletes/store';
import { isAnonymized } from '../personal-data/anonymize-plan';
import { longDate } from '../presence/dates';
import { FRIENDSHIP_MESSAGES, pinLabel } from './catalog';
import { shortName } from './grants';
import { awardPinId, FORMER_ATHLETE } from './read';
import type { ParcursStore, PinRow } from './store';

const WORDS = { given: 'Dat lui', received: 'Primit de' } as const;

type Line = { on: string; text: string };

async function nameOf(club: ClubStore, id: string): Promise<string> {
  const a = await club.athlete(id);
  return a && !isAnonymized(a) && a.name ? shortName(a.name) : FORMER_ATHLETE;
}

const pinText = (word: string, who: string, p: PinRow): string => `${word} ${who}: ${FRIENDSHIP_MESSAGES[p.design - 1] ?? ''}, ${longDate(p.givenOn)}`;

/** The athlete's Parcurs rows as text, newest first: awards, then pins given and received (other athletes as "Ana P."). */
export async function parcursExportLines(parcurs: ParcursStore, club: ClubStore, athleteId: string): Promise<string[]> {
  const [awards, given, received] = await Promise.all([parcurs.awards({ athleteId }), parcurs.pins({ giverId: athleteId }), parcurs.pins({ recipientId: athleteId })]);
  const lines: Line[] = awards.map((a) => ({ on: a.givenOn, text: `${pinLabel(awardPinId(a))}, ${longDate(a.givenOn)}` }));
  for (const p of given) lines.push({ on: p.givenOn, text: pinText(WORDS.given, await nameOf(club, p.recipientId), p) });
  for (const p of received) lines.push({ on: p.givenOn, text: pinText(WORDS.received, await nameOf(club, p.giverId), p) });
  return lines.sort((a, b) => b.on.localeCompare(a.on)).map((l) => l.text);
}
