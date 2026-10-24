import * as React from 'react';
import { AdminPage, Loading, Notice, PageHeader, SaveBar, Tabs, UnsavedGuard, Window } from '../ui';
import { DASHBOARD_TO } from '../dashboard/menu';
import { NewListDrawer } from './preturi/NewListDrawer';
import { PriceItemDrawer, type ItemTarget } from './preturi/PriceItemDrawer';
import { SectionPrices } from './preturi/SectionPrices';
import { useNotesDraft, type NotesDraft } from './preturi/useNotesDraft';
import { usePrices, type PricesState } from './preturi/usePrices';

/**
 * Prețuri (/plugins/edusport-preturi): the club price lists (api::price-list) per section, with
 * tooltips, and each school's "Notițe subsol" (section.priceNotes). Approved design:
 * phase2-designs-v1, option A. Data and every change go through /api/club/prices and friends
 * (src/api/club/routes/03-admin-prices-seasons.ts); each change writes a history entry there.
 * The old `pricing` single type stays in the database, unread (spec 1.6).
 */
type BodyProps = {
  prices: PricesState;
  notes: NotesDraft;
  tab: string;
  onTab: (id: string) => void;
  onOpen: (target: ItemTarget) => void;
  onNewList: () => void;
};

/** Loading, load error, or the section tabs with the open tab's lists. */
function PricesBody({ prices, notes, tab, onTab, onOpen, onNewList }: BodyProps) {
  if (prices.error) {
    return (
      <div className="ui-body">
        <Notice tone="danger">Nu am putut încărca prețurile.</Notice>
      </div>
    );
  }
  if (!prices.data) return <Loading />;
  const { sections, lists } = prices.data;
  const section = sections.find((s) => s.documentId === tab) ?? sections[0];
  return (
    <div className="ui-body">
      <Tabs items={sections.map((s) => ({ id: s.documentId, label: s.name }))} value={section?.documentId ?? ''} onChange={onTab} label="Secțiuni" />
      {section && (
        <SectionPrices section={section} lists={lists.filter((l) => l.sectionId === section.documentId)} notes={notes} onOpen={onOpen} onNewList={onNewList} />
      )}
    </div>
  );
}

const PreturiPage: React.FC = () => {
  const prices = usePrices();
  const notes = useNotesDraft(prices);
  const [tab, setTab] = React.useState('');
  const [target, setTarget] = React.useState<ItemTarget | null>(null);
  const [newList, setNewList] = React.useState(false);
  const sections = prices.data?.sections ?? [];
  const sectionId = (sections.find((s) => s.documentId === tab) ?? sections[0])?.documentId ?? '';

  return (
    <AdminPage>
      <Window>
        <PageHeader back={{ to: DASHBOARD_TO }} title="Prețuri" subtitle="Listele de prețuri pe secțiuni." />
        <PricesBody prices={prices} notes={notes} tab={tab} onTab={setTab} onOpen={setTarget} onNewList={() => setNewList(true)} />
        <SaveBar {...notes.bar} onSave={() => void notes.save()} onDiscard={notes.reset} />
      </Window>
      <PriceItemDrawer target={target} mutate={prices.mutate} onClose={() => setTarget(null)} />
      <NewListDrawer open={newList} sections={sections} sectionId={sectionId} mutate={prices.mutate} onClose={() => setNewList(false)} />
      <UnsavedGuard when={notes.dirty} />
    </AdminPage>
  );
};

export default PreturiPage;
