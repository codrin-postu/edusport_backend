import * as React from 'react';
import { Button, Field, Input, Notice, RelationMultiSelect, SearchableSelect, Switch, adminToast } from '../../ui';
import type { GroupOptions, GroupPage } from '../../../club/groups/api-types';
import { GROUP_ERRORS, GROUP_TOASTS, GRUPE_COPY } from '../../../club/groups/copy';
import { requestErrorText } from '../../../club/registration-panel';
import { useGrupeApi, type GrupeApi } from './api';
import { WindowShell } from './PanelShell';
import { grupeChanged } from './undo';

type Props = {
  mode: 'new' | 'edit'; sectionSlug: string; sectionId: string; group: GroupPage | null;
  onClose: () => void; onSaved: (documentId: string) => void;
};
type Draft = { name: string; priceListId: string | null; coachIds: string[]; programPublic: boolean };

const draftOf = (g: GroupPage | null): Draft => ({
  name: g?.name ?? '', priceListId: g?.priceList?.documentId ?? null, coachIds: g?.coaches.map((c) => c.documentId) ?? [], programPublic: g?.programPublic ?? true,
});

function useOptions(api: GrupeApi): { options: GroupOptions | null; failed: boolean } {
  const [options, setOptions] = React.useState<GroupOptions | null>(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    api.options().then(setOptions).catch(() => setFailed(true));
  }, [api]);
  return { options, failed };
}

function Fields({ draft, set, options, sectionId }: { draft: Draft; set: (d: Draft) => void; options: GroupOptions | null; sectionId: string }) {
  const lists = (options?.priceLists ?? []).filter((p) => p.sectionId === sectionId).map((p) => ({ value: p.documentId, label: p.name }));
  const coaches = (options?.coaches ?? []).map((c) => ({ documentId: c.documentId, label: c.name }));
  return (
    <div className="grp-form">
      <Field label={GRUPE_COPY.fieldName} required>
        <Input value={draft.name} maxLength={80} onChange={(e) => set({ ...draft, name: e.target.value })} />
      </Field>
      <Field label={GRUPE_COPY.fieldPriceList} hint={GRUPE_COPY.optional}>
        <SearchableSelect value={draft.priceListId} options={lists} clearable onChange={(v) => set({ ...draft, priceListId: v })} />
      </Field>
      <Field label={GRUPE_COPY.fieldCoaches}>
        <RelationMultiSelect value={draft.coachIds} options={coaches} onChange={(ids) => set({ ...draft, coachIds: ids })} />
      </Field>
      <Switch checked={draft.programPublic} onChange={(v) => set({ ...draft, programPublic: v })} label={GRUPE_COPY.fieldPublic} description={GRUPE_COPY.publicHint} />
    </div>
  );
}

/** Saves and toasts; answers the group id to open. */
async function save(api: GrupeApi, props: Props, draft: Draft): Promise<string> {
  const body = { name: draft.name, priceListId: draft.priceListId, coachIds: draft.coachIds, programPublic: draft.programPublic };
  if (props.mode === 'new' || !props.group) {
    const created = await api.create({ ...body, section: props.sectionSlug });
    adminToast.success(GROUP_TOASTS.created(created.name));
    return created.documentId;
  }
  const res = await api.update(props.group.documentId, body);
  adminToast.success(res.changed ? GROUP_TOASTS.saved : GROUP_TOASTS.unchanged);
  return props.group.documentId;
}

/** "Grupă nouă" / "Editează grupa" (5.4, W11). */
export function GroupDialog(props: Props) {
  const api = useGrupeApi();
  const { options, failed } = useOptions(api);
  const [draft, setDraft] = React.useState<Draft>(() => draftOf(props.group));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      props.onSaved(await save(api, props, draft));
      grupeChanged();
      props.onClose();
    } catch (err) {
      setError(requestErrorText(err, GROUP_ERRORS.failed));
    } finally {
      setBusy(false);
    }
  };
  const footer = (
    <>
      <Button variant="ghost" onClick={props.onClose} disabled={busy}>{GRUPE_COPY.cancel}</Button>
      <Button loading={busy} disabled={failed} onClick={() => void submit()}>{props.mode === 'new' ? GRUPE_COPY.create : GRUPE_COPY.save}</Button>
    </>
  );
  return (
    <WindowShell title={props.mode === 'new' ? GRUPE_COPY.windowNew : GRUPE_COPY.windowEdit} onClose={props.onClose} footer={footer}>
      {(failed || error) && <Notice tone="danger">{failed ? GROUP_ERRORS.loadFailed : error}</Notice>}
      <Fields draft={draft} set={setDraft} options={options} sectionId={props.sectionId} />
    </WindowShell>
  );
}
