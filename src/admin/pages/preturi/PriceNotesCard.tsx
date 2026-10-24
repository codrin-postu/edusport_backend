import * as React from 'react';
import { EditorCard, RepeatableList, Textarea } from '../../ui';

/**
 * Stable React keys for a list of plain strings: a row keeps its key while it is edited, moved or
 * when rows around it are added or removed, so the textareas keep focus. (Moved here from the old
 * PreturiPage unchanged.)
 */
export function useRowKeys<T>(items: readonly T[]): (item: T, index: number) => number {
  const ref = React.useRef<{ items: readonly T[]; keys: number[]; next: number }>({ items: [], keys: [], next: 1 });
  const st = ref.current;
  if (st.items !== items) {
    const used = new Set<number>();
    const keys: Array<number | undefined> = items.map((it, i) => {
      if (i < st.items.length && Object.is(st.items[i], it)) {
        used.add(i);
        return st.keys[i];
      }
      return undefined;
    });
    items.forEach((it, i) => {
      if (keys[i] !== undefined) return;
      const j = st.items.findIndex((old, k) => !used.has(k) && Object.is(old, it));
      if (j >= 0) {
        used.add(j);
        keys[i] = st.keys[j];
      }
    });
    const leftover = st.keys.filter((_, k) => !used.has(k));
    st.keys = keys.map((k) => k ?? leftover.shift() ?? st.next++);
    st.items = items;
  }
  return (_item, index) => st.keys[index];
}

export interface PriceNotesCardProps {
  notes: string[];
  onChange: (notes: string[]) => void;
}

/** "Notițe subsol" of one school: paragraphs under the price section of its page. Saved with the page SaveBar. */
export function PriceNotesCard({ notes, onChange }: PriceNotesCardProps) {
  const keyOf = useRowKeys(notes);
  return (
    <EditorCard title="Notițe subsol" description="Textele afișate în subsolul secțiunii de prețuri de pe site.">
      <RepeatableList<string>
        items={notes}
        onChange={onChange}
        getKey={keyOf}
        newItem={() => ''}
        addLabel="Adaugă notă"
        emptyLabel="Nicio notă"
        aria-label="Notițe subsol"
        itemLabel={(_, i) => `nota ${i + 1}`}
        renderRow={(note, i, row) => (
          <Textarea aria-label={`Notă ${i + 1}`} rows={2} value={note} onChange={(e) => row.update(e.target.value)} />
        )}
      />
    </EditorCard>
  );
}
