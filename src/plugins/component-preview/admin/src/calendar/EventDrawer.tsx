import * as React from 'react';
import {
  Button,
  DateInput,
  Drawer,
  DrawerSection,
  Field,
  FieldRow,
  Input,
  Notice,
  RepeatableList,
  SegmentedControl,
  Select,
  StatusBadge,
  Switch,
  Tabs,
  Textarea,
  TimeInput,
} from '../../../../../admin/ui';
import {
  CAT_OF,
  CATEGORY_OPTIONS,
  EX_KIND_OPTIONS,
  FREQ_OPTIONS,
  OCC_MODE_OPTIONS,
  RO_MONTHS,
  SCOALA_CAT,
  SCOALA_STATE_OPTIONS,
  WD,
  WEEK_OF_MONTH_OPTIONS,
  fmtRoDay,
  fmtRoLong,
  fmtShort,
  seriesDates,
  spanHint,
  ymd,
  type Exception,
  type FormState,
} from './model';

/**
 * The event editor: a Drawer (side panel) over the calendar. One column:
 * Evenimentul, Când (with the repeat rules behind "Se repetă"), then the
 * fold-out Excepții / Datele seriei and the optional content. A date of a
 * recurring event opens on the "Această dată" tab.
 */

export interface EventDrawerProps {
  form: FormState | null;
  upd: (patch: Partial<FormState>) => void;
  scoalaView: 'date' | 'series';
  onScoalaView: (v: 'date' | 'series') => void;
  saving: boolean;
  saveError: string | null;
  /** Save enabled. */
  dirty: boolean;
  onSave: () => void;
  /** Close request (X, Esc, overlay, Anulează); the editor guards unsaved changes. */
  onClose: () => void;
  onDelete: () => void;
  onPickImage: () => void;
}

export function EventDrawer(props: EventDrawerProps) {
  const { form, onClose, scoalaView, onScoalaView } = props;
  if (!form) return null;

  const recurringDate = !!form.scoalaDate;
  const panelCols = !recurringDate || scoalaView === 'series';
  const title = recurringDate
    ? `${form.title || 'Eveniment'}, ${fmtRoDay(form.scoalaDate as string)}`
    : form.documentId
      ? form.title || 'Editează eveniment'
      : 'Adaugă eveniment';

  return (
    <Drawer
      open
      onClose={onClose}
      dismissable={!props.saving}
      className="cal-drawer"
      lead={<span className="cal-sw cal-sw--lg" data-calcat={CAT_OF[form.type] ?? 'scoala'} aria-hidden="true" />}
      title={title}
      subheader={
        recurringDate ? (
          <Tabs
            label="Ce editezi"
            value={scoalaView}
            onChange={(v) => onScoalaView(v as 'date' | 'series')}
            items={[
              { id: 'date', label: 'Această dată' },
              { id: 'series', label: 'Toată seria' },
            ]}
          />
        ) : undefined
      }
      footer={<Footer {...props} form={form} canDelete={!!form.documentId && panelCols} />}
    >
      {panelCols ? <SeriesFields {...props} form={form} /> : <DateFields {...props} form={form} />}
    </Drawer>
  );
}

type WithForm = EventDrawerProps & { form: FormState };

function Footer({ saving, saveError, dirty, onSave, onClose, onDelete, canDelete }: WithForm & { canDelete: boolean }) {
  return (
    <>
      {saveError && (
        <div className="cal-err">
          <Notice tone="danger">{saveError}</Notice>
        </div>
      )}
      {canDelete && (
        <Button variant="ghost" className="cal-del" onClick={onDelete} disabled={saving}>
          Șterge
        </Button>
      )}
      <span className="cal-sp" />
      <Button variant="secondary" className="cal-cancel" onClick={onClose} disabled={saving}>
        Anulează
      </Button>
      <Button className="cal-save" onClick={onSave} loading={saving} disabled={!dirty}>
        {saving ? 'Se salvează…' : 'Salvează'}
      </Button>
    </>
  );
}

/* ---- "Această dată" ---------------------------------------------------- */

function DateFields({ form, upd }: WithForm) {
  const date = form.scoalaDate as string;
  return (
    <div className="ui-dsec-b cal-date">
      {form.type === 'scoala' ? (
        <>
          <Field label="Stare">
            <SegmentedControl aria-label="Stare" block options={SCOALA_STATE_OPTIONS} value={form.scoalaState} onChange={(v) => upd({ scoalaState: v })} />
          </Field>
          {form.scoalaState !== 'curs' && (
            <Field label="Notă / motiv (opțional)">
              <Input value={form.scoalaNote} onChange={(e) => upd({ scoalaNote: e.target.value })} placeholder="ex. Vacanță de Crăciun" />
            </Field>
          )}
        </>
      ) : (
        <>
          <Field label="Pentru această dată">
            <SegmentedControl aria-label="Pentru această dată" block options={OCC_MODE_OPTIONS} value={form.occMode} onChange={(v) => upd({ occMode: v })} />
          </Field>
          {form.occMode === 'override' && (
            <>
              <Field label="Dată">
                <DateInput value={form.occNewDate || date} onChange={(v) => upd({ occNewDate: v ?? '' })} />
              </Field>
              <FieldRow>
                <Field label="Început">
                  <TimeInput value={form.occNewStart || form.startTime || null} onChange={(v) => upd({ occNewStart: v ?? '' })} />
                </Field>
                <Field label="Sfârșit">
                  <TimeInput value={form.occNewEnd || form.endTime || null} onChange={(v) => upd({ occNewEnd: v ?? '' })} />
                </Field>
              </FieldRow>
              {form.endsNextDay && <div className="ui-hint">Seria se termină a doua zi; ora de sfârșit rămâne pe ziua următoare.</div>}
            </>
          )}
        </>
      )}
      <div className="ui-hint">Se aplică doar pentru această dată ({fmtRoLong(date)}).</div>
    </div>
  );
}

/* ---- the whole event / series ------------------------------------------ */

function SeriesFields(p: WithForm) {
  const { form, upd } = p;
  const repeating = form.freq !== 'none';
  // Turning "Se repetă" off and on again restores the frequency it had.
  const lastFreq = React.useRef(repeating ? form.freq : 'weekly');
  if (repeating) lastFreq.current = form.freq;
  const cat = CAT_OF[form.type] ?? 'scoala';

  return (
    <>
      <DrawerSection title="Evenimentul">
        <Field label="Titlu">
          <Input value={form.title} onChange={(e) => upd({ title: e.target.value })} />
        </Field>
        <FieldRow>
          <Field label="Categorie">
            <div className="cal-catsel" data-calcat={cat}>
              <span className="cal-sw" aria-hidden="true" />
              <Select value={form.type} options={CATEGORY_OPTIONS} onChange={(v) => upd({ type: v })} />
            </div>
          </Field>
          <Field label="Etichetă (ex. Grupa A)">
            <Input value={form.label} onChange={(e) => upd({ label: e.target.value })} />
          </Field>
        </FieldRow>
      </DrawerSection>

      <DrawerSection title="Când">
        {/* The hours and the all-day switch sit on one line. Turning it on
            disables the time inputs instead of removing them, so the panel
            keeps its height. buildBody still saves null hours for an all-day
            event. */}
        <div className="cal-times">
          <Field label="Început">
            <TimeInput value={form.startTime || null} disabled={form.allDay} onChange={(v) => upd({ startTime: v ?? '' })} />
          </Field>
          <Field label="Sfârșit">
            {/* Constrained to after the start, unless the event is explicitly
                marked as ending the next day. */}
            <TimeInput
              value={form.endTime || null}
              disabled={form.allDay}
              min={form.endsNextDay || !form.startTime ? undefined : form.startTime}
              onChange={(v) => upd({ endTime: v ?? '' })}
            />
          </Field>
          <Switch className="cal-allday" checked={form.allDay} onChange={(c) => upd({ allDay: c })} label="Toată ziua" />
        </div>
        <Switch checked={form.endsNextDay} disabled={form.allDay} onChange={(c) => upd({ endsNextDay: c })} label="Se termină a doua zi" />
        {(form.allDay || (form.startTime && form.endTime)) && <div className="ui-hint">{spanHint(form)}</div>}

        <Switch checked={repeating} onChange={(on) => upd({ freq: on ? lastFreq.current : 'none' })} label="Se repetă" />
        {repeating ? (
          <>
            <SegmentedControl aria-label="Recurență" block options={FREQ_OPTIONS} value={form.freq} onChange={(v) => upd({ freq: v })} />
            <div className="ui-field">
              <span className="ui-label" id="cal-days-l">
                Zile
              </span>
              <div className="cal-days" role="group" aria-labelledby="cal-days-l">
                {WD.map(([k, lbl]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={form.days[k]}
                    className="cal-dayt"
                    onClick={() => upd({ days: { ...form.days, [k]: !form.days[k] } })}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            {form.freq === 'monthly' && (
              <Field label="Săptămâna din lună">
                <Select value={form.weekOfMonth} options={WEEK_OF_MONTH_OPTIONS} onChange={(v) => upd({ weekOfMonth: v })} />
              </Field>
            )}
            {/* Every recurring series needs a window, not just Școala:
                without one it repeated forever, and the biweekly parity
                shifted with whatever range happened to be fetched. */}
            <FieldRow>
              <Field label="De la">
                <DateInput value={form.seasonStart || null} onChange={(v) => upd({ seasonStart: v ?? '' })} />
              </Field>
              <Field label="Până la">
                <DateInput min={form.seasonStart || undefined} value={form.seasonEnd || null} onChange={(v) => upd({ seasonEnd: v ?? '' })} />
              </Field>
            </FieldRow>
            <div className="ui-hint">Obligatoriu. Seria poate dura cel mult un an.</div>
          </>
        ) : (
          <FieldRow>
            <Field label="Data">
              <DateInput value={form.singleDate || null} onChange={(v) => upd({ singleDate: v ?? '' })} />
            </Field>
            <Field label="Până la (opțional)">
              <DateInput value={form.endDate || null} onChange={(v) => upd({ endDate: v ?? '' })} />
            </Field>
          </FieldRow>
        )}
      </DrawerSection>

      {repeating && form.type === 'scoala' && <SeriesDates {...p} />}
      {repeating && form.type !== 'scoala' && <Exceptions {...p} />}
      <OptionalContent {...p} />
    </>
  );
}

/* ---- Școala: every date of the series ---------------------------------- */

function SeriesDates({ form, upd }: WithForm) {
  const [open, setOpen] = React.useState(false);
  const box = React.useRef<HTMLDivElement>(null);
  const anchors = React.useRef<Record<string, HTMLDivElement | null>>({});
  const todayKey = ymd(new Date());

  // The whole season expanded once, grouped by month for the subheaders.
  const months = React.useMemo(() => {
    const groups: Array<{ key: string; label: string; dates: string[] }> = [];
    for (const d of seriesDates(form)) {
      const key = d.slice(0, 7);
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: `${RO_MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`, dates: [] };
        groups.push(g);
      }
      g.dates.push(d);
    }
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type, form.freq, form.days, form.weekOfMonth, form.seasonStart, form.seasonEnd]);
  const count = months.reduce((n, g) => n + g.dates.length, 0);

  // Exceptions keyed by date, so a row reads its own state in one lookup.
  const exByDate = React.useMemo(() => {
    const m = new Map<string, Exception>();
    for (const x of form.exceptions) m.set(x.date, x);
    return m;
  }, [form.exceptions]);

  // A Școala occurrence is "curs" unless an exception says otherwise. `cancel`
  // predates the per-state kinds, so it reads as anulat.
  const rowState = (date: string): string => {
    const k = exByDate.get(date)?.kind;
    if (k === 'liber') return 'liber';
    if (k === 'anulat' || k === 'cancel') return 'anulat';
    return 'curs';
  };

  /**
   * Same write path as the "Această dată" tab: the state lives as an exception
   * on the event, and going back to Curs removes it. When the row is the date
   * the panel was opened on, the per-date fields are kept in step, because
   * save() rebuilds that one exception from them.
   */
  const setRowState = (date: string, next: string) => {
    const prev = exByDate.get(date);
    const rest = form.exceptions.filter((x) => x.date !== date);
    const exs = next === 'curs' ? rest : [...rest, { date, kind: next as Exception['kind'], newTitle: prev?.newTitle ?? '' }];
    exs.sort((a, b) => a.date.localeCompare(b.date));
    const patch: Partial<FormState> = { exceptions: exs };
    if (date === form.scoalaDate) {
      patch.scoalaState = next;
      patch.scoalaNote = next === 'curs' ? '' : (prev?.newTitle ?? '');
    }
    upd(patch);
  };

  const setRowNote = (date: string, note: string) => {
    const i = form.exceptions.findIndex((x) => x.date === date);
    if (i < 0) return;
    const exs = [...form.exceptions];
    exs[i] = { ...exs[i], newTitle: note };
    const patch: Partial<FormState> = { exceptions: exs };
    if (date === form.scoalaDate) patch.scoalaNote = note;
    upd(patch);
  };

  // Open on the current month, or the first month of the season when it has
  // not started yet. Past dates stay in the list, only muted.
  React.useEffect(() => {
    if (!open || months.length === 0) return;
    const nowKey = todayKey.slice(0, 7);
    const target = months.find((g) => g.key >= nowKey) ?? months[months.length - 1];
    const row = anchors.current[target.key];
    if (row && box.current) box.current.scrollTop = Math.max(0, row.offsetTop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form.documentId, months.length]);

  const times = form.allDay ? 'Toată ziua' : form.startTime && form.endTime ? `${form.startTime} - ${form.endTime}` : '';

  return (
    <DrawerSection title={`Datele seriei (${count})`} collapsible onToggle={setOpen}>
      {count === 0 ? (
        <div className="ui-hint">Alege zilele din săptămână și sezonul, apoi datele apar aici.</div>
      ) : (
        <>
          <div className="cal-dt" ref={box}>
            {months.map((g) => (
              <React.Fragment key={g.key}>
                <div
                  className="cal-dt-sub"
                  ref={(el) => {
                    anchors.current[g.key] = el;
                  }}
                >
                  {g.label}, {g.dates.length === 1 ? 'o dată' : `${g.dates.length} date`}
                </div>
                {g.dates.map((d) => {
                  const st = rowState(d);
                  const ex = exByDate.get(d);
                  return (
                    <div key={d} className={`cal-dt-row${d < todayKey ? ' cal-dt-row--past' : ''}${d === form.scoalaDate ? ' cal-dt-row--cur' : ''}`}>
                      <span className="cal-dt-date">
                        <span className="cal-sw" data-calcat={SCOALA_CAT[st]} aria-hidden="true" />
                        <span>
                          {fmtRoLong(d)}
                          {st === 'curs' && times && <span className="cal-muted"> {times}</span>}
                        </span>
                      </span>
                      <Select aria-label={`Stare ${fmtRoLong(d)}`} className="cal-dt-state" value={st} options={SCOALA_STATE_OPTIONS} onChange={(v) => setRowState(d, v)} />
                      {st !== 'curs' && (
                        <Input
                          className="cal-dt-note"
                          aria-label={`Notă ${fmtRoLong(d)}`}
                          value={ex?.newTitle ?? ''}
                          onChange={(e) => setRowNote(d, e.target.value)}
                          placeholder="ex. patinoar rezervat"
                        />
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          <div className="ui-hint">Nota se păstrează pentru zilele Liber sau Anulat. Modificările intră în calendar după Salvează.</div>
        </>
      )}
    </DrawerSection>
  );
}

/* ---- other series: cancelled / moved dates ----------------------------- */

function Exceptions({ form, upd }: WithForm) {
  return (
    <DrawerSection title={`Excepții (${form.exceptions.length})`} aside={<span className="cal-opt">anulări / mutări</span>} collapsible>
      <RepeatableList<Exception>
        items={form.exceptions}
        onChange={(next) => upd({ exceptions: next })}
        getKey={(_, i) => i}
        newItem={() => ({ date: '', kind: 'cancel' })}
        addLabel="Adaugă excepție"
        emptyLabel="Nicio excepție."
        itemLabel={(x, i) => (x.date ? `excepția din ${fmtShort(x.date)}` : `excepția ${i + 1}`)}
        expandable
        aria-label="Excepții"
        renderSummary={(x) => {
          const isMove = x.kind === 'override';
          const origH = form.startTime && form.endTime ? `${form.startTime}–${form.endTime}` : form.startTime || '';
          const nStart = (x.newStartTime ?? '').slice(0, 5);
          const nEnd = (x.newEndTime ?? '').slice(0, 5);
          const newH = nStart && nEnd ? `${nStart}–${nEnd}` : nStart || origH;
          const toDate = x.newDate || x.date;
          return (
            <span className="cal-exsum">
              <StatusBadge tone={isMove ? 'primary' : 'danger'}>{isMove ? 'Mutat' : 'Anulat'}</StatusBadge>
              {isMove ? (
                <span className="cal-chg">
                  <span className="cal-muted">
                    {fmtShort(x.date) || 'alege data'}
                    {origH ? ` ${origH}` : ''}
                  </span>
                  <span className="cal-muted"> → </span>
                  <b>
                    {fmtShort(toDate) || '…'}
                    {newH ? ` ${newH}` : ''}
                  </b>
                </span>
              ) : (
                <b className="cal-chg">{fmtShort(x.date) || 'alege data'}</b>
              )}
            </span>
          );
        }}
        renderRow={(x, i, { update }) => {
          const isMove = x.kind === 'override';
          const nStart = (x.newStartTime ?? '').slice(0, 5);
          const nEnd = (x.newEndTime ?? '').slice(0, 5);
          return (
            <div className="cal-stack">
              <SegmentedControl
                size="sm"
                aria-label="Tip excepție"
                options={EX_KIND_OPTIONS}
                value={isMove ? 'override' : 'cancel'}
                onChange={(v) => update({ kind: v as Exception['kind'] })}
              />
              <Field label="Data">
                <DateInput value={x.date || null} onChange={(v) => update({ date: v ?? '' })} />
              </Field>
              {isMove && (
                <>
                  <Field label="Data nouă">
                    <DateInput value={x.newDate || x.date || null} onChange={(v) => update({ newDate: v ?? '' })} />
                  </Field>
                  <FieldRow>
                    <Field label="Început" id={`cal-ex-start-${i}`}>
                      <TimeInput value={nStart || form.startTime || null} onChange={(v) => update({ newStartTime: v ?? '' })} />
                    </Field>
                    <Field label="Sfârșit" id={`cal-ex-end-${i}`}>
                      <TimeInput value={nEnd || form.endTime || null} onChange={(v) => update({ newEndTime: v ?? '' })} />
                    </Field>
                  </FieldRow>
                </>
              )}
            </div>
          );
        }}
      />
    </DrawerSection>
  );
}

/* ---- description, link, image ------------------------------------------ */

function OptionalContent({ form, upd, onPickImage }: WithForm) {
  return (
    <DrawerSection title="Conținut opțional: descriere, link, imagine" collapsible>
      <Field label="Descriere">
        <Textarea rows={3} value={form.description} onChange={(e) => upd({ description: e.target.value })} />
      </Field>
      <FieldRow>
        <Field label="Link">
          <Input value={form.linkUrl} onChange={(e) => upd({ linkUrl: e.target.value })} />
        </Field>
        <Field label="Etichetă link">
          <Input value={form.linkLabel} onChange={(e) => upd({ linkLabel: e.target.value })} />
        </Field>
      </FieldRow>
      <div className="ui-field">
        <span className="ui-label">Imagine</span>
        <div className="cal-img">
          <div className="cal-thumb" style={form.imageUrl ? { backgroundImage: `url(${form.imageUrl})` } : undefined} />
          <Button variant="ghost" size="sm" onClick={onPickImage}>
            {form.imageUrl ? 'schimbă imaginea' : 'alege imagine'}
          </Button>
          {form.imageUrl && (
            <Button variant="ghost" size="sm" className="cal-del" onClick={() => upd({ imageUrl: '' })}>
              elimină
            </Button>
          )}
        </div>
      </div>
    </DrawerSection>
  );
}
