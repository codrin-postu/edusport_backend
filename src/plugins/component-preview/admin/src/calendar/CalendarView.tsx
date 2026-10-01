import * as React from 'react';
import { Button, EmptyState, Popover, SegmentedControl, type CalendarCategory } from '../../../../../admin/ui';
import { IconPlus } from '../../../../../admin/ui/icons';
import {
  FILTER_GROUPS,
  RO_DOW,
  RO_DOW_LETTER,
  RO_MONTHS,
  RO_MON_SHORT,
  fmtRoLong,
  hhmm,
  monthWeeks,
  occView,
  weekLabel,
  ymd,
  type Occurrence,
} from './model';

/**
 * The calendar half of ProgramOverviewEditor: toolbar, category filters, the
 * month grid (full, or compact with colour marks on phones) and the Listă view.
 * Presentational: state and data live in ProgramOverviewEditor.
 */

export type CalView = 'month' | 'list';

const VIEW_OPTIONS: Array<{ value: CalView; label: string }> = [
  { value: 'month', label: 'Lună' },
  { value: 'list', label: 'Listă' },
];

/** Events shown in a desktop day cell before "+N încă". */
const MAX_PER_DAY = 3;

/* ---- toolbar and filters ------------------------------------------------ */

export interface FilterProps {
  hidden: ReadonlySet<CalendarCategory>;
  onToggle: (cat: CalendarCategory) => void;
}

/** The four colour chips. Off = dimmed and struck through. */
export function FilterChips({ hidden, onToggle, stacked = false }: FilterProps & { stacked?: boolean }) {
  return (
    <div className={stacked ? 'cal-filters cal-filters--stack' : 'cal-filters'} role="group" aria-label="Categorii afișate">
      {FILTER_GROUPS.map((g) => {
        const on = !hidden.has(g.cat);
        return (
          <button key={g.cat} type="button" className="cal-filter" aria-pressed={on} data-calcat={g.cat} onClick={() => onToggle(g.cat)}>
            <span className="cal-sw" aria-hidden="true" />
            <span className="cal-filter-l">{g.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export interface ToolbarProps extends FilterProps {
  y: number;
  m: number;
  narrow: boolean;
  view: CalView;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onView: (v: CalView) => void;
  onAdd: () => void;
}

export function CalendarToolbar({ y, m, narrow, view, loading, onPrev, onNext, onToday, onView, onAdd, hidden, onToggle }: ToolbarProps) {
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const filtersRef = React.useRef<HTMLButtonElement>(null);
  const off = hidden.size;
  const viewSwitch = <SegmentedControl<CalView> aria-label="Vizualizare" options={VIEW_OPTIONS} value={view} onChange={onView} block={narrow} className="cal-viewseg" />;
  return (
    <div className="cal-bar">
      <div className="cal-bar-row">
        <div className="cal-nav">
          <Button variant="secondary" size="sm" aria-label="Luna anterioară" onClick={onPrev}>
            ‹
          </Button>
          <span className="cal-mon" aria-live="polite">
            {narrow ? `${RO_MON_SHORT[m].charAt(0).toUpperCase()}${RO_MON_SHORT[m].slice(1)} ${y}` : `${RO_MONTHS[m]} ${y}`}
          </span>
          <Button variant="secondary" size="sm" aria-label="Luna următoare" onClick={onNext}>
            ›
          </Button>
        </div>
        <Button variant="secondary" size="sm" onClick={onToday}>
          Azi
        </Button>
        {loading && <span className="ui-hint">se încarcă…</span>}
        <span className="cal-sp" />
        {!narrow && viewSwitch}
        {narrow ? (
          <Button size="sm" iconOnly icon={<IconPlus />} aria-label="Adaugă eveniment" onClick={onAdd} />
        ) : (
          <Button size="sm" icon={<IconPlus />} onClick={onAdd}>
            Adaugă
          </Button>
        )}
      </div>
      {narrow ? (
        <div className="cal-bar-row cal-bar-row--sub">
          {viewSwitch}
          <Button
            ref={filtersRef}
            variant="secondary"
            size="sm"
            aria-expanded={filtersOpen}
            aria-haspopup="true"
            onClick={() => setFiltersOpen((o) => !o)}
          >
            {off > 0 ? `Filtre (${FILTER_GROUPS.length - off}/${FILTER_GROUPS.length})` : 'Filtre'}
          </Button>
          <Popover open={filtersOpen} anchorRef={filtersRef} onClose={() => setFiltersOpen(false)} placement="bottom-end" className="cal-pop">
            <FilterChips hidden={hidden} onToggle={onToggle} stacked />
          </Popover>
        </div>
      ) : (
        <FilterChips hidden={hidden} onToggle={onToggle} />
      )}
    </div>
  );
}

/* ---- one event --------------------------------------------------------- */

interface EventChipProps {
  o: Occurrence;
  /** Show the end time too (Listă view). */
  range?: boolean;
  /** Clamp to two lines (month grid). */
  clamp?: boolean;
  onOpen: () => void;
}

/** Soft category tint, 3px category edge, dark text; the time in bold first. */
export function EventChip({ o, range = false, clamp = false, onOpen }: EventChipProps) {
  const v = occView(o);
  const end = hhmm(o.endTime);
  const time = range && v.time && end ? `${v.time} - ${end}` : v.time;
  return (
    <button
      type="button"
      className={`cal-ev${v.struck ? ' cal-ev--cancel' : ''}${clamp ? ' cal-ev--clamp' : ''}`}
      data-calcat={v.cat}
      title={v.title}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <span className="cal-ev-t">
        {time && <b>{time}</b>}
        {time ? ' ' : ''}
        {v.text}
      </span>
    </button>
  );
}

/* ---- month grid -------------------------------------------------------- */

export interface GridProps {
  y: number;
  m: number;
  byDate: Map<string, Occurrence[]>;
  todayKey: string;
  onEvent: (o: Occurrence, date: string) => void;
  /** An empty spot of a day: add an event on that date. */
  onAddOn: (date: string) => void;
}

function dayClass(d: Date, m: number, key: string, todayKey: string, extra = ''): string {
  const dow = (d.getDay() + 6) % 7;
  return [
    'cal-day',
    d.getMonth() === m ? '' : 'cal-day--off',
    dow >= 5 ? 'cal-day--we' : '',
    key === todayKey ? 'cal-day--today' : '',
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Full month grid (desktop and tablet). */
export function MonthGrid({ y, m, byDate, todayKey, onEvent, onAddOn, onMore }: GridProps & { onMore: (date: string) => void }) {
  const weeks = React.useMemo(() => monthWeeks(y, m), [y, m]);
  return (
    <div className="cal-month">
      <div className="cal-dows" aria-hidden="true">
        {RO_DOW.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="cal-grid">
        {weeks.flat().map((d) => {
          const key = ymd(d);
          const items = byDate.get(key) ?? [];
          const rest = items.length - MAX_PER_DAY;
          return (
            <div key={key} className={dayClass(d, m, key, todayKey)} onClick={() => onAddOn(key)}>
              <button
                type="button"
                className="cal-num"
                aria-label={`Adaugă eveniment, ${fmtRoLong(key)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onAddOn(key);
                }}
              >
                {d.getDate()}
              </button>
              {items.slice(0, MAX_PER_DAY).map((o, i) => (
                <EventChip key={i} o={o} clamp onOpen={() => onEvent(o, key)} />
              ))}
              {rest > 0 && (
                <button
                  type="button"
                  className="cal-more"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMore(key);
                  }}
                >
                  +{rest} încă
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Phone month: compact days with colour marks; the chosen day lists under the grid. */
export function CompactMonth({
  y,
  m,
  byDate,
  todayKey,
  onEvent,
  onAddOn,
  selected,
  onSelect,
}: GridProps & { selected: string | null; onSelect: (date: string) => void }) {
  const weeks = React.useMemo(() => monthWeeks(y, m), [y, m]);
  const dayItems = selected ? byDate.get(selected) ?? [] : [];
  return (
    <div className="cal-month cal-month--compact">
      <div className="cal-dows" aria-hidden="true">
        {RO_DOW_LETTER.map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>
      <div className="cal-grid">
        {weeks.flat().map((d) => {
          const key = ymd(d);
          const items = byDate.get(key) ?? [];
          const cats = Array.from(new Set(items.map((o) => occView(o).cat))).slice(0, 4);
          return (
            <button
              key={key}
              type="button"
              className={dayClass(d, m, key, todayKey, key === selected ? 'cal-day--sel' : '')}
              aria-pressed={key === selected}
              aria-label={`${fmtRoLong(key)}${items.length ? `, ${items.length === 1 ? 'un eveniment' : `${items.length} evenimente`}` : ''}`}
              onClick={() => onSelect(key)}
            >
              <span className="cal-num">{d.getDate()}</span>
              {cats.length > 0 && (
                <span className="cal-marks" aria-hidden="true">
                  {cats.map((c) => (
                    <i key={c} data-calcat={c} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="cal-dayl">
          <div className="cal-st">{fmtRoLong(selected)}</div>
          {dayItems.length === 0 ? (
            <div className="cal-muted">Nimic programat</div>
          ) : (
            dayItems.map((o, i) => <EventChip key={i} o={o} range onOpen={() => onEvent(o, selected)} />)
          )}
          <Button variant="secondary" size="sm" icon={<IconPlus />} onClick={() => onAddOn(selected)}>
            Adaugă în această zi
          </Button>
        </div>
      )}
    </div>
  );
}

/* ---- Listă ------------------------------------------------------------- */

/**
 * Every event of the month by day, grouped by week. Days without events are
 * left out (a week with none is left out entirely).
 */
export function AgendaList({ y, m, byDate, todayKey, onEvent, onAddOn, focusDate }: GridProps & { focusDate: string | null }) {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const weeks = React.useMemo(
    () =>
      monthWeeks(y, m)
        .map((row) => ({ monday: row[0], days: row.filter((d) => d.getMonth() === m && (byDate.get(ymd(d))?.length ?? 0) > 0) }))
        .filter((w) => w.days.length > 0),
    [y, m, byDate],
  );

  React.useEffect(() => {
    if (!focusDate) return;
    const el = boxRef.current?.querySelector<HTMLElement>(`[data-date="${focusDate}"]`);
    el?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [focusDate, weeks]);

  if (weeks.length === 0) {
    return (
      <div className="cal-list">
        <EmptyState
          action={
            <Button variant="secondary" size="sm" icon={<IconPlus />} onClick={() => onAddOn(ymd(new Date(y, m, 1)))}>
              Adaugă
            </Button>
          }
        >
          Nimic programat în {RO_MONTHS[m].toLowerCase()} {y}.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="cal-list" ref={boxRef}>
      {weeks.map((w) => (
        <section key={ymd(w.monday)} aria-label={weekLabel(w.monday)}>
          <div className="cal-wk">{weekLabel(w.monday)}</div>
          {w.days.map((d) => {
            const key = ymd(d);
            return (
              <div key={key} className={`cal-ag${key === todayKey ? ' cal-ag--today' : ''}`} data-date={key}>
                <button type="button" className="cal-ag-dd" aria-label={`Adaugă eveniment, ${fmtRoLong(key)}`} onClick={() => onAddOn(key)}>
                  <small>{RO_DOW[(d.getDay() + 6) % 7]}</small>
                  <span className="cal-ag-n">{d.getDate()}</span>
                </button>
                <div className="cal-ag-l">
                  {(byDate.get(key) ?? []).map((o, i) => (
                    <EventChip key={i} o={o} range onOpen={() => onEvent(o, key)} />
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
