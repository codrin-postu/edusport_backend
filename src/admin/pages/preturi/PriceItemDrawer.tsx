import * as React from 'react';
import { ConfirmDialog } from '../../ConfirmDialog';
import { Button, Drawer, DrawerSection, Field, FieldRow, Input, NumberInput, Select, Textarea, useSaveState } from '../../ui';
import type { AdminPriceItem, AdminPriceList } from '../../../club/price-admin';
import type { PriceItemKind } from '../../../club/price-item';
import { KIND_OPTIONS, priceInput, priceValue } from './format';
import { LISTS_API, type PricesState } from './usePrices';

/** What the drawer edits: the open list, and the row (null for "Adaugă preț"). */
export type ItemTarget = { list: AdminPriceList; index: number | null };

type Draft = { name: string; kind: PriceItemKind; sessions: number | null; memberPrice: string; nonMemberPrice: string; tooltip: string };

const EMPTY: Draft = { name: '', kind: 'subscription', sessions: null, memberPrice: '', nonMemberPrice: '', tooltip: '' };

function toDraft(item: AdminPriceItem | undefined): Draft {
  if (!item) return EMPTY;
  const { name, kind, sessions, memberPrice, nonMemberPrice, tooltip } = item;
  return { name, kind, sessions, memberPrice: priceInput(memberPrice), nonMemberPrice: priceInput(nonMemberPrice), tooltip: tooltip ?? '' };
}

const toBody = (d: Draft) => ({ ...d, memberPrice: priceValue(d.memberPrice), nonMemberPrice: priceValue(d.nonMemberPrice) });

function DraftFields({ draft, set }: { draft: Draft; set: (patch: Partial<Draft>) => void }) {
  return (
    <>
      <FieldRow>
        <Field label="Nume" required>
          <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Tip">
          <Select value={draft.kind} options={KIND_OPTIONS} onChange={(v) => set({ kind: v as PriceItemKind })} />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="Ședințe">
          <NumberInput value={draft.sessions} min={0} label="Ședințe" onChange={(v) => set({ sessions: v })} />
        </Field>
        <Field label="Preț membri">
          <Input inputMode="numeric" value={draft.memberPrice} onChange={(e) => set({ memberPrice: e.target.value })} />
        </Field>
      </FieldRow>
      <Field label="Preț non-membri">
        <Input inputMode="numeric" value={draft.nonMemberPrice} onChange={(e) => set({ nonMemberPrice: e.target.value })} />
      </Field>
      <Field label="Tooltip" hint="Opțional">
        <Textarea rows={2} value={draft.tooltip} onChange={(e) => set({ tooltip: e.target.value })} />
      </Field>
    </>
  );
}

/** Save and delete requests for one row; each answers with the whole page data. */
function useItemActions(target: ItemTarget | null, mutate: PricesState['mutate']) {
  const base = target ? `${LISTS_API}/${target.list.documentId}/items` : '';
  const expectedName = target && target.index !== null ? target.list.items[target.index]?.name ?? '' : '';
  const save = (draft: Draft) =>
    mutate((c) =>
      target?.index === null ? c.post(base, toBody(draft)) : c.put(`${base}/${target?.index}`, { item: toBody(draft), expectedName }),
    );
  const remove = () => mutate((c) => c.del(`${base}/${target?.index}`, { params: { expectedName } }));
  return { save, remove };
}

type FooterProps = { canDelete: boolean; saving: boolean; onDelete: () => void; onCancel: () => void; onSave: () => void };

function ItemFooter({ canDelete, saving, onDelete, onCancel, onSave }: FooterProps) {
  return (
    <>
      {canDelete && (
        <Button variant="danger" size="sm" onClick={onDelete} disabled={saving}>
          Șterge
        </Button>
      )}
      <span style={{ flex: 1 }} />
      <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
        Anulează
      </Button>
      <Button variant="primary" size="sm" loading={saving} onClick={onSave}>
        Salvează
      </Button>
    </>
  );
}

export interface PriceItemDrawerProps {
  target: ItemTarget | null;
  mutate: PricesState['mutate'];
  onClose: () => void;
}

/** The form state of the open row; a new target (or the same row after fresh data) restarts it. */
function useDraft(target: ItemTarget | null, item: AdminPriceItem | undefined, reset: () => void) {
  const [draft, setDraft] = React.useState<Draft>(EMPTY);
  React.useEffect(() => {
    setDraft(toDraft(item));
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return { draft, set: (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch })) };
}

/** Nume, Tip, Ședințe, Preț membri, Preț non-membri, Tooltip; "Șterge" asks first. */
export function PriceItemDrawer({ target, mutate, onClose }: PriceItemDrawerProps) {
  const item = target && target.index !== null ? target.list.items[target.index] : undefined;
  const state = useSaveState();
  const { draft, set } = useDraft(target, item, state.reset);
  const [confirming, setConfirming] = React.useState(false);
  const actions = useItemActions(target, mutate);
  const run = async (action: () => Promise<void>) => (await state.run(action)) && onClose();
  const footer = (
    <ItemFooter canDelete={Boolean(item)} saving={state.saving} onDelete={() => setConfirming(true)} onCancel={onClose} onSave={() => void run(() => actions.save(draft))} />
  );
  return (
    <Drawer open={target !== null} onClose={onClose} title={item?.name || 'Preț nou'} dismissable={!state.saving} footer={footer}>
      <DrawerSection>
        <DraftFields draft={draft} set={set} />
      </DrawerSection>
      <ConfirmDialog
        open={confirming}
        title="Ștergi prețul?"
        message={`„${item?.name ?? ''}” dispare din listă, de pe site și din formular.`}
        confirmLabel="Șterge"
        busy={state.saving}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void run(actions.remove).then(() => setConfirming(false))}
      />
    </Drawer>
  );
}
