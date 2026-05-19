import * as React from 'react';
import { useTheme } from 'styled-components';
import { useField, useFetchClient } from '@strapi/admin/strapi-admin';
import {
  Accordion,
  Box,
  Field,
  Flex,
  LinkButton,
  SingleSelect,
  SingleSelectOption,
  TextInput,
  Typography,
} from '@strapi/design-system';
import { SafeDatePicker as DatePicker } from './components/SafeDatePicker';
import { ArrowRight, Gift, Plus, Star, Sun, Cloud } from '@strapi/icons';
import type { StrapiTheme } from '@strapi/design-system';
import { EditorCard } from './components/EditorCard';
import { EditorField } from './components/EditorField';
import { DeleteIconButton } from './components/DeleteIconButton';
import { MarkdownEditor } from './components/MarkdownEditor';
import { AddListButton } from './components/AddListButton';
import { Section } from './components/Section';
import { MONTH_LABELS, formatRomanianDate, parseISODate } from './utils/seasonFormat';
import { useMatchMedia } from './utils/useMatchMedia';

// yyyy-mm-dd ↔ Date helpers. The timezone-safety dance is handled centrally by
// SafeDatePicker (see ./components/SafeDatePicker.tsx); these just split/join.
const dateFromYMD = (s: string): Date | undefined => {
  if (!s) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
};
const dateToYMD = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WeekendDatum {
  satDate: string;
  sunDate: string;
  state: WeekendState;
}

type CalendarEventType =
  | 'curs'
  | 'liber'
  | 'anulat'
  | 'holiday'
  | 'vacation'
  | 'eveniment'
  | 'concurs'
  | 'curs-special'
  | 'meta-default';
type WeekendState = 'unmarked' | 'curs' | 'liber' | 'anulat';
type DefaultKind = 'curs' | 'liber' | 'anulat';
const isWeekendType = (t: CalendarEventType): boolean =>
  t === 'curs' || t === 'liber' || t === 'anulat';
const stateToDefaultKind = (s: WeekendState): DefaultKind | null =>
  s === 'curs' ? 'curs' : s === 'liber' ? 'liber' : s === 'anulat' ? 'anulat' : null;

interface CalendarEvent {
  type: CalendarEventType;
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD" inclusive
  title?: string | null;
  description?: string | null;
  courseLabel?: string;
  timeSlot?: string;
}

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Calendar helpers (pure)
// ---------------------------------------------------------------------------

const SPECIAL_TYPE_OPTIONS: {
  value: CalendarEventType;
  label: string;
  Icon: React.ComponentType;
}[] = [
  { value: 'holiday', label: 'Sărbătoare', Icon: Sun },
  { value: 'vacation', label: 'Vacanță', Icon: Cloud },
  { value: 'eveniment', label: 'Eveniment', Icon: Gift },
  { value: 'concurs', label: 'Concurs', Icon: Star },
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function buildSeasonMonths(
  startYear: number, startMonth: number,
  endYear: number, endMonth: number,
): Array<{ year: number; month: number; label: string }> {
  const result: Array<{ year: number; month: number; label: string }> = [];
  let y = startYear;
  let m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    result.push({ year: y, month: m, label: `${MONTH_LABELS[m]} ${y}` });
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return result;
}

function computeMonthWeekendData(year: number, month: number, events: CalendarEvent[]): WeekendDatum[] {
  return getWeekendPairs(year, month).map((pair) => {
    const ev = getWeekendEvent(pair.satDate, events);
    return {
      satDate: pair.satDate,
      sunDate: pair.sunDate,
      state: (ev?.type as WeekendState) ?? 'unmarked',
    };
  });
}

function weekendDataEqual(a: WeekendDatum[], b: WeekendDatum[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (item, i) => item.satDate === b[i].satDate && item.state === b[i].state,
  );
}

function detectRangeFromEvents(events: CalendarEvent[]): {
  startYear: number; startMonth: number; endYear: number; endMonth: number;
} | null {
  const weekendEvents = events.filter((e) => isWeekendType(e.type));
  if (weekendEvents.length === 0) return null;
  const dates = weekendEvents.flatMap((e) => [
    new Date(e.startDate + 'T00:00:00'),
    new Date(e.endDate + 'T00:00:00'),
  ]);
  const minDate = dates.reduce((a, b) => (a < b ? a : b));
  const maxDate = dates.reduce((a, b) => (a > b ? a : b));
  return {
    startYear: minDate.getFullYear(),
    startMonth: minDate.getMonth(),
    endYear: maxDate.getFullYear(),
    endMonth: maxDate.getMonth(),
  };
}

interface WeekendPair {
  satDate: string;
  sunDate: string;
  label: string;
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

function getWeekendEvent(satDate: string, events: CalendarEvent[]): CalendarEvent | undefined {
  return events.find((e) => isWeekendType(e.type) && e.startDate === satDate);
}

// Migrates legacy records to the current shape:
//   • `{type:'curs', cancelled:true}` → `{type:'anulat'}` (drop the boolean)
//   • Drop any lingering `cancelled` field
//   • Drop any per-row `useDefaultDescription` flag (every weekend is now implicit)
// Idempotent.
function migrateLegacyCancelled(events: CalendarEvent[]): CalendarEvent[] {
  let changed = false;
  const next = events.map((e) => {
    const legacy = e as CalendarEvent & {
      cancelled?: boolean;
      useDefaultDescription?: boolean;
    };
    let mutated: CalendarEvent | null = null;
    if (legacy.cancelled) {
      const { cancelled: _c, useDefaultDescription: _u, ...rest } = legacy;
      mutated = { ...rest, type: 'anulat' };
    } else if ('cancelled' in legacy || 'useDefaultDescription' in legacy) {
      const { cancelled: _c, useDefaultDescription: _u, ...rest } = legacy;
      mutated = rest;
    }
    if (mutated) {
      changed = true;
      return mutated;
    }
    return e;
  });
  return changed ? next : events;
}

function defaultForState(
  state: WeekendState,
  defaults: Record<DefaultKind, string>,
): string {
  const kind = stateToDefaultKind(state);
  return kind ? defaults[kind] : '';
}

function applyWeekendStateChange(
  satDate: string,
  sunDate: string,
  next: WeekendState,
  events: CalendarEvent[],
  defaults: Record<DefaultKind, string>,
): CalendarEvent[] {
  const filtered = events.filter((e) => !(isWeekendType(e.type) && e.startDate === satDate));
  if (next === 'unmarked') return filtered;
  const description = defaultForState(next, defaults);
  return [
    ...filtered,
    {
      type: next,
      startDate: satDate,
      endDate: sunDate,
      description: description || undefined,
    },
  ];
}

// Pushes a section default onto every weekend event of that kind.
function propagateDefault(
  kind: DefaultKind,
  newValue: string,
  events: CalendarEvent[],
): CalendarEvent[] {
  return events.map((e) =>
    e.type === kind ? { ...e, description: newValue || undefined } : e,
  );
}

const DEFAULTS_META_DATE = '__defaults__';

function readStoredDefaults(events: CalendarEvent[]): Partial<Record<DefaultKind, string>> {
  const out: Partial<Record<DefaultKind, string>> = {};
  for (const e of events) {
    if (e.type !== 'meta-default') continue;
    const k = e.title;
    if (k === 'curs' || k === 'liber' || k === 'anulat') {
      out[k] = e.description ?? '';
    }
  }
  return out;
}

function writeStoredDefault(
  kind: DefaultKind,
  value: string,
  events: CalendarEvent[],
): CalendarEvent[] {
  const filtered = events.filter(
    (e) => !(e.type === 'meta-default' && e.title === kind),
  );
  return [
    ...filtered,
    {
      type: 'meta-default',
      startDate: DEFAULTS_META_DATE,
      endDate: DEFAULTS_META_DATE,
      title: kind,
      description: value,
    },
  ];
}

const isSpecial = (e: CalendarEvent) =>
  e.type === 'holiday' || e.type === 'vacation' || e.type === 'eveniment' || e.type === 'concurs';

const isSpecialCourse = (e: CalendarEvent) => e.type === 'curs-special';

// ---------------------------------------------------------------------------
// WeekendRow - one weekend rendered either as a wide table row or a narrow card.
// Replaces the old click-to-cycle WeekendChip; state is now an explicit dropdown
// and `cancelled` is one of the four values rather than a separate flag.
// ---------------------------------------------------------------------------

const STATE_OPTIONS: { value: WeekendState; label: string }[] = [
  { value: 'curs', label: 'Curs programat' },
  { value: 'liber', label: 'Liber' },
  { value: 'anulat', label: 'Curs anulat' },
  { value: 'unmarked', label: 'Nesetat' },
];

// One thick diagonal accent stripe at the leading edge of the row, layered
// on top of the alt-month band so consecutive months still read as separate
// blocks even on state-tinted rows.
function getStateBg(state: WeekendState, theme: StrapiTheme, altMonth?: boolean): string {
  const monthBg = altMonth ? theme.colors.neutral100 : 'transparent';
  const stripe = (color: string) =>
    `linear-gradient(135deg, transparent 18px, ${color} 18px, ${color} 30px, transparent 30px) left center / 90px 100% no-repeat, ${monthBg}`;
  if (state === 'curs') return stripe('rgba(40, 158, 89, 0.7)'); // green
  if (state === 'liber') return stripe('rgba(102, 102, 135, 0.6)'); // gray
  if (state === 'anulat') return stripe('rgba(208, 43, 32, 0.75)'); // red
  return monthBg;
}

// Tiny colored swatch used as the leading cue inside dropdown options.
function StateDot({ state }: { state: WeekendState }) {
  const theme = useTheme() as StrapiTheme;
  const styles: React.CSSProperties = (() => {
    if (state === 'curs') return { background: theme.colors.success500 };
    if (state === 'liber') return { background: theme.colors.neutral500 };
    if (state === 'anulat') return { background: theme.colors.danger500 };
    return { background: theme.colors.neutral200, border: `1px dashed ${theme.colors.neutral400}` };
  })();
  return (
    <span
      aria-hidden="true"
      style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, flexShrink: 0, ...styles }}
    />
  );
}

interface WeekendRowProps {
  pair: WeekendPair;
  state: WeekendState;
  narrow: boolean;
  altMonth?: boolean;
  onStateChange: (next: WeekendState) => void;
}

function StateSelect({ state, onStateChange }: { state: WeekendState; onStateChange: (v: WeekendState) => void }) {
  return (
    <SingleSelect
      aria-label="Stare weekend"
      value={state}
      onChange={(val) => onStateChange(val as WeekendState)}
    >
      {STATE_OPTIONS.map((opt) => (
        <SingleSelectOption key={opt.value} value={opt.value} startIcon={<StateDot state={opt.value} />}>
          {opt.label}
        </SingleSelectOption>
      ))}
    </SingleSelect>
  );
}

const WeekendRow = React.memo(function WeekendRow({
  pair,
  state,
  narrow,
  altMonth,
  onStateChange,
}: WeekendRowProps) {
  const theme = useTheme() as StrapiTheme;
  const isCancelled = state === 'anulat';
  const dateColor = isCancelled ? theme.colors.neutral500 : theme.colors.neutral800;
  const rowBg = getStateBg(state, theme, altMonth);

  if (narrow) {
    return (
      <Flex
        direction="column"
        alignItems="stretch"
        gap={2}
        paddingTop={2}
        paddingBottom={3}
        paddingLeft={2}
        paddingRight={2}
        style={{
          borderBottom: `1px solid ${theme.colors.neutral150}`,
          background: rowBg,
        }}
      >
        <Typography
          variant="omega"
          fontWeight="semiBold"
          textColor={isCancelled ? 'neutral500' : 'neutral800'}
          style={{ textDecoration: isCancelled ? 'line-through' : 'none', whiteSpace: 'nowrap' }}
        >
          {pair.label}
        </Typography>
        <StateSelect state={state} onStateChange={onStateChange} />
      </Flex>
    );
  }

  // wide - table row
  return (
    <tr
      style={{
        borderTop: `1px solid ${theme.colors.neutral150}`,
        background: rowBg,
      }}
    >
      <td style={{ padding: '14px 16px', verticalAlign: 'middle', width: '50%', whiteSpace: 'nowrap' }}>
        <Typography
          variant="omega"
          fontWeight="semiBold"
          style={{ color: dateColor, textDecoration: isCancelled ? 'line-through' : 'none' }}
        >
          {pair.label}
        </Typography>
      </td>
      <td style={{ padding: '14px 16px', verticalAlign: 'middle', width: '50%' }}>
        <StateSelect state={state} onStateChange={onStateChange} />
      </td>
    </tr>
  );
});

const MONTH_ABBR_RO = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'];

// "11 - 12 Oct" / "30 Nov - 1 Dec" if the pair straddles a month boundary.
function formatWeekendLabel(satISO: string, sunISO: string): string {
  const satMonthIdx = parseInt(satISO.slice(5, 7), 10) - 1;
  const sunMonthIdx = parseInt(sunISO.slice(5, 7), 10) - 1;
  const sat = parseInt(satISO.slice(8, 10), 10);
  const sun = parseInt(sunISO.slice(8, 10), 10);
  const satMonth = MONTH_ABBR_RO[satMonthIdx] ?? '';
  const sunMonth = MONTH_ABBR_RO[sunMonthIdx] ?? '';
  if (satMonthIdx === sunMonthIdx) return `${sat} - ${sun} ${sunMonth}`;
  return `${sat} ${satMonth} - ${sun} ${sunMonth}`;
}

// ---------------------------------------------------------------------------
// WeekendList - wide: one continuous table; narrow: cards grouped by month
// with an uppercase month separator between groups.
// ---------------------------------------------------------------------------

interface WeekendListProps {
  seasonMonths: Array<{ year: number; month: number; label: string }>;
  weekendDataByMonth: Record<string, WeekendDatum[]>;
  narrow: boolean;
  onStateChange: (satDate: string, sunDate: string, next: WeekendState) => void;
}

const WeekendList = React.memo(function WeekendList({
  seasonMonths,
  weekendDataByMonth,
  narrow,
  onStateChange,
}: WeekendListProps) {
  const theme = useTheme() as StrapiTheme;

  const renderRow = (wd: WeekendDatum, altMonth = false) => (
    <WeekendRow
      key={wd.satDate}
      pair={{ satDate: wd.satDate, sunDate: wd.sunDate, label: formatWeekendLabel(wd.satDate, wd.sunDate) }}
      state={wd.state}
      narrow={narrow}
      altMonth={altMonth}
      onStateChange={(next) => onStateChange(wd.satDate, wd.sunDate, next)}
    />
  );

  if (narrow) {
    return (
      <Flex direction="column" gap={5} alignItems="stretch" paddingTop={2}>
        {seasonMonths.map((m) => {
          const data = weekendDataByMonth[`${m.year}-${m.month}`] ?? [];
          if (data.length === 0) return null;
          return (
            <Box key={`${m.year}-${m.month}`}>
              <Flex alignItems="center" gap={3} paddingBottom={3}>
                <Typography variant="pi" fontWeight="bold" textColor="neutral600" style={{ letterSpacing: '0.08em' }}>
                  {m.label.toUpperCase()}
                </Typography>
                <Box flex="1" style={{ height: 1, background: theme.colors.neutral200 }} />
              </Flex>
              <Flex direction="column" gap={3} alignItems="stretch">
                {data.map((wd) => renderRow(wd))}
              </Flex>
            </Box>
          );
        })}
      </Flex>
    );
  }

  // wide - single continuous table; rows of adjacent months get a subtle
  // alternating background so the boundary between months is readable without
  // a heavy separator.
  const monthsWithData = seasonMonths.filter(
    (m) => (weekendDataByMonth[`${m.year}-${m.month}`] ?? []).length > 0,
  );
  return (
    <Box
      style={{
        overflowX: 'auto',
        border: `1px solid ${theme.colors.neutral200}`,
        borderRadius: 4,
        background: theme.colors.neutral0,
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: theme.colors.neutral100, borderBottom: `1px solid ${theme.colors.neutral200}` }}>
            <th style={{ padding: '12px 16px', textAlign: 'left', width: '50%', whiteSpace: 'nowrap' }}>
              <Typography variant="sigma" textColor="neutral600">Weekend</Typography>
            </th>
            <th style={{ padding: '12px 16px', textAlign: 'left', width: '50%' }}>
              <Typography variant="sigma" textColor="neutral600">Stare</Typography>
            </th>
          </tr>
        </thead>
        <tbody>
          {monthsWithData.flatMap((m, mi) =>
            (weekendDataByMonth[`${m.year}-${m.month}`] ?? []).map((wd) => renderRow(wd, mi % 2 === 1)),
          )}
        </tbody>
      </table>
    </Box>
  );
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// SpecialCourseRow / SpecialEventRow - memoised so unchanged rows skip
// re-rendering when an unrelated row or weekend chip changes. This is critical
// because each row contains a Strapi DatePicker (Radix-based) which is very
// expensive to re-render.
// ---------------------------------------------------------------------------

interface SpecialCourseRowProps {
  index: number;
  event: CalendarEvent;
  namePrefix: string;
  onPatch: (index: number, patch: Partial<CalendarEvent>) => void;
  onRemove: (index: number) => void;
}

const SpecialCourseRow = React.memo(function SpecialCourseRow({
  index,
  event,
  namePrefix,
  onPatch,
  onRemove,
}: SpecialCourseRowProps) {
  const i = index;
  const titleText = event.courseLabel?.trim() || 'Curs special';
  return (
    <Accordion.Item value={`special-course-${i}`}>
      <Accordion.Header>
        <Accordion.Trigger caretPosition="left">
          #{i + 1} {titleText}
        </Accordion.Trigger>
        <Accordion.Actions>
          <DeleteIconButton
            onClick={() => onRemove(i)}
            label={`Șterge cursul special ${i + 1}`}
            variant="subtle"
          />
        </Accordion.Actions>
      </Accordion.Header>
      <Accordion.Content>
        <Box padding={4}>
          <Flex direction="column" gap={3} alignItems="stretch">
        <Flex gap={3} alignItems="flex-start" wrap="wrap">
          <Box style={{ flex: '1 1 180px', minWidth: 0 }}>
            <Field.Root
              id={`${namePrefix}-special-course-${i}-date`}
              name="startDate"
              required
              error={!event.startDate ? 'Obligatoriu' : undefined}
            >
              <Field.Label>Data</Field.Label>
              <DatePicker
                value={dateFromYMD(event.startDate)}
                onChange={(d) => onPatch(i, { startDate: d ? dateToYMD(d) : '' })}
                onClear={() => onPatch(i, { startDate: '' })}
                clearLabel="Șterge"
                placeholder="zz/ll/aaaa"
              />
              <Field.Error />
            </Field.Root>
          </Box>
          <Box style={{ flex: '1 1 180px', minWidth: 0 }}>
            <Field.Root
              id={`${namePrefix}-special-course-${i}-time`}
              name="timeSlot"
              hint="Opțional"
            >
              <Field.Label>Interval</Field.Label>
              <TextInput
                id={`${namePrefix}-special-course-${i}-time`}
                value={event.timeSlot ?? ''}
                placeholder="ex: 10:00–11:30"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onPatch(i, { timeSlot: e.target.value || undefined })
                }
              />
              <Field.Hint />
            </Field.Root>
          </Box>
        </Flex>

        <Field.Root
          id={`${namePrefix}-special-course-${i}-title`}
          name="courseLabel"
          required
          error={!event.courseLabel ? 'Obligatoriu' : undefined}
        >
          <Field.Label>Titlu</Field.Label>
          <TextInput
            id={`${namePrefix}-special-course-${i}-title`}
            value={event.courseLabel ?? ''}
            placeholder="ex: Avansați"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onPatch(i, { courseLabel: e.target.value })
            }
          />
          <Field.Error />
        </Field.Root>

        <Field.Root
          id={`${namePrefix}-special-course-${i}-description`}
          name="description"
          hint="Afișată în card-ul de hover. Suportă markdown."
        >
          <Field.Label>Descriere</Field.Label>
          <MarkdownEditor
            id={`${namePrefix}-special-course-${i}-description`}
            value={event.description ?? ''}
            placeholder="Descriere afișată în card-ul de hover…"
            onChange={(val) => onPatch(i, { description: val || undefined })}
            ariaLabel={`Descriere curs special ${i + 1}`}
            features={{ image: 1 }}
          />
          <Field.Hint />
        </Field.Root>
          </Flex>
        </Box>
      </Accordion.Content>
    </Accordion.Item>
  );
});

interface SpecialEventRowProps {
  index: number;
  event: CalendarEvent;
  namePrefix: string;
  onPatch: (index: number, patch: Partial<CalendarEvent>) => void;
  onRemove: (index: number) => void;
}

const SpecialEventRow = React.memo(function SpecialEventRow({
  index,
  event,
  namePrefix,
  onPatch,
  onRemove,
}: SpecialEventRowProps) {
  const i = index;
  const titleText = event.title?.trim() || 'Zi specială';
  return (
    <Accordion.Item value={`special-event-${i}`}>
      <Accordion.Header>
        <Accordion.Trigger caretPosition="left">
          #{i + 1} {titleText}
        </Accordion.Trigger>
        <Accordion.Actions>
          <DeleteIconButton
            onClick={() => onRemove(i)}
            label={`Șterge zilele speciale ${i + 1}`}
            variant="subtle"
          />
        </Accordion.Actions>
      </Accordion.Header>
      <Accordion.Content>
        <Box padding={4}>
          <Flex direction="column" gap={3} alignItems="stretch">
        <Flex gap={3} alignItems="flex-start" wrap="wrap">
          <Box style={{ flex: '1 1 200px', minWidth: 0 }}>
            <Field.Root id={`${namePrefix}-special-${i}-type`} name="type">
              <Field.Label>Tip</Field.Label>
              <SingleSelect
                id={`${namePrefix}-special-${i}-type`}
                value={event.type}
                onChange={(val) => onPatch(i, { type: val as CalendarEventType })}
              >
                {SPECIAL_TYPE_OPTIONS.map((opt) => (
                  <SingleSelectOption key={opt.value} value={opt.value} startIcon={<opt.Icon />}>
                    {opt.label}
                  </SingleSelectOption>
                ))}
              </SingleSelect>
            </Field.Root>
          </Box>
          <Box style={{ flex: '2 1 260px', minWidth: 0 }}>
            <Field.Root
              id={`${namePrefix}-special-${i}-title`}
              name="title"
              error={!event.title ? 'Obligatoriu' : undefined}
              required
            >
              <Field.Label>Titlu</Field.Label>
              <TextInput
                id={`${namePrefix}-special-${i}-title`}
                value={event.title ?? ''}
                placeholder="ex: Crăciun, Concurs Regional"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onPatch(i, { title: e.target.value })
                }
              />
              <Field.Error />
            </Field.Root>
          </Box>
        </Flex>

        <Flex gap={3} alignItems="flex-start" wrap="wrap">
          <Box style={{ flex: '1 1 180px', minWidth: 0 }}>
            <Field.Root id={`${namePrefix}-special-${i}-start`} name="startDate">
              <Field.Label>De la</Field.Label>
              <DatePicker
                value={dateFromYMD(event.startDate)}
                maxDate={dateFromYMD(event.endDate)}
                onChange={(d) => {
                  const next = d ? dateToYMD(d) : '';
                  // If the new start lands after the existing end, push end forward
                  // so the range stays valid (and the end picker doesn't render an
                  // out-of-range value).
                  const endInvalid = !!next && !!event.endDate && event.endDate < next;
                  onPatch(i, endInvalid ? { startDate: next, endDate: next } : { startDate: next });
                }}
                onClear={() => onPatch(i, { startDate: '' })}
                clearLabel="Șterge"
                placeholder="zz/ll/aaaa"
              />
            </Field.Root>
          </Box>
          <Box style={{ flex: '1 1 180px', minWidth: 0 }}>
            <Field.Root id={`${namePrefix}-special-${i}-end`} name="endDate">
              <Field.Label>Până la</Field.Label>
              <DatePicker
                value={dateFromYMD(event.endDate)}
                minDate={dateFromYMD(event.startDate)}
                onChange={(d) => onPatch(i, { endDate: d ? dateToYMD(d) : '' })}
                onClear={() => onPatch(i, { endDate: '' })}
                clearLabel="Șterge"
                placeholder="zz/ll/aaaa"
              />
            </Field.Root>
          </Box>
        </Flex>

        <Field.Root
          id={`${namePrefix}-special-${i}-description`}
          name="description"
          hint="Afișată în card-ul de hover. Suportă markdown."
        >
          <Field.Label>Descriere</Field.Label>
          <MarkdownEditor
            id={`${namePrefix}-special-${i}-description`}
            value={event.description ?? ''}
            placeholder="Descriere afișată în card-ul de hover…"
            onChange={(val) => onPatch(i, { description: val || undefined })}
            ariaLabel={`Descriere zi specială ${i + 1}`}
            features={{ image: 1 }}
          />
          <Field.Hint />
        </Field.Root>
          </Flex>
        </Box>
      </Accordion.Content>
    </Accordion.Item>
  );
});

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export default function CalendarEventsEditor({ name }: Props) {
  const field = useField(name);
  const { get } = useFetchClient();
  const isNarrow = useMatchMedia('(max-width: 640px)');

  const [events, setEvents] = React.useState<CalendarEvent[]>(() => {
    const raw = Array.isArray(field.value) ? (field.value as CalendarEvent[]) : [];
    return migrateLegacyCancelled(raw);
  });

  const [siteSettingsSeason, setSiteSettingsSeason] = React.useState<{
    startDate?: string;
    endDate?: string;
    label?: string;
  }>({});

  const [seasonRange, setSeasonRange] = React.useState<{
    startYear: number;
    startMonth: number;
    endYear: number;
    endMonth: number;
  }>(() => {
    const initial = Array.isArray(field.value) ? (field.value as CalendarEvent[]) : [];
    const detected = detectRangeFromEvents(initial);
    if (detected) return detected;
    const now = new Date();
    const y = now.getFullYear();
    return { startYear: y, startMonth: 9, endYear: y + 1, endMonth: 4 };
  });

  // Fetch the canonical season config from site-settings ONCE on mount.
  // `useFetchClient` returns a new `get` reference on every render, so the previous
  // `[get]` dep ran this fetch on every interaction (~1s server round-trip per click).
  // Stash `get` in a ref and use an empty dep array so the fetch fires only on mount.
  const getRef = React.useRef(get);
  React.useEffect(() => {
    getRef.current = get;
  });

  React.useEffect(() => {
    let cancelled = false;
    getRef.current('/content-manager/single-types/api::site-settings.site-settings')
      .then((res: unknown) => {
        if (cancelled) return;
        const data = (res as { data?: { data?: { registration?: unknown } } }).data?.data;
        const reg = (data?.registration ?? null) as
          | { seasonStartDate?: string; seasonEndDate?: string; currentSeason?: string }
          | null;
        if (!reg) return;
        const start = parseISODate(reg.seasonStartDate);
        const end = parseISODate(reg.seasonEndDate);
        setSiteSettingsSeason({
          startDate: reg.seasonStartDate || undefined,
          endDate: reg.seasonEndDate || undefined,
          label: reg.currentSeason || undefined,
        });
        if (start && end) {
          setSeasonRange({
            startYear: start.year,
            startMonth: start.month,
            endYear: end.year,
            endMonth: end.month,
          });
        }
      })
      .catch(() => {
        /* fall back to detected/default range - non-fatal */
      });
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const seasonMonths = React.useMemo(
    () =>
      buildSeasonMonths(
        seasonRange.startYear,
        seasonRange.startMonth,
        seasonRange.endYear,
        seasonRange.endMonth,
      ),
    [seasonRange],
  );

  // Stable per-month weekend data: preserves array reference for months whose chip
  // data didn't change, so React.memo on WeekendList skips re-renders.
  const monthWeekendDataRef = React.useRef<Record<string, WeekendDatum[]>>({});
  const stableMonthWeekendData = React.useMemo(() => {
    const next: Record<string, WeekendDatum[]> = {};
    for (const m of seasonMonths) {
      const key = `${m.year}-${m.month}`;
      const fresh = computeMonthWeekendData(m.year, m.month, events);
      const prev = monthWeekendDataRef.current[key];
      next[key] = prev && weekendDataEqual(prev, fresh) ? prev : fresh;
    }
    monthWeekendDataRef.current = next;
    return next;
  }, [events, seasonMonths]);

  // Defaults are persisted in the event array as a sentinel meta-default event,
  // so the value survives reloads. Local state mirrors them for input control.
  const initialStored = React.useMemo(() => {
    const initial = Array.isArray(field.value) ? (field.value as CalendarEvent[]) : [];
    return readStoredDefaults(initial);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [defaultCursDesc, setDefaultCursDesc] = React.useState(
    initialStored.curs ?? '10:00–10:50 · 11:00–11:50',
  );
  const [defaultLiberDesc, setDefaultLiberDesc] = React.useState(initialStored.liber ?? '');
  const [defaultAnulatDesc, setDefaultAnulatDesc] = React.useState(initialStored.anulat ?? '');

  const defaultsByKind = React.useMemo<Record<DefaultKind, string>>(
    () => ({ curs: defaultCursDesc, liber: defaultLiberDesc, anulat: defaultAnulatDesc }),
    [defaultCursDesc, defaultLiberDesc, defaultAnulatDesc],
  );

  // Strapi field value mirroring + debounced upstream propagation.
  // We update local state immediately (fast UI), but only push to Strapi's
  // content-manager form state after a brief idle window (300ms) so a flurry of
  // chip clicks/keystrokes doesn't trigger a full edit-form re-render each time.
  const lastSentRef = React.useRef<unknown>(field.value);
  const fieldChangeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventsRef = React.useRef(events);

  React.useEffect(() => {
    if (!Array.isArray(field.value)) return;
    // Skip self-echoes - the value we just sent comes back as the same reference.
    if (lastSentRef.current === field.value) return;
    setEvents(migrateLegacyCancelled(field.value as CalendarEvent[]));
  }, [field.value]);

  const commit = React.useCallback((next: CalendarEvent[]) => {
    setEvents(next);
    eventsRef.current = next;
    if (fieldChangeTimerRef.current) clearTimeout(fieldChangeTimerRef.current);
    fieldChangeTimerRef.current = setTimeout(() => {
      lastSentRef.current = eventsRef.current;
      field.onChange(name, eventsRef.current);
      fieldChangeTimerRef.current = null;
    }, 300);
  }, [field.onChange, name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Final flush on unmount so a pending debounced write isn't lost if the user
  // navigates away or the form remounts before the timer fires.
  React.useEffect(() => {
    return () => {
      if (fieldChangeTimerRef.current) {
        clearTimeout(fieldChangeTimerRef.current);
        fieldChangeTimerRef.current = null;
        field.onChange(name, eventsRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce the persistence + propagation of default-description changes so a flurry
  // of keystrokes results in one commit ~300ms after the user stops typing.
  const commitDefault = React.useCallback(
    (kind: DefaultKind, value: string) => {
      const stored = writeStoredDefault(kind, value, eventsRef.current);
      const propagated = propagateDefault(kind, value, stored);
      commit(propagated);
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const debounceRefs = React.useRef<Record<DefaultKind, ReturnType<typeof setTimeout> | null>>({
    curs: null,
    liber: null,
    anulat: null,
  });

  const scheduleDefaultCommit = (kind: DefaultKind, value: string) => {
    const refs = debounceRefs.current;
    if (refs[kind]) clearTimeout(refs[kind]!);
    refs[kind] = setTimeout(() => {
      commitDefault(kind, value);
      refs[kind] = null;
    }, 350);
  };

  React.useEffect(() => {
    return () => {
      const refs = debounceRefs.current;
      (Object.keys(refs) as DefaultKind[]).forEach((k) => {
        if (refs[k]) clearTimeout(refs[k]!);
      });
    };
  }, []);

  const handleDefaultCursChange = (value: string) => {
    setDefaultCursDesc(value);
    scheduleDefaultCommit('curs', value);
  };

  const handleDefaultLiberChange = (value: string) => {
    setDefaultLiberDesc(value);
    scheduleDefaultCommit('liber', value);
  };

  const handleDefaultAnulatChange = (value: string) => {
    setDefaultAnulatDesc(value);
    scheduleDefaultCommit('anulat', value);
  };

  const handleStateChange = React.useCallback(
    (satDate: string, sunDate: string, next: WeekendState) =>
      commit(applyWeekendStateChange(satDate, sunDate, next, eventsRef.current, defaultsByKind)),
    [defaultsByKind],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const specialEvents = events.filter(isSpecial);
  const specialCourses = events.filter(isSpecialCourse);

  const addSpecialEvent = React.useCallback(() =>
    commit([
      ...eventsRef.current,
      { type: 'holiday', startDate: '', endDate: '', title: '', description: '' },
    ]),
  [commit]);

  // Map a "specialIdx" into the corresponding index of `events`.
  const updateSpecialEvent = React.useCallback((specialIdx: number, patch: Partial<CalendarEvent>) => {
    let sIdx = -1;
    commit(
      eventsRef.current.map((e) => {
        if (isSpecial(e)) {
          sIdx++;
          if (sIdx === specialIdx) return { ...e, ...patch };
        }
        return e;
      }),
    );
  }, [commit]);

  const removeSpecialEvent = React.useCallback((specialIdx: number) => {
    let sIdx = -1;
    commit(
      eventsRef.current.filter((e) => {
        if (isSpecial(e)) {
          sIdx++;
          return sIdx !== specialIdx;
        }
        return true;
      }),
    );
  }, [commit]);

  const addSpecialCourse = React.useCallback(() =>
    commit([
      ...eventsRef.current,
      {
        type: 'curs-special',
        startDate: '',
        endDate: '',
        courseLabel: '',
        timeSlot: '',
        description: '',
      },
    ]),
  [commit]);

  const updateSpecialCourse = React.useCallback((courseIdx: number, patch: Partial<CalendarEvent>) => {
    let cIdx = -1;
    commit(
      eventsRef.current.map((e) => {
        if (isSpecialCourse(e)) {
          cIdx++;
          if (cIdx === courseIdx) {
            const next = { ...e, ...patch };
            if ('startDate' in patch) next.endDate = patch.startDate ?? '';
            return next;
          }
        }
        return e;
      }),
    );
  }, [commit]);

  const removeSpecialCourse = React.useCallback((courseIdx: number) => {
    let cIdx = -1;
    commit(
      eventsRef.current.filter((e) => {
        if (isSpecialCourse(e)) {
          cIdx++;
          return cIdx !== courseIdx;
        }
        return true;
      }),
    );
  }, [commit]);

  return (
    <Box width="100%">
      <EditorCard
        title="Calendar sezonal"
        description="Setează starea fiecărui weekend. Descrierea afișată în card-ul de hover este preluată automat din șablonul stării (Curs / Liber / Curs anulat) editat mai jos."
      >
        <Box padding={4}>
          <Flex direction="column" gap={4} alignItems="stretch">
            {/* Panel A - Season config (read-only, sourced from site-settings) */}
            <Section title="Configurare sezon" first>
              <Flex direction="column" gap={3} alignItems="stretch">
                  {siteSettingsSeason.startDate && siteSettingsSeason.endDate ? (
                    <Flex gap={4} wrap="wrap" alignItems="flex-start">
                      <Box style={{ flex: '1 1 180px', minWidth: 0 }}>
                        <Typography variant="sigma" textColor="neutral600">
                          Început sezon
                        </Typography>
                        <Box paddingTop={1}>
                          <Typography variant="omega" fontWeight="semiBold" textColor="neutral800">
                            {formatRomanianDate(siteSettingsSeason.startDate)}
                          </Typography>
                        </Box>
                      </Box>
                      <Box style={{ flex: '1 1 180px', minWidth: 0 }}>
                        <Typography variant="sigma" textColor="neutral600">
                          Sfârșit sezon
                        </Typography>
                        <Box paddingTop={1}>
                          <Typography variant="omega" fontWeight="semiBold" textColor="neutral800">
                            {formatRomanianDate(siteSettingsSeason.endDate)}
                          </Typography>
                        </Box>
                      </Box>
                      {siteSettingsSeason.label && (
                        <Box style={{ flex: '1 1 180px', minWidth: 0 }}>
                          <Typography variant="sigma" textColor="neutral600">
                            Etichetă
                          </Typography>
                          <Box paddingTop={1}>
                            <Typography
                              variant="omega"
                              fontWeight="semiBold"
                              textColor="neutral800"
                            >
                              {siteSettingsSeason.label}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    </Flex>
                  ) : (
                    <Typography variant="omega" textColor="neutral600">
                      Sezonul nu este încă setat. Calendarul folosește un interval implicit derivat din evenimentele existente.
                    </Typography>
                  )}

                  <Box>
                    <LinkButton
                      href="/admin/content-manager/single-types/api::site-settings.site-settings"
                      variant="tertiary"
                      size="S"
                      endIcon={<ArrowRight />}
                    >
                      Editează sezonul
                    </LinkButton>
                  </Box>

                  <Typography variant="pi" textColor="neutral500">
                    {seasonMonths.length} {seasonMonths.length === 1 ? 'lună' : 'luni'} afișate în calendarul de mai jos.
                  </Typography>
                </Flex>
            </Section>

            {/* Panel B - Weekend picker */}
            <Section title="Weekend-uri">
                <Flex direction="column" gap={4} alignItems="stretch">
                  <EditorField
                    name="defaultCursDesc"
                    label="Descriere implicită - Curs"
                    hint="Afișată în card-ul de hover pentru fiecare weekend de Curs. Suportă markdown."
                  >
                    <MarkdownEditor
                      id="defaultCursDesc"
                      value={defaultCursDesc}
                      placeholder="ex: 10:00–10:50 · 11:00–11:50"
                      onChange={handleDefaultCursChange}
                      features={{ image: false }}
                    />
                  </EditorField>
                  <EditorField
                    name="defaultLiberDesc"
                    label="Descriere implicită - Liber"
                    hint="Afișată în card-ul de hover pentru fiecare weekend Liber. Suportă markdown."
                  >
                    <MarkdownEditor
                      id="defaultLiberDesc"
                      value={defaultLiberDesc}
                      placeholder="ex: Weekend liber"
                      onChange={handleDefaultLiberChange}
                      features={{ image: false }}
                    />
                  </EditorField>
                  <EditorField
                    name="defaultAnulatDesc"
                    label="Descriere implicită - Curs anulat"
                    hint="Afișată în card-ul de hover pentru fiecare weekend de Curs anulat. Suportă markdown."
                  >
                    <MarkdownEditor
                      id="defaultAnulatDesc"
                      value={defaultAnulatDesc}
                      placeholder="ex: Vacanță școlară"
                      onChange={handleDefaultAnulatChange}
                      features={{ image: false }}
                    />
                  </EditorField>
                </Flex>

              <Box paddingTop={4}>
                <WeekendList
                  seasonMonths={seasonMonths}
                  weekendDataByMonth={stableMonthWeekendData}
                  narrow={isNarrow}
                  onStateChange={handleStateChange}
                />
              </Box>
            </Section>

            {/* Panel C - Special standalone course days */}
            <Section title="Cursuri speciale">
              {specialCourses.length === 0 ? (
                <Box paddingBottom={3}>
                  <Typography variant="omega" textColor="neutral500" fontStyle="italic">
                    Niciun curs special adăugat
                  </Typography>
                </Box>
              ) : (
                <Accordion.Root type="single" collapsible style={{ border: 'none', borderRadius: 0 }}>
                  {specialCourses.map((ev, i) => (
                    <SpecialCourseRow
                      key={i}
                      index={i}
                      event={ev}
                      namePrefix={name}
                      onPatch={updateSpecialCourse}
                      onRemove={removeSpecialCourse}
                    />
                  ))}
                </Accordion.Root>
              )}
              <Box
                paddingTop={4}
                borderColor={specialCourses.length === 0 ? undefined : 'neutral200'}
                borderStyle={specialCourses.length === 0 ? undefined : 'solid'}
                borderWidth={specialCourses.length === 0 ? undefined : '1px 0 0 0'}
              >
                <AddListButton onClick={addSpecialCourse} label="Adaugă curs special" />
              </Box>
            </Section>

            {/* Panel D - Special events */}
            <Section title="Zile speciale (sărbători, vacanțe, evenimente, concursuri)">
              {specialEvents.length === 0 ? (
                <Box paddingBottom={3}>
                  <Typography variant="omega" textColor="neutral500" fontStyle="italic">
                    Nicio zi specială adăugată
                  </Typography>
                </Box>
              ) : (
                <Accordion.Root type="single" collapsible style={{ border: 'none', borderRadius: 0 }}>
                  {specialEvents.map((ev, i) => (
                    <SpecialEventRow
                      key={i}
                      index={i}
                      event={ev}
                      namePrefix={name}
                      onPatch={updateSpecialEvent}
                      onRemove={removeSpecialEvent}
                    />
                  ))}
                </Accordion.Root>
              )}
              <Box
                paddingTop={4}
                borderColor={specialEvents.length === 0 ? undefined : 'neutral200'}
                borderStyle={specialEvents.length === 0 ? undefined : 'solid'}
                borderWidth={specialEvents.length === 0 ? undefined : '1px 0 0 0'}
              >
                <AddListButton onClick={addSpecialEvent} label="Adaugă zi specială" />
              </Box>
            </Section>
          </Flex>
        </Box>
      </EditorCard>
    </Box>
  );
}
