import * as React from 'react';
import { Button, Loading, Notice, Select } from '../../ui';
import { IconTrash } from '../../ui/icons';
import { EMPTY_VALUE } from '../../../club/empty-value';
import type { ParcursStaff, PinView } from '../../../club/parcurs/api-types';
import {
  AWARD_OPTIONS, EMPTY_AWARD_FORM, JUMP_OPTIONS, LEVEL_OPTIONS, PARCURS_COPY as copy,
  awardBody, awardLine, friendshipCell, pinCell, type AwardChoice, type AwardForm, type PinCell,
} from '../../../club/parcurs/staff-view';
import type { SportiviApi } from './api';

type Remove = (() => void) | undefined;

function Cell({ cell, onRemove }: { cell: PinCell; onRemove?: Remove }) {
  return (
    <div className={`spv-pin${cell.earned ? '' : ' spv-pin--locked'}`}>
      <img src={cell.src} alt={cell.label} />
      {cell.count !== null && <span className="spv-pin-n">{cell.count}</span>}
      <span className="spv-pin-d">{cell.date}</span>
      {onRemove && <Button variant="ghost" size="sm" iconOnly icon={<IconTrash />} aria-label={copy.remove} onClick={onRemove} />}
    </div>
  );
}

function Row({ pins }: { pins: PinView[] }) {
  return <div className="spv-pins">{pins.map((p) => <Cell key={p.pin} cell={pinCell(p)} />)}</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="spv-pin-sec"><h3 className="spv-h">{title}</h3>{children}</section>;
}

type Friend = ParcursStaff['received'][number] & { to?: string };
function Friendship({ title, pins, onRemove }: { title: string; pins: Friend[]; onRemove: (id: string) => void }) {
  return (
    <div className="spv-pin-sub">
      <h4 className="spv-sub2">{title}</h4>
      {pins.length === 0 ? <span className="spv-muted">{EMPTY_VALUE}</span> : (
        <div className="spv-pins spv-pins--wide">
          {pins.map((p) => {
            const c = friendshipCell(p);
            return <div key={c.id} className="spv-friend"><Cell cell={c} onRemove={() => onRemove(c.id)} /><span className="spv-sub2">{c.who}</span></div>;
          })}
        </div>
      )}
    </div>
  );
}

type Run = (work: () => Promise<ParcursStaff>) => Promise<void>;

function AwardPicker({ onGive, busy }: { onGive: (b: NonNullable<ReturnType<typeof awardBody>>) => void; busy: boolean }) {
  const [form, setForm] = React.useState<AwardForm>(EMPTY_AWARD_FORM);
  const body = awardBody(form);
  return (
    <div className="spv-award">
      <Select
        aria-label={copy.select} placeholder={copy.select} value={form.kind} options={AWARD_OPTIONS}
        onChange={(v) => setForm({ ...EMPTY_AWARD_FORM, kind: v as AwardChoice | '' })}
      />
      {form.kind === 'jump' && (
        <>
          <Select aria-label={copy.select} placeholder={copy.select} value={form.jump} options={JUMP_OPTIONS} onChange={(jump) => setForm({ ...form, jump })} />
          <Select aria-label={copy.select} placeholder={copy.select} value={form.level} options={LEVEL_OPTIONS} onChange={(level) => setForm({ ...form, level })} />
        </>
      )}
      <Button variant="secondary" disabled={!body || busy} loading={busy} onClick={() => { if (body) { onGive(body); setForm(EMPTY_AWARD_FORM); } }}>{copy.award}</Button>
    </div>
  );
}

function Awards({ data, onRemove }: { data: ParcursStaff; onRemove: (id: string) => void }) {
  if (data.awards.length === 0) return null;
  return (
    <Section title={copy.awards}>
      <ul className="spv-hist">
        {data.awards.map((a) => (
          <li key={a.id} className="spv-award-row">
            <span>{awardLine(a)}</span>
            <Button variant="ghost" size="sm" iconOnly icon={<IconTrash />} aria-label={copy.remove} onClick={() => onRemove(a.id)} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

function useParcurs(api: SportiviApi, documentId: string) {
  const [data, setData] = React.useState<ParcursStaff | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(false);
  React.useEffect(() => {
    let off = false;
    api.parcurs(documentId).then((d) => { if (!off) setData(d); }).catch(() => { if (!off) setFailed(true); });
    return () => { off = true; };
  }, [api, documentId]);
  const run: Run = async (work) => {
    setBusy(true);
    setError(false);
    try { setData(await work()); } catch { setError(true); } finally { setBusy(false); }
  };
  return { data, failed, busy, error, run };
}

/** Parcurs: every pin of the athlete, who gave each award, the friendship pins both ways. Read on every opening. */
export function ParcursTab({ api, documentId }: { api: SportiviApi; documentId: string }) {
  const { data, failed, busy, error, run } = useParcurs(api, documentId);
  if (failed && !data) return <div className="ui-body"><Notice tone="danger">{copy.loadFailed}</Notice></div>;
  if (!data) return <Loading />;
  const s = copy.sections;
  const removePin = (id: string) => void run(() => api.parcursRemovePin(documentId, id));
  return (
    <div className="ui-body spv-parcurs">
      {error && <Notice tone="danger">{copy.actionFailed}</Notice>}
      <AwardPicker busy={busy} onGive={(b) => void run(() => api.parcursAward(documentId, b))} />
      <Section title={s.antrenamente}><Row pins={data.antrenamente} /></Section>
      <Section title={s.concursuri}><Row pins={data.concursuri} /></Section>
      <Section title={s.membru}><Row pins={data.membru} /></Section>
      <Section title={s.insigne}><Row pins={data.insigne} /></Section>
      <Section title={s.sarituri}>{data.sarituri.map((row, i) => <Row key={i} pins={row} />)}</Section>
      <Awards data={data} onRemove={(id) => void run(() => api.parcursRemoveAward(documentId, id))} />
      <Section title={s.prietenie}>
        <Friendship title={copy.received} pins={data.received} onRemove={removePin} />
        <Friendship title={copy.given} pins={data.given} onRemove={removePin} />
      </Section>
    </div>
  );
}
