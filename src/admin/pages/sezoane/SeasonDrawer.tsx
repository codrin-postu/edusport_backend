import * as React from 'react';
import { Button, Drawer, DrawerSection, Field, FieldRow, Input, NumberInput, Select, useSaveState } from '../../ui';
import { monthOptions, type AdminSeason, type SeasonFields } from '../../../club/season-admin';

/** The drawer edits an existing season, or a new one prefilled by `nextSeasonDraft`. */
export type SeasonTarget = { season: AdminSeason | null; draft: SeasonFields };

function SeasonFieldsForm({ draft, locked, set }: { draft: SeasonFields; locked: boolean; set: (p: Partial<SeasonFields>) => void }) {
  const options = monthOptions(draft.label, [draft.startMonth, draft.endMonth]);
  return (
    <>
      <Field label="Sezon" hint={locked ? 'Sezonul are înscrieri.' : undefined}>
        <Input value={draft.label} disabled={locked} onChange={(e) => set({ label: e.target.value })} />
      </Field>
      <FieldRow>
        <Field label="Început">
          <Select value={draft.startMonth} options={options} onChange={(v) => set({ startMonth: v })} />
        </Field>
        <Field label="Sfârșit">
          <Select value={draft.endMonth} options={options} onChange={(v) => set({ endMonth: v })} />
        </Field>
      </FieldRow>
      <Field label="Taxă de membru" hint="RON">
        <NumberInput value={draft.membershipFee} min={0} label="Taxă de membru" onChange={(v) => set({ membershipFee: v })} />
      </Field>
    </>
  );
}

export interface SeasonDrawerProps {
  target: SeasonTarget | null;
  onSave: (documentId: string | null, fields: SeasonFields) => Promise<void>;
  onClose: () => void;
}

/** Sezon, Început, Sfârșit, Taxă de membru (phase2-designs-v1, question 2, option A). */
export function SeasonDrawer({ target, onSave, onClose }: SeasonDrawerProps) {
  const [draft, setDraft] = React.useState<SeasonFields | null>(null);
  const state = useSaveState();
  React.useEffect(() => {
    setDraft(target?.draft ?? null);
    state.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  const season = target?.season ?? null;
  const save = async () => {
    if (draft && (await state.run(() => onSave(season?.documentId ?? null, draft)))) onClose();
  };
  const footer = (
    <>
      <span style={{ flex: 1 }} />
      <Button variant="ghost" size="sm" onClick={onClose} disabled={state.saving}>Anulează</Button>
      <Button variant="primary" size="sm" loading={state.saving} onClick={() => void save()}>Salvează</Button>
    </>
  );
  return (
    <Drawer open={target !== null} onClose={onClose} title={season ? `Sezon ${season.label}` : 'Sezon nou'} dismissable={!state.saving} footer={footer}>
      <DrawerSection>
        {draft && <SeasonFieldsForm draft={draft} locked={(season?.registrations ?? 0) > 0} set={(p) => setDraft({ ...draft, ...p })} />}
      </DrawerSection>
    </Drawer>
  );
}
