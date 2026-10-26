import * as React from 'react';
import { Button, EmptyState } from '../../ui';
import { IconPlus } from '../../ui/icons';
import type { AdminPriceList, AdminSection } from '../../../club/price-admin';
import { PriceListCard } from './PriceListCard';
import { PriceNotesCard } from './PriceNotesCard';
import type { ItemTarget } from './PriceItemDrawer';
import type { NotesDraft } from './useNotesDraft';

export interface SectionPricesProps {
  section: AdminSection;
  lists: AdminPriceList[];
  notes: NotesDraft;
  onOpen: (target: ItemTarget) => void;
  onNewList: () => void;
}

/** One tab: a card per price list, "+ Listă nouă", and "Notițe subsol" for a school. */
export function SectionPrices({ section, lists, notes, onOpen, onNewList }: SectionPricesProps) {
  const newList = (
    <Button variant="secondary" size="sm" icon={<IconPlus />} onClick={onNewList}>
      Listă nouă
    </Button>
  );
  const notesCard = section.kind === 'school' && (
    <PriceNotesCard notes={notes.value(section.documentId)} onChange={(next) => notes.set(section.documentId, next)} />
  );
  if (lists.length === 0) {
    return (
      <>
        <EmptyState action={newList}>Nicio listă de prețuri</EmptyState>
        {notesCard}
      </>
    );
  }
  return (
    <>
      {lists.map((list) => (
        <PriceListCard
          key={list.documentId}
          list={list}
          sectionName={section.name}
          onAdd={() => onOpen({ list, index: null })}
          onOpen={(index) => onOpen({ list, index })}
        />
      ))}
      <div>{newList}</div>
      {notesCard}
    </>
  );
}
