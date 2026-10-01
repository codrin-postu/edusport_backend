import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
// Shared admin UI (src/admin/ui) on the --theme-* tokens; same bundle as the
// admin panel, like the ConfirmDialog import below.
import { ImagePicker, ensureAdminUi, toastAutosaved, type CalendarCategory } from '../../../../admin/ui';
// Canonical shared confirm dialog: src/admin/ConfirmDialog.tsx. The admin panel
// and this local plugin compile into the same vite bundle (src/admin/app.tsx
// imports this plugin by relative path), so importing across the boundary is
// safe. Edit the canonical file, not a copy.
import { ConfirmDialog } from '../../../../admin/ConfirmDialog';
import {
  CM_EVENT,
  buildBody,
  emptyForm,
  filterCatOf,
  fmtRoDate,
  formFromEvent,
  validateForm,
  withOccurrenceEdit,
  ymd,
  type FormState,
  type Occurrence,
} from './calendar/model';
import { AgendaList, CalendarToolbar, CompactMonth, MonthGrid, type CalView } from './calendar/CalendarView';
import { EventDrawer } from './calendar/EventDrawer';
import { CAL_CSS } from './calendar/styles';

/**
 * Admin calendar of the Program page (/admin/plugins/edusport-program): the
 * month grid or the Listă view, category filters, and the event editor in a
 * side panel. Writes calendar-event records straight to the admin API, one
 * event per save. Model and copy: ./calendar/model.ts; views:
 * ./calendar/CalendarView.tsx; editor: ./calendar/EventDrawer.tsx.
 */

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

const NARROW = '(max-width: 640px)';

/** True at phone width (<= 640px), following resizes. */
function useNarrow(): boolean {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.(NARROW).matches;
  const [narrow, setNarrow] = React.useState(get);
  React.useEffect(() => {
    const mq = window.matchMedia?.(NARROW);
    if (!mq) return undefined;
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

export default function ProgramOverviewEditor(_props: Props) {
  const { get, post, put, del } = useFetchClient();
  const today = new Date();
  const todayKey = ymd(today);
  const narrow = useNarrow();
  const [ym, setYm] = React.useState({ y: today.getFullYear(), m: today.getMonth() });
  // Phones open on Listă, wider screens on Lună.
  const [view, setView] = React.useState<CalView>(() => (narrow ? 'list' : 'month'));
  const [selDay, setSelDay] = React.useState<string | null>(todayKey);
  const [focusDate, setFocusDate] = React.useState<string | null>(null);
  const [occurrences, setOccurrences] = React.useState<Occurrence[]>([]);
  const [hidden, setHidden] = React.useState<Set<CalendarCategory>>(new Set());
  const [loading, setLoading] = React.useState(false);
  const [form, setForm] = React.useState<FormState | null>(null);
  // The form as it opened, to tell whether closing loses anything.
  const baseline = React.useRef('');
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [mediaOpen, setMediaOpen] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);
  // For an occurrence of a series: edit just this date's state, or the whole series.
  const [scoalaView, setScoalaView] = React.useState<'date' | 'series'>('date');
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [delError, setDelError] = React.useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);

  React.useEffect(() => {
    const first = new Date(ym.y, ym.m, 1);
    const last = new Date(ym.y, ym.m + 1, 0);
    let cancelled = false;
    setLoading(true);
    fetch(`/api/calendar/occurrences?from=${ymd(first)}&to=${ymd(last)}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => { if (!cancelled) setOccurrences(Array.isArray(j?.data) ? j.data : []); })
      .catch(() => { if (!cancelled) setOccurrences([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ym, reloadKey]);

  const byDate = React.useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    for (const o of occurrences) {
      const cat = filterCatOf(o);
      if (cat && hidden.has(cat)) continue;
      const arr = map.get(o.date) ?? [];
      arr.push(o);
      map.set(o.date, arr);
    }
    return map;
  }, [occurrences, hidden]);

  const goMonth = (delta: number) => {
    setYm(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
    setSelDay(null);
    setFocusDate(null);
  };
  const goToday = () => {
    setYm({ y: today.getFullYear(), m: today.getMonth() });
    setSelDay(todayKey);
    setFocusDate(view === 'list' ? todayKey : null);
  };
  const toggleCat = (k: CalendarCategory) => setHidden((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const open = (f: FormState) => {
    baseline.current = JSON.stringify(f);
    setSaveError(null);
    setScoalaView('date');
    setForm(f);
  };

  const openCreate = (date?: string) => {
    setDirty(true);
    open(emptyForm(date));
  };

  const openEdit = async (documentId?: string, clickedDate?: string) => {
    if (!documentId) return;
    try {
      const res: any = await get(`${CM_EVENT}/${documentId}`);
      const e = (res?.data?.data ?? res?.data) as any;
      setDirty(false);
      open(formFromEvent(documentId, e, clickedDate));
    } catch (err) { /* ignore */ }
  };

  /** X, Esc, overlay, Anulează: ask first when the form changed since it opened. */
  const requestClose = () => {
    if (saving || !form) return;
    if (JSON.stringify(form) !== baseline.current) setConfirmDiscard(true);
    else setForm(null);
  };

  const save = async () => {
    if (!form) return;
    // Editing one occurrence writes its state as an exception of the series.
    const f = withOccurrenceEdit(form);
    if (!form.scoalaDate && !form.title.trim()) {
      setSaveError('Titlul este obligatoriu.');
      return;
    }
    // Series bounds / time order. Blocks the save; the server rejects the same
    // payload anyway, so failing here just keeps the form usable.
    const invalid = validateForm(f);
    if (invalid) {
      setSaveError(invalid);
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const body = buildBody(f);
      if (f.documentId) await put(`${CM_EVENT}/${f.documentId}`, body);
      else await post(CM_EVENT, body);
      setForm(null);
      setDirty(false);
      setReloadKey((k) => k + 1);
      toastAutosaved();
    } catch (err: any) {
      // Surface the server's Romanian validation message instead of silently
      // leaving the panel open with no explanation.
      const msg = err?.response?.data?.error?.message ?? err?.message;
      setSaveError(msg || 'Salvarea a eșuat.');
    }
    finally { setSaving(false); }
  };

  // Delete confirmation (shared ConfirmDialog). `remove` opens it; `doRemove`
  // performs the delete once confirmed.
  const remove = () => {
    if (!form?.documentId) { setForm(null); return; }
    setDelError(null);
    setConfirmDel(true);
  };

  const doRemove = async () => {
    if (!form?.documentId) { setConfirmDel(false); setForm(null); return; }
    setSaving(true);
    setDelError(null);
    try {
      await del(`${CM_EVENT}/${form.documentId}`);
      setConfirmDel(false);
      setForm(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      // Keep the dialog open and say so, instead of silently doing nothing.
      setDelError('Ștergerea a eșuat.');
    } finally {
      setSaving(false);
    }
  };

  const upd = (patch: Partial<FormState>) => { setDirty(true); setSaveError(null); setForm((f) => (f ? { ...f, ...patch } : f)); };

  // The editor also renders inside the content-manager (custom field), where
  // no AdminPage injects the shared stylesheet: inject it here too.
  React.useInsertionEffect(() => ensureAdminUi(), []);

  const grid = {
    y: ym.y,
    m: ym.m,
    byDate,
    todayKey,
    onEvent: (o: Occurrence, date: string) => void openEdit(o.documentId, date),
    onAddOn: (date: string) => openCreate(date),
  };

  return (
    <div className="ui-root cal">
      <style>{CAL_CSS}</style>
      <div className="cal-frame">
        <CalendarToolbar
          y={ym.y}
          m={ym.m}
          narrow={narrow}
          view={view}
          loading={loading}
          onPrev={() => goMonth(-1)}
          onNext={() => goMonth(1)}
          onToday={goToday}
          onView={(v) => {
            setView(v);
            setFocusDate(null);
          }}
          onAdd={() => openCreate()}
          hidden={hidden}
          onToggle={toggleCat}
        />
        {view === 'list' ? (
          <AgendaList {...grid} focusDate={focusDate} />
        ) : narrow ? (
          <CompactMonth {...grid} selected={selDay} onSelect={setSelDay} />
        ) : (
          <MonthGrid
            {...grid}
            onMore={(date) => {
              setView('list');
              setFocusDate(date);
            }}
          />
        )}
      </div>

      <EventDrawer
        form={form}
        upd={upd}
        scoalaView={scoalaView}
        onScoalaView={setScoalaView}
        saving={saving}
        saveError={saveError}
        dirty={dirty}
        onSave={() => void save()}
        onClose={requestClose}
        onDelete={remove}
        onPickImage={() => setMediaOpen(true)}
      />

      <ConfirmDialog
        open={confirmDiscard}
        title="Renunți la modificări?"
        message="Modificările nesalvate din acest eveniment se pierd."
        confirmLabel="Da, renunță"
        cancelLabel="Nu"
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          setForm(null);
        }}
      />

      <ConfirmDialog
        open={confirmDel}
        title={form && form.freq !== 'none' ? 'Ștergi seria?' : 'Ștergi evenimentul?'}
        message={
          !form
            ? ''
            : form.freq !== 'none'
              ? `Ștergi seria „${form.title || 'fără titlu'}"? Toate aparițiile din calendar dispar definitiv. Acțiunea nu poate fi anulată.`
              : `Ștergi evenimentul „${form.title || 'fără titlu'}"${form.singleDate ? ` din ${fmtRoDate(form.singleDate)}` : ''}? Acțiunea nu poate fi anulată.`
        }
        busy={saving}
        error={delError}
        onCancel={() => setConfirmDel(false)}
        onConfirm={doRemove}
      />

      <ImagePicker
        open={mediaOpen}
        onClose={() => setMediaOpen(false)}
        onPick={(img) => {
          upd({ imageUrl: img.url });
          setMediaOpen(false);
        }}
      />
    </div>
  );
}
