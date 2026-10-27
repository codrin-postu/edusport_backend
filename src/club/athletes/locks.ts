import type { ClubStore } from './store';

/**
 * Row locks for merge and delete (polish 12). Every writer takes registration rows before athlete rows, as confirm and
 * undo do (registration, then its athlete): merge and delete first hold every registration they may write (linked to,
 * or matched with, one of their athletes; deleting an athlete clears its matches), then the athletes, each set sorted
 * by id, so no two of them can wait on each other in a circle.
 */
export async function lockAthletesWithRegistrations(store: ClubStore, athleteIds: string[]): Promise<void> {
  const lists = await Promise.all(athleteIds.flatMap((athleteId) => [store.registrations({ athleteId }), store.registrations({ matchAthleteId: athleteId })]));
  const registrationIds = [...new Set(lists.flat().map((r) => r.id))].sort();
  for (const id of registrationIds) await store.lockRegistration(id);
  for (const id of [...new Set(athleteIds)].sort()) await store.lockAthlete(id);
}
