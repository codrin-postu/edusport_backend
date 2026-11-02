import * as React from 'react';
import { Button, Checkbox, DateInput, Field, Input, Notice, SegmentedControl, Select, Textarea, adminToast } from '../../ui';
import { todayIso } from '../../../club/groups/http';
import {
  checkDraft, editDraft, editOptions, emailBox, newDraft, optionKey, showsRink, toBody, toEditBody, withOption,
  type DraftErrors, type PaymentDraft,
} from '../../../club/bani/payment-window';
import { METHOD_WORDS, PRESENCE_ERRORS } from '../../../club/presence/copy/core';
import { PAYMENT_COPY } from '../../../club/presence/copy/payments';
import type { PaymentRowView } from '../../../club/presence/money-api';
import type { PaymentFor, PaymentOption } from '../../../club/presence/payments/rules';
import type { PaymentMethod } from '../../../club/presence/types';
import { requestErrorText } from '../../../club/registration-panel';
import { WindowShell } from '../grupe/PanelShell';
import { useSportiviApi } from '../sportivi/api';
import { AthleteSearch } from '../sportivi/AthleteSearch';
import { useMoneyApi, type MoneyApi } from './api';
import { MONEY_CSS } from './styles';
import { moneyUndoToast } from './undo';
import { useSubmitOnce } from './useSubmitOnce';

type Mode = 'new' | 'edit';
type Props = { mode: Mode; athlete?: { id: string; name: string } | null; preselect?: PaymentFor | null; payment?: PaymentRowView; onClose: () => void };
type Loaded = { options: PaymentOption[]; hasEmail: boolean; failed: boolean };

const METHOD_OPTIONS = (Object.keys(METHOD_WORDS) as PaymentMethod[]).map((value) => ({ value, label: METHOD_WORDS[value] }));
const NONE: Loaded = { options: [], hasEmail: false, failed: false };

/** "Pentru" options and the e-mail address flag of the athlete, loaded once the athlete is known. */
function useOptions(api: MoneyApi, athleteId: string | null, payment: PaymentRowView | undefined): Loaded {
  const [loaded, setLoaded] = React.useState<Loaded>(NONE);
  React.useEffect(() => {
    setLoaded(NONE);
    if (!athleteId) return undefined;
    let off = false;
    Promise.all([api.paymentOptions(athleteId), api.athletePayments(athleteId)])
      .then(([options, page]) => { if (!off) setLoaded({ options: payment ? editOptions(options, payment) : options, hasEmail: page.hasEmail, failed: false }); })
      .catch(() => { if (!off) setLoaded({ ...NONE, failed: true }); });
    return () => { off = true; };
  }, [api, athleteId, payment]);
  return loaded;
}

type FieldsProps = {
  mode: Mode; draft: PaymentDraft; errors: DraftErrors; loaded: Loaded; busy: boolean; athleteName: string | null; locked: boolean;
  set: (patch: Partial<PaymentDraft>) => void; pickAthlete: (id: string, name: string) => void; pickOption: (key: string) => void;
};

function AthleteField({ f }: { f: FieldsProps }) {
  const sportivi = useSportiviApi();
  if (f.mode === 'edit') return null;
  return (
    <Field label={PAYMENT_COPY.athlete} required>
      {f.locked ? <span className="spv-name">{f.athleteName}</span> : (
        <div className="bn-athlete">
          {f.athleteName && <span className="spv-name">{f.athleteName}</span>}
          {!f.busy && <AthleteSearch api={sportivi} hideStatus={['anonimizat']} onPick={(c) => f.pickAthlete(c.documentId, c.name)} />}
        </div>
      )}
    </Field>
  );
}

function EmailBox({ f }: { f: FieldsProps }) {
  if (f.mode !== 'new') return null;
  const box = emailBox(f.loaded.hasEmail);
  return (
    <div>
      <Checkbox
        checked={f.draft.sendEmail && !box.disabled} disabled={box.disabled || f.busy} label={PAYMENT_COPY.sendEmail}
        onChange={(sendEmail) => f.set({ sendEmail })}
      />
      {box.hint && <p className="ui-muted bn-hint">{box.hint}</p>}
    </div>
  );
}

function PaymentFields({ f }: { f: FieldsProps }) {
  const { draft, errors, busy, set } = f;
  const options = f.loaded.options.map((o) => ({ value: optionKey(o.for), label: o.label }));
  return (
    <div className="bn-form">
      <AthleteField f={f} />
      <Field label={PAYMENT_COPY.amount} required error={errors.amount}>
        <Input inputMode="decimal" value={draft.amount} disabled={busy} onChange={(e) => set({ amount: e.target.value })} />
      </Field>
      <Field label={PAYMENT_COPY.date} required error={errors.paidOn}>
        <DateInput value={draft.paidOn} disabled={busy} onChange={(v) => { if (v) set({ paidOn: v }); }} />
      </Field>
      <Field label={PAYMENT_COPY.method}>
        <SegmentedControl aria-label={PAYMENT_COPY.method} options={METHOD_OPTIONS} value={draft.method} disabled={busy} onChange={(method) => set({ method })} />
      </Field>
      <Field label={PAYMENT_COPY.forWhat} required error={errors.for}>
        <Select value={draft.optionKey ?? ''} options={options} disabled={busy || !draft.athleteId} onChange={f.pickOption} />
      </Field>
      {showsRink(draft) && <Checkbox checked={draft.collectedAtRink} disabled={busy} label={PAYMENT_COPY.atRink} onChange={(collectedAtRink) => set({ collectedAtRink })} />}
      <EmailBox f={f} />
      <Field label={PAYMENT_COPY.note} hint={PAYMENT_COPY.noteHint}>
        <Textarea value={draft.note} disabled={busy} onChange={(e) => set({ note: e.target.value })} />
      </Field>
    </div>
  );
}

/** "Plată nouă" and "Editează plata" (5.10): one submit per click; errors under their fields, a server error in a Notice. */
export function PaymentWindow({ mode, athlete = null, preselect = null, payment, onClose }: Props) {
  const api = useMoneyApi();
  const today = React.useMemo(() => todayIso(), []);
  const [draft, setDraft] = React.useState<PaymentDraft>(() => (payment ? editDraft(payment) : newDraft({ athleteId: athlete?.id ?? null, today, preselect, options: [] })));
  const [athleteName, setAthleteName] = React.useState<string | null>(athlete?.name ?? payment?.athleteName ?? null);
  const [errors, setErrors] = React.useState<DraftErrors>({});
  const [serverError, setServerError] = React.useState<string | null>(null);
  const loaded = useOptions(api, draft.athleteId, payment);
  const preselected = React.useRef(false);
  React.useEffect(() => {
    if (mode !== 'new' || preselected.current || loaded.options.length === 0 || !preselect) return;
    preselected.current = true;
    setDraft((d) => withOption(d, optionKey(preselect), loaded.options));
  }, [mode, preselect, loaded.options]);
  const set = (patch: Partial<PaymentDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const submit = useSubmitOnce(async () => {
    const found = checkDraft(draft, today);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setServerError(null);
    try {
      if (payment) {
        const { data, undo } = await api.editPayment(payment.paymentId, toEditBody(draft, loaded.options));
        if (data.changed) moneyUndoToast(PAYMENT_COPY.saved, undo?.actionId ?? null, api);
        else adminToast.success(PAYMENT_COPY.unchanged);
      } else {
        const { data, undo } = await api.recordPayment(toBody(draft, loaded.options));
        moneyUndoToast(PAYMENT_COPY.recorded(data.amount, data.athleteName), undo?.actionId ?? null, api);
      }
      onClose();
    } catch (err) {
      setServerError(requestErrorText(err, PRESENCE_ERRORS.failed));
    }
  });
  const fields: FieldsProps = {
    mode, draft, errors, loaded, busy: submit.busy, athleteName, locked: athlete !== null, set,
    pickAthlete: (id, name) => { setAthleteName(name); setDraft((d) => ({ ...d, athleteId: id, optionKey: null, amount: '', collectedAtRink: false })); },
    pickOption: (key) => setDraft((d) => withOption(d, key, loaded.options)),
  };
  const footer = (
    <>
      <Button variant="ghost" disabled={submit.busy} onClick={onClose}>{PAYMENT_COPY.cancel}</Button>
      <Button loading={submit.busy} disabled={!draft.athleteId} onClick={() => void submit.run()}>{mode === 'edit' ? PAYMENT_COPY.save : PAYMENT_COPY.record}</Button>
    </>
  );
  return (
    <WindowShell title={mode === 'edit' ? PAYMENT_COPY.titleEdit : PAYMENT_COPY.titleNew} onClose={() => { if (!submit.busy) onClose(); }} footer={footer}>
      <style>{MONEY_CSS}</style>
      {(loaded.failed || serverError) && <Notice tone="danger">{serverError ?? PRESENCE_ERRORS.loadFailed}</Notice>}
      <PaymentFields f={fields} />
    </WindowShell>
  );
}
