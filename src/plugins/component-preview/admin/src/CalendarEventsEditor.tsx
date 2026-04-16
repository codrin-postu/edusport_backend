import * as React from 'react';
import { useField } from '@strapi/admin/strapi-admin';
import { Trash } from '@strapi/icons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CalendarEventType = 'curs' | 'liber' | 'holiday' | 'vacation' | 'eveniment' | 'concurs';
type WeekendState = 'unmarked' | 'curs' | 'liber';

interface CalendarEvent {
  type: CalendarEventType;
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD" inclusive
  title?: string | null;
  description?: string | null; // tooltip text, e.g. "10:00–10:50 · 11:00–11:50"
}

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Season config helpers — dynamic range
// ---------------------------------------------------------------------------

const MONTH_LABELS = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
];

function getYearOptions(): number[] {
  const cur = new Date().getFullYear();
  return [cur - 1, cur, cur + 1, cur + 2, cur + 3];
}

function buildSeasonMonths(
  startYear: number, startMonth: number,
  endYear: number, endMonth: number,
): Array<{ year: number; month: number; label: string }> {
  const result: Array<{ year: number; month: number; label: string }> = [];
  let y = startYear, m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    result.push({ year: y, month: m, label: `${MONTH_LABELS[m]} ${y}` });
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return result;
}

function detectRangeFromEvents(events: CalendarEvent[]): {
  startYear: number; startMonth: number; endYear: number; endMonth: number;
} | null {
  const weekendEvents = events.filter((e) => e.type === 'curs' || e.type === 'liber');
  if (weekendEvents.length === 0) return null;
  const dates = weekendEvents.flatMap((e) => [new Date(e.startDate + 'T00:00:00'), new Date(e.endDate + 'T00:00:00')]);
  const minDate = dates.reduce((a, b) => (a < b ? a : b));
  const maxDate = dates.reduce((a, b) => (a > b ? a : b));
  return {
    startYear: minDate.getFullYear(),
    startMonth: minDate.getMonth(),
    endYear: maxDate.getFullYear(),
    endMonth: maxDate.getMonth(),
  };
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface WeekendPair {
  satDate: string;
  sunDate: string;
  label: string; // "18–19"
}

function getWeekendPairs(year: number, month: number): WeekendPair[] {
  const pairs: WeekendPair[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    if (d.getDay() === 6) {
      const sat = new Date(d);
      const sun = new Date(d);
      sun.setDate(sun.getDate() + 1);
      pairs.push({
        satDate: toISO(sat),
        sunDate: toISO(sun),
        label: `${sat.getDate()}–${sun.getDate()}`,
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return pairs;
}

const CHIP_CYCLE: WeekendState[] = ['unmarked', 'curs', 'liber'];

function getWeekendEvent(satDate: string, events: CalendarEvent[]): CalendarEvent | undefined {
  return events.find((e) => (e.type === 'curs' || e.type === 'liber') && e.startDate === satDate);
}

function applyWeekendClick(
  satDate: string,
  sunDate: string,
  events: CalendarEvent[],
  defaultCursDesc: string,
  defaultLiberDesc: string,
): CalendarEvent[] {
  const existing = getWeekendEvent(satDate, events);
  const current: WeekendState = (existing?.type as WeekendState) ?? 'unmarked';
  const next = CHIP_CYCLE[(CHIP_CYCLE.indexOf(current) + 1) % CHIP_CYCLE.length];
  const filtered = events.filter(
    (e) => !((e.type === 'curs' || e.type === 'liber') && e.startDate === satDate),
  );
  if (next === 'unmarked') return filtered;
  // Use existing individual description, else fall back to the global default
  const description =
    existing?.description != null && existing.description !== ''
      ? existing.description
      : next === 'curs' ? defaultCursDesc : defaultLiberDesc;
  return [...filtered, { type: next, startDate: satDate, endDate: sunDate, description: description || undefined }];
}

function applyWeekendDescription(satDate: string, description: string, events: CalendarEvent[]): CalendarEvent[] {
  return events.map((e) =>
    (e.type === 'curs' || e.type === 'liber') && e.startDate === satDate
      ? { ...e, description: description || undefined }
      : e,
  );
}

// ---------------------------------------------------------------------------
// useDark hook
// ---------------------------------------------------------------------------

function useDark() {
  const [dark, setDark] = React.useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark',
  );
  React.useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.getAttribute('data-theme') === 'dark'),
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

// ---------------------------------------------------------------------------
// WeekendChip — wider card with inline description input below
// ---------------------------------------------------------------------------

interface ChipProps {
  pair: WeekendPair;
  state: WeekendState;
  description: string;
  onClick: () => void;
  onDescriptionChange: (val: string) => void;
  s: Record<string, React.CSSProperties>;
}

function WeekendChip({ pair, state, description, onClick, onDescriptionChange, s }: ChipProps) {
  const chipStyle: React.CSSProperties = {
    ...s.chip,
    ...(state === 'curs' ? s.chipCurs : state === 'liber' ? s.chipLiber : s.chipUnmarked),
  };
  return (
    <div style={s.chipWrapper}>
      <button type="button" onClick={onClick} style={chipStyle} title="Clic pentru a cicla starea">
        <span style={s.chipDays}>{pair.label}</span>
        <span style={s.chipState}>
          {state === 'curs' ? 'curs' : state === 'liber' ? 'liber' : '—'}
        </span>
      </button>
      {(state === 'curs' || state === 'liber') && (
        <input
          type="text"
          value={description}
          placeholder="Descriere tooltip…"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onDescriptionChange(e.target.value)}
          style={{
            ...s.chipDescInput,
            ...(state === 'curs' ? s.chipDescInputCurs : s.chipDescInputLiber),
          }}
          title="Text afișat în tooltip pentru acest weekend"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MonthBlock — full-width row: label on left, chips on right
// ---------------------------------------------------------------------------

interface MonthBlockProps {
  year: number;
  month: number;
  label: string;
  events: CalendarEvent[];
  onChipClick: (satDate: string, sunDate: string) => void;
  onDescriptionChange: (satDate: string, val: string) => void;
  s: Record<string, React.CSSProperties>;
}

function MonthBlock({ year, month, label, events, onChipClick, onDescriptionChange, s }: MonthBlockProps) {
  const pairs = React.useMemo(() => getWeekendPairs(year, month), [year, month]);
  return (
    <div style={s.monthRow}>
      <div style={s.monthLabelCol}>
        <span style={s.monthLabel}>{label}</span>
      </div>
      <div style={s.chipsRow}>
        {pairs.map((pair) => {
          const ev = getWeekendEvent(pair.satDate, events);
          return (
            <WeekendChip
              key={pair.satDate}
              pair={pair}
              state={(ev?.type as WeekendState) ?? 'unmarked'}
              description={ev?.description ?? ''}
              onClick={() => onChipClick(pair.satDate, pair.sunDate)}
              onDescriptionChange={(val) => onDescriptionChange(pair.satDate, val)}
              s={s}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CalendarEventsEditor({ name }: Props) {
  const field = useField(name);
  const fieldSeasonStart = useField('seasonStart');
  const fieldSeasonEnd = useField('seasonEnd');
  const dark = useDark();

  const [events, setEvents] = React.useState<CalendarEvent[]>(() =>
    Array.isArray(field.value) ? (field.value as CalendarEvent[]) : [],
  );

  // Season range — persisted in seasonStart/seasonEnd Strapi fields ("YYYY-MM")
  // Init: read from saved Strapi values, then fall back to auto-detect from events, then default
  const [seasonRange, setSeasonRange] = React.useState<{
    startYear: number; startMonth: number; endYear: number; endMonth: number;
  }>(() => {
    const parseYearMonth = (val: unknown): { year: number; month: number } | null => {
      if (typeof val !== 'string' || !/^\d{4}-\d{2}$/.test(val)) return null;
      const [y, m] = val.split('-').map(Number);
      return { year: y, month: m - 1 }; // month 0-indexed
    };
    const savedStart = parseYearMonth(fieldSeasonStart.value);
    const savedEnd = parseYearMonth(fieldSeasonEnd.value);
    if (savedStart && savedEnd) {
      return { startYear: savedStart.year, startMonth: savedStart.month, endYear: savedEnd.year, endMonth: savedEnd.month };
    }
    const initial = Array.isArray(field.value) ? (field.value as CalendarEvent[]) : [];
    const detected = detectRangeFromEvents(initial);
    if (detected) return detected;
    const now = new Date();
    const y = now.getFullYear();
    return { startYear: y, startMonth: 9, endYear: y + 1, endMonth: 4 };
  });

  const seasonMonths = React.useMemo(
    () => buildSeasonMonths(seasonRange.startYear, seasonRange.startMonth, seasonRange.endYear, seasonRange.endMonth),
    [seasonRange],
  );

  const yearOptions = React.useMemo(() => getYearOptions(), []);

  const handleSeasonChange = (key: 'startYear' | 'startMonth' | 'endYear' | 'endMonth', val: number) => {
    setSeasonRange((prev) => {
      const next = { ...prev, [key]: val };
      // Clamp: end must not be before start
      const startYM = next.startYear * 12 + next.startMonth;
      const endYM = next.endYear * 12 + next.endMonth;
      if (endYM < startYM) {
        next.endYear = next.startYear;
        next.endMonth = next.startMonth;
      }
      // Persist to Strapi sibling fields as "YYYY-MM"
      const toYearMonth = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`;
      fieldSeasonStart.onChange('seasonStart', toYearMonth(next.startYear, next.startMonth));
      fieldSeasonEnd.onChange('seasonEnd', toYearMonth(next.endYear, next.endMonth));
      return next;
    });
  };

  // Global defaults — not stored in CalendarEvent[], just UI state
  const [defaultCursDesc, setDefaultCursDesc] = React.useState('10:00–10:50 · 11:00–11:50');
  const [defaultLiberDesc, setDefaultLiberDesc] = React.useState('');

  React.useEffect(() => {
    if (Array.isArray(field.value)) setEvents(field.value as CalendarEvent[]);
  }, [field.value]);

  const commit = (next: CalendarEvent[]) => {
    setEvents(next);
    field.onChange(name, next);
  };

  const handleChipClick = (satDate: string, sunDate: string) => {
    commit(applyWeekendClick(satDate, sunDate, events, defaultCursDesc, defaultLiberDesc));
  };

  const handleDescriptionChange = (satDate: string, val: string) => {
    commit(applyWeekendDescription(satDate, val, events));
  };

  const specialEvents = events.filter(
    (e) => e.type === 'holiday' || e.type === 'vacation' || e.type === 'eveniment' || e.type === 'concurs',
  );

  const addSpecialEvent = () => {
    commit([...events, { type: 'holiday', startDate: '', endDate: '', title: '', description: '' }]);
  };

  const isSpecial = (e: CalendarEvent) =>
    e.type === 'holiday' || e.type === 'vacation' || e.type === 'eveniment' || e.type === 'concurs';

  const updateSpecialEvent = (specialIdx: number, patch: Partial<CalendarEvent>) => {
    let sIdx = -1;
    const next = events.map((e) => {
      if (isSpecial(e)) {
        sIdx++;
        if (sIdx === specialIdx) return { ...e, ...patch };
      }
      return e;
    });
    commit(next);
  };

  const removeSpecialEvent = (specialIdx: number) => {
    let sIdx = -1;
    const next = events.filter((e) => {
      if (isSpecial(e)) {
        sIdx++;
        return sIdx !== specialIdx;
      }
      return true;
    });
    commit(next);
  };

  const s = makeStyles(dark);

  return (
    <div style={s.groupWrapper}>
      {/* Header */}
      <div style={s.groupHeader}>
        <span style={s.groupTitle}>Calendar sezonal</span>
        <span style={s.groupDesc}>
          Clic pe un weekend pentru a cicla starea: <strong>—</strong> → <strong style={{ color: dark ? '#4ade80' : '#059669' }}>curs</strong> → <strong style={{ color: dark ? '#9ca3af' : '#6b7280' }}>liber</strong> → nesetat. Descrierile implicite de mai jos se aplică automat la weekendurile noi; le poți suprascrie individual.
        </span>
      </div>

      <div style={s.groupBody}>
        {/* Panel A: Season config */}
        <div style={s.panelSection}>
          <div style={s.panelHeader}>
            <span style={s.panelTitle}>Configurare sezon</span>
          </div>
          <div style={s.seasonConfigRow}>
            <span style={s.seasonConfigLabel}>De la</span>
            <select
              value={seasonRange.startMonth}
              onChange={(e) => handleSeasonChange('startMonth', Number(e.target.value))}
              style={s.seasonSelect}
            >
              {MONTH_LABELS.map((label, i) => (
                <option key={i} value={i}>{label}</option>
              ))}
            </select>
            <select
              value={seasonRange.startYear}
              onChange={(e) => handleSeasonChange('startYear', Number(e.target.value))}
              style={s.seasonSelect}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <span style={{ ...s.seasonConfigLabel, marginLeft: 16 }}>Până la</span>
            <select
              value={seasonRange.endMonth}
              onChange={(e) => handleSeasonChange('endMonth', Number(e.target.value))}
              style={s.seasonSelect}
            >
              {MONTH_LABELS.map((label, i) => (
                <option key={i} value={i}>{label}</option>
              ))}
            </select>
            <select
              value={seasonRange.endYear}
              onChange={(e) => handleSeasonChange('endYear', Number(e.target.value))}
              style={s.seasonSelect}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <span style={s.seasonMonthCount}>
              {seasonMonths.length} {seasonMonths.length === 1 ? 'lună' : 'luni'}
            </span>
          </div>
        </div>

        {/* Panel B: Weekend picker */}
        <div style={s.panelSection}>
          <div style={s.panelHeader}>
            <span style={s.panelTitle}>Weekend-uri</span>
          </div>

          {/* Global defaults row */}
          <div style={s.defaultsRow}>
            <div style={s.defaultField}>
              <span style={{ ...s.defaultLabel, color: dark ? '#4ade80' : '#059669' }}>
                Descriere implicită — Curs
              </span>
              <input
                type="text"
                value={defaultCursDesc}
                placeholder="ex: 10:00–10:50 · 11:00–11:50"
                onChange={(e) => setDefaultCursDesc(e.target.value)}
                style={{ ...s.defaultInput, ...s.defaultInputCurs }}
              />
            </div>
            <div style={s.defaultField}>
              <span style={{ ...s.defaultLabel, color: dark ? '#9ca3af' : '#6b7280' }}>
                Descriere implicită — Liber
              </span>
              <input
                type="text"
                value={defaultLiberDesc}
                placeholder="ex: Weekend liber"
                onChange={(e) => setDefaultLiberDesc(e.target.value)}
                style={{ ...s.defaultInput, ...s.defaultInputLiber }}
              />
            </div>
          </div>

          {/* Month rows */}
          <div style={s.monthsWrap}>
            {seasonMonths.map((m) => (
              <MonthBlock
                key={`${m.year}-${m.month}`}
                year={m.year}
                month={m.month}
                label={m.label}
                events={events}
                onChipClick={handleChipClick}
                onDescriptionChange={handleDescriptionChange}
                s={s}
              />
            ))}
          </div>

          {/* Legend */}
          <div style={s.legend}>
            <span style={{ ...s.legendDot, ...s.legendDotCurs }} />
            <span style={s.legendText}>Curs</span>
            <span style={{ ...s.legendDot, ...s.legendDotLiber }} />
            <span style={s.legendText}>Liber</span>
            <span style={{ ...s.legendDot, ...s.legendDotUnmarked }} />
            <span style={s.legendText}>Nesetat</span>
          </div>
        </div>

        {/* Panel C: Special events */}
        <div style={s.panelSection}>
          <div style={s.panelHeader}>
            <span style={s.panelTitle}>Zile speciale (sărbători, vacanțe, evenimente, concursuri)</span>
            <button type="button" onClick={addSpecialEvent} style={s.addBtn}>
              + Adaugă
            </button>
          </div>

          {specialEvents.length === 0 && (
            <div style={s.emptyState}>Nicio zi specială adăugată</div>
          )}

          {specialEvents.map((ev, i) => (
            <div key={i} style={{ ...s.specialRow, ...(i % 2 === 1 ? s.specialRowAlt : {}) }}>

              {/* Row A: type + title + delete */}
              <div style={s.specialRowA}>
                <select
                  value={ev.type}
                  onChange={(e) => updateSpecialEvent(i, { type: e.target.value as CalendarEventType })}
                  style={s.selectType}
                >
                  <option value="holiday">🟡 Sărbătoare</option>
                  <option value="vacation">🔵 Vacanță</option>
                  <option value="eveniment">🟠 Eveniment</option>
                  <option value="concurs">🔴 Concurs</option>
                </select>

                <input
                  type="text"
                  value={ev.title ?? ''}
                  placeholder="Titlu (ex: Crăciun, Concurs Regional)…"
                  onChange={(e) => updateSpecialEvent(i, { title: e.target.value })}
                  style={{ ...s.inputBase, flex: 1, ...(!ev.title ? s.inputError : {}) }}
                />

                <button
                  type="button"
                  onClick={() => removeSpecialEvent(i)}
                  style={s.deleteBtn}
                  title="Șterge"
                >
                  <Trash style={{ width: 13, height: 13 }} />
                </button>
              </div>

              {/* Row B: description */}
              <input
                type="text"
                value={ev.description ?? ''}
                placeholder="Descriere tooltip (opțional)…"
                onChange={(e) => updateSpecialEvent(i, { description: e.target.value || undefined })}
                style={{ ...s.inputBase, width: '100%' }}
              />

              {/* Row C: dates */}
              <div style={s.specialRowC}>
                <div style={s.dateGroup}>
                  <span style={s.dateLabel}>De la</span>
                  <input
                    type="date"
                    value={ev.startDate}
                    onChange={(e) => updateSpecialEvent(i, { startDate: e.target.value })}
                    style={s.inputDate}
                  />
                </div>

                <div style={s.dateGroup}>
                  <span style={s.dateLabel}>Până la</span>
                  <input
                    type="date"
                    value={ev.endDate}
                    onChange={(e) => updateSpecialEvent(i, { endDate: e.target.value })}
                    style={s.inputDate}
                  />
                </div>
              </div>

            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function makeStyles(dark: boolean): Record<string, React.CSSProperties> {
  const outerBorder = dark ? '#2a2a3e' : '#d0d0e0';
  const innerBorder = dark ? '#333340' : '#e0e0e8';
  const bg = dark ? '#1e1e2e' : '#fff';
  const subtle = dark ? '#666' : '#999';
  const inputBorder = dark ? '#4a4a6a' : '#c0c0d0';
  const inputBg = dark ? '#252540' : '#fff';
  const inputColor = dark ? '#e0e0f0' : '#111';

  return {
    groupWrapper: {
      border: `1px solid ${outerBorder}`,
      borderRadius: 10,
      overflow: 'hidden',
      background: dark ? '#16162a' : '#f8f8fc',
    },
    groupHeader: {
      padding: '12px 16px 10px',
      borderBottom: `1px solid ${outerBorder}`,
      background: dark ? '#1a1a30' : '#eeeef8',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 6,
    },
    groupTitle: {
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
      color: dark ? '#9999cc' : '#4a4a88',
    },
    groupDesc: {
      fontSize: 11,
      color: dark ? '#888' : '#666',
      lineHeight: 1.6,
    },
    groupBody: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 0,
    },

    // Panels
    panelSection: {
      borderBottom: `1px solid ${outerBorder}`,
    },
    panelHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 12px',
      background: dark ? '#1d1d30' : '#f0f0f8',
      borderBottom: `1px solid ${innerBorder}`,
    },
    panelTitle: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.07em',
      textTransform: 'uppercase' as const,
      color: dark ? '#7777aa' : '#5555aa',
    },

    // Global defaults row
    defaultsRow: {
      display: 'flex',
      gap: 12,
      padding: '10px 12px',
      borderBottom: `1px solid ${innerBorder}`,
      background: dark ? '#191926' : '#f5f5fb',
      flexWrap: 'wrap' as const,
    },
    defaultField: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 3,
      flex: 1,
      minWidth: 200,
    },
    defaultLabel: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.05em',
      textTransform: 'uppercase' as const,
    },
    defaultInput: {
      padding: '5px 8px',
      borderRadius: 4,
      fontSize: 12,
      outline: 'none',
      boxSizing: 'border-box' as const,
      height: 28,
      fontFamily: 'inherit',
      width: '100%',
    },
    defaultInputCurs: {
      border: `1px solid ${dark ? '#1a6b5c' : '#6ee7b7'}`,
      background: dark ? '#0a2a22' : '#ecfdf5',
      color: dark ? '#4ade80' : '#065f46',
    },
    defaultInputLiber: {
      border: `1px solid ${dark ? '#444' : '#d1d5db'}`,
      background: dark ? '#1e1e2e' : '#f9fafb',
      color: dark ? '#9ca3af' : '#374151',
    },

    // Month grid — one row per month
    monthsWrap: {
      display: 'flex',
      flexDirection: 'column' as const,
      background: bg,
    },
    monthRow: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: '8px 12px',
      borderBottom: `1px solid ${innerBorder}`,
    },
    monthLabelCol: {
      width: 110,
      flexShrink: 0,
      paddingTop: 6,
    },
    monthLabel: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.05em',
      textTransform: 'uppercase' as const,
      color: subtle,
    },
    chipsRow: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: 6,
      flex: 1,
    },

    // Weekend chips — wider to accommodate description input
    chipWrapper: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'stretch',
      gap: 3,
      width: 100,
    },
    chip: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      minHeight: 42,
      padding: '4px 6px',
      borderRadius: 6,
      cursor: 'pointer',
      border: '1px solid transparent',
      transition: 'background 0.1s, border-color 0.1s',
      gap: 1,
      boxSizing: 'border-box' as const,
    },
    chipUnmarked: {
      background: dark ? '#1e1e2e' : '#f3f4f6',
      border: `1px dashed ${dark ? '#333' : '#d1d5db'}`,
      color: dark ? '#444' : '#aaa',
    },
    chipCurs: {
      background: dark ? '#0d3d38' : '#d1fae5',
      border: `1px solid ${dark ? '#1a6b5c' : '#6ee7b7'}`,
      color: dark ? '#4ade80' : '#059669',
    },
    chipLiber: {
      background: dark ? '#252525' : '#f3f4f6',
      border: `1px solid ${dark ? '#444' : '#d1d5db'}`,
      color: dark ? '#9ca3af' : '#6b7280',
    },
    chipDays: {
      fontSize: 12,
      fontWeight: 700,
      lineHeight: 1,
    },
    chipState: {
      fontSize: 9,
      fontWeight: 500,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.04em',
      lineHeight: 1,
      opacity: 0.8,
    },
    chipDescInput: {
      padding: '3px 5px',
      borderRadius: 4,
      fontSize: 10,
      outline: 'none',
      width: '100%',
      boxSizing: 'border-box' as const,
      fontFamily: 'inherit',
    },
    chipDescInputCurs: {
      border: `1px solid ${dark ? '#1a5a4a' : '#6ee7b7'}`,
      background: dark ? '#0a2a22' : '#ecfdf5',
      color: dark ? '#4ade80' : '#065f46',
    },
    chipDescInputLiber: {
      border: `1px solid ${dark ? '#3a3a3a' : '#d1d5db'}`,
      background: dark ? '#1a1a1a' : '#f9fafb',
      color: dark ? '#9ca3af' : '#374151',
    },

    // Legend
    legend: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '8px 12px',
      borderTop: `1px solid ${innerBorder}`,
      background: dark ? '#191928' : '#f7f7fc',
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 2,
      flexShrink: 0,
    },
    legendDotCurs: { background: dark ? '#4ade80' : '#059669' },
    legendDotLiber: { background: dark ? '#9ca3af' : '#6b7280' },
    legendDotUnmarked: {
      background: dark ? '#333' : '#d1d5db',
      border: `1px dashed ${dark ? '#444' : '#9ca3af'}`,
    },
    legendText: {
      fontSize: 10,
      color: subtle,
      marginRight: 8,
    },

    // Special events
    emptyState: {
      padding: '14px',
      textAlign: 'center' as const,
      fontSize: 12,
      color: subtle,
      fontStyle: 'italic',
      background: bg,
    },
    specialRow: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 6,
      padding: '8px 12px',
      borderBottom: `1px solid ${innerBorder}`,
      background: bg,
    },
    specialRowAlt: {
      background: dark ? '#191927' : '#fafafa',
    },
    specialRowA: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      width: '100%',
    },
    specialRowC: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      flexWrap: 'wrap' as const,
    },
    selectType: {
      padding: '5px 6px',
      border: `1px solid ${inputBorder}`,
      borderRadius: 4,
      fontSize: 12,
      background: inputBg,
      color: inputColor,
      cursor: 'pointer',
      flexShrink: 0,
    },
    inputBase: {
      padding: '5px 8px',
      border: `1px solid ${inputBorder}`,
      borderRadius: 4,
      fontSize: 12,
      background: inputBg,
      color: inputColor,
      outline: 'none',
      boxSizing: 'border-box' as const,
      height: 28,
      minWidth: 0,
    },
    inputError: {
      border: '1px solid #ef4444',
      background: dark ? '#2a1010' : '#fff5f5',
    },
    dateGroup: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 2,
      flexShrink: 0,
    },
    dateLabel: {
      fontSize: 9,
      color: subtle,
      letterSpacing: '0.04em',
      textTransform: 'uppercase' as const,
    },
    inputDate: {
      padding: '3px 6px',
      border: `1px solid ${inputBorder}`,
      borderRadius: 4,
      fontSize: 12,
      background: inputBg,
      color: inputColor,
      outline: 'none',
      boxSizing: 'border-box' as const,
      height: 28,
      width: '100%',
      minWidth: 100,
    },
    // Season config panel
    seasonConfigRow: {
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap' as const,
      gap: 8,
      padding: '10px 12px',
      background: dark ? '#191926' : '#f5f5fb',
    },
    seasonConfigLabel: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.05em',
      textTransform: 'uppercase' as const,
      color: dark ? '#7777aa' : '#5555aa',
      flexShrink: 0,
    },
    seasonSelect: {
      padding: '4px 6px',
      border: `1px solid ${inputBorder}`,
      borderRadius: 4,
      fontSize: 12,
      background: inputBg,
      color: inputColor,
      cursor: 'pointer',
      flexShrink: 0,
      height: 28,
    },
    seasonMonthCount: {
      fontSize: 11,
      color: subtle,
      marginLeft: 8,
      fontStyle: 'italic',
    },

    addBtn: {
      padding: '3px 8px',
      border: `1px dashed ${dark ? '#555' : '#bbb'}`,
      borderRadius: 4,
      background: 'transparent',
      color: dark ? '#888' : '#666',
      cursor: 'pointer',
      fontSize: 11,
    },
    deleteBtn: {
      width: 24,
      height: 24,
      padding: 0,
      border: '1px solid #fca5a5',
      borderRadius: 4,
      background: 'transparent',
      color: '#ef4444',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
  };
}
