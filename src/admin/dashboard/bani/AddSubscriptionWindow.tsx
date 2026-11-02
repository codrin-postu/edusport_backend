import * as React from 'react';
import { Button, Checkbox, DateInput, Field, Input, Notice, SegmentedControl, Select } from '../../ui';
import {
  addBody, addDraft, addToast, coverDisabled, coverRows, itemOptions, itemValue, toggleCover, withForm, withItem, type AddDraft,
} from '../../../club/bani/abonamente-view';
import { emailBox } from '../../../club/bani/payment-window';
import { METHOD_WORDS, PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { PAYMENT_COPY } from '../../../club/presence/copy/payments';
import { SUBSCRIPTION_COPY } from '../../../club/presence/copy/subscriptions';
import { longDate } from '../../../club/presence/dates';
import type { NewSubscriptionForm } from '../../../club/presence/subscriptions/views';
import type { PaymentMethod } from '../../../club/presence/types';
import { requestErrorText } from '../../../club/registration-panel';
import { WindowShell } from '../grupe/PanelShell';
import { useMoneyApi, type MoneyApi } from './api';
import { MONEY_CSS } from './styles';
import { moneyUndoToast } from './undo';
import { useSubmitOnce } from './useSubmitOnce';

type Props = { athlete: { id: string; name: string }; onClose: () => void };
type Loaded = { form: NewSubscriptionForm | null; draft: AddDraft | null; error: string | null };

const METHOD_OPTIONS = (Object.keys(METHOD_WORDS) as PaymentMethod[]).map((value) => ({ value, label: METHOD_WORDS[value] }));

/** The form for the athlete and start date; a new start date reloads it, so audience, prices and expiry follow (5.8). */
function useForm(api: MoneyApi, athleteId: string, startsOn: string | null): Loaded & { setDraft: (fn: (d: AddDraft) => AddDraft) => void } {
  const [state, setState] = React.useState<Loaded>({ form: null, draft: null, error: null });
  React.useEffect(() => {
    let off = false;
    api.subscriptionForm(athleteId, startsOn)
      .then((form) => { if (!off) setState((s) => ({ form, draft: s.draft ? withForm(s.draft, form) : addDraft(form), error: null })); })
      .catch((err) => { if (!off) setState((s) => ({ ...s, error: requestErrorText(err, PRESENCE_ERRORS.loadFailed) })); });
    return () => { off = true; };
  }, [api, athleteId, startsOn]);
  const setDraft = (fn: (d: AddDraft) => AddDraft) => setState((s) => (s.draft ? { ...s, draft: fn(s.draft) } : s));
  return { ...state, setDraft };
}

type BodyProps = { form: NewSubscriptionForm; draft: AddDraft; busy: boolean; amountError: string | null; startsOn: string; onStart: (v: string) => void; set: (fn: (d: AddDraft) => AddDraft) => void };

function CoverRows({ form, draft, busy, set }: Pick<BodyProps, 'form' | 'draft' | 'busy' | 'set'>) {
  const rows = coverRows(draft, form);
  if (rows.length === 0) return null;
  return (
    <Field label={SUBSCRIPTION_COPY.cover(rows.length)}>
      <div className="bn-form">
        {rows.map((r) => (
          <Checkbox
            key={r.attendanceId} checked={draft.cover.includes(r.attendanceId)} disabled={busy || coverDisabled(draft, form, r.attendanceId)}
            label={SUBSCRIPTION_COPY.coverRow(r.date, r.groupName)} onChange={() => set((d) => toggleCover(d, form, r.attendanceId))}
          />
        ))}
      </div>
    </Field>
  );
}

function PaymentBlock({ form, draft, busy, amountError, set }: Pick<BodyProps, 'form' | 'draft' | 'busy' | 'amountError' | 'set'>) {
  const box = emailBox(form.hasEmail);
  const patch = (p: Partial<AddDraft>) => set((d) => ({ ...d, ...p }));
  return (
    <Field label={SUBSCRIPTION_COPY.paymentBlock}>
      <div className="bn-form">
        <Checkbox checked={draft.payNow} disabled={busy} label={SUBSCRIPTION_COPY.payNow} onChange={(payNow) => patch({ payNow })} />
        {draft.payNow && (
          <>
            <Field label={PAYMENT_COPY.amount} required error={amountError ?? undefined}>
              <Input inputMode="decimal" value={draft.amount} disabled={busy} onChange={(e) => patch({ amount: e.target.value })} />
            </Field>
            <Field label={PAYMENT_COPY.method}>
              <SegmentedControl aria-label={PAYMENT_COPY.method} options={METHOD_OPTIONS} value={draft.method} disabled={busy} onChange={(method) => patch({ method })} />
            </Field>
            <Checkbox checked={draft.collectedAtRink} disabled={busy} label={PAYMENT_COPY.atRink} onChange={(collectedAtRink) => patch({ collectedAtRink })} />
            <div>
              <Checkbox checked={draft.sendEmail && !box.disabled} disabled={box.disabled || busy} label={PAYMENT_COPY.sendEmail} onChange={(sendEmail) => patch({ sendEmail })} />
              {box.hint && <p className="ui-muted bn-hint">{box.hint}</p>}
            </div>
          </>
        )}
      </div>
    </Field>
  );
}

function FormBody(p: BodyProps) {
  const { form, draft, busy, set } = p;
  const options = itemOptions(form).map((o) => ({ value: o.value, label: o.hint ? `${o.label} (${o.hint})` : o.label }));
  const listName = form.lists.find((l) => l.priceListId === draft.listId)?.listName ?? form.lists[0]?.listName ?? '';
  const pick = (value: string) => {
    const [listId, ...rest] = value.split('|');
    set((d) => withItem(d, form, listId, rest.join('|')));
  };
  const start = (
    <Field label={SUBSCRIPTION_COPY.startsOn}>
      <DateInput value={p.startsOn} disabled={busy} onChange={(v) => { if (v) p.onStart(v); }} />
    </Field>
  );
  if (options.length === 0) return <div className="bn-form"><Notice tone="info">{SUBSCRIPTION_COPY.noItems(listName)}</Notice>{start}</div>;
  return (
    <div className="bn-form">
      <Field label={SUBSCRIPTION_COPY.itemLabel(listName)}>
        <Select value={draft.listId && draft.itemKey ? itemValue(draft.listId, draft.itemKey) : ''} options={options} disabled={busy} onChange={pick} />
      </Field>
      {start}
      <Field label={SUBSCRIPTION_COPY.expires}><span>{longDate(form.validUntil)}</span></Field>
      <CoverRows form={form} draft={draft} busy={busy} set={set} />
      <PaymentBlock form={form} draft={draft} busy={busy} amountError={p.amountError} set={set} />
    </div>
  );
}

/** "Adaugă abonament, <nume>" (5.8): one submit per click; the payment only when "Înregistrează plata acum" is on. */
export function AddSubscriptionWindow({ athlete, onClose }: Props) {
  const api = useMoneyApi();
  const [startsOn, setStartsOn] = React.useState<string | null>(null);
  const { form, draft, error, setDraft } = useForm(api, athlete.id, startsOn);
  const [amountError, setAmountError] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const submit = useSubmitOnce(async () => {
    if (!draft) return;
    const body = addBody(draft);
    setAmountError(null);
    setServerError(null);
    if (typeof body.error === 'string') { setAmountError(body.error); return; }
    try {
      const { data, undo } = await api.addSubscription(athlete.id, body);
      moneyUndoToast(addToast(data.athleteName, data.withPayment), undo?.actionId ?? null, api);
      onClose();
    } catch (err) {
      setServerError(requestErrorText(err, PRESENCE_ERRORS.failed));
    }
  });
  const hasItems = form !== null && form.lists.some((l) => l.items.length > 0);
  const footer = (
    <>
      <Button variant="ghost" disabled={submit.busy} onClick={onClose}>{SUBSCRIPTION_COPY.cancel}</Button>
      <Button loading={submit.busy} disabled={!hasItems || !draft} onClick={() => void submit.run()}>{SUBSCRIPTION_COPY.submit}</Button>
    </>
  );
  return (
    <WindowShell title={SUBSCRIPTION_COPY.windowTitle(athlete.name)} onClose={() => { if (!submit.busy) onClose(); }} footer={footer}>
      <style>{MONEY_CSS}</style>
      {(error || serverError) && <Notice tone="danger">{serverError ?? error}</Notice>}
      {form && draft && (
        <FormBody form={form} draft={draft} busy={submit.busy} amountError={amountError} startsOn={startsOn ?? form.startsOn} onStart={setStartsOn} set={setDraft} />
      )}
    </WindowShell>
  );
}
