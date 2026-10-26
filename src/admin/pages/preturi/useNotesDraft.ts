import * as React from 'react';
import { useSaveState, type SaveBarState } from '../../ui';
import { SECTIONS_API, type PricesState } from './usePrices';

const sameNotes = (a: string[], b: string[]) => a.length === b.length && a.every((n, i) => n === b[i]);

export interface NotesDraft {
  value: (sectionId: string) => string[];
  set: (sectionId: string, notes: string[]) => void;
  dirty: boolean;
  bar: SaveBarState;
  save: () => Promise<boolean>;
  reset: () => void;
}

/** "Notițe subsol" edits of every school tab, saved together by the page SaveBar. */
export function useNotesDraft(prices: PricesState): NotesDraft {
  const [drafts, setDrafts] = React.useState<Record<string, string[]>>({});
  const state = useSaveState();
  const loaded = (id: string) => prices.data?.sections.find((s) => s.documentId === id)?.priceNotes ?? [];
  const changed = Object.keys(drafts).filter((id) => !sameNotes(drafts[id], loaded(id)));
  const save = () =>
    state.run(async () => {
      for (const id of changed) {
        await prices.mutate((c) => c.put(`${SECTIONS_API}/${id}/price-notes`, { priceNotes: drafts[id] }));
      }
      setDrafts({});
    });
  const reset = () => {
    setDrafts({});
    state.reset();
  };
  return {
    value: (id) => drafts[id] ?? loaded(id),
    set: (id, notes) => setDrafts((d) => ({ ...d, [id]: notes })),
    dirty: changed.length > 0,
    bar: { ...state.bar, dirty: changed.length > 0 },
    save,
    reset,
  };
}
