import * as React from 'react';
import { Button, Notice, SegmentedControl, useIsPhone } from '../../ui';
import type { Occurrence } from '../../../api/calendar-event/services/expand';
import { GROUP_ERRORS, GRUPE_COPY } from '../../../club/groups/copy';
import { groupChip, weekTitle } from '../../../club/grupe/program-view';
import { calendarOpenDate, inSeasonWindow, type SeasonWindow } from '../../../club/grupe/season-window';
import { AgendaList, CompactMonth, MonthGrid, type CalView } from '../../../plugins/component-preview/admin/src/calendar/CalendarView';
import { RO_MONTHS, ymd, type Occurrence as CalOccurrence } from '../../../plugins/component-preview/admin/src/calendar/model';
import { CAL_CSS } from '../../../plugins/component-preview/admin/src/calendar/styles';
import type { GrupeApi } from './api';

type Props = { groupId: string; api: GrupeApi; reloadKey: number; onOpen: (o: Occurrence) => void; season: SeasonWindow | null };
type Ym = { y: number; m: number };

function useMonth(api: GrupeApi, groupId: string, ym: Ym, reloadKey: number, season: SeasonWindow | null): { list: Occurrence[]; failed: boolean } {
  const [list, setList] = React.useState<Occurrence[]>([]);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    let off = false;
    api.occurrences(groupId, ymd(new Date(ym.y, ym.m, 1)), ymd(new Date(ym.y, ym.m + 1, 0)))
      .then((l) => { if (!off) { setList(l.filter((o) => inSeasonWindow(o.date, season))); setFailed(false); } })
      .catch(() => { if (!off) { setList([]); setFailed(true); } });
    return () => { off = true; };
  }, [api, groupId, ym, reloadKey, season]);
  return { list, failed };
}

const byDate = (list: Occurrence[]): Map<string, CalOccurrence[]> => {
  const out = new Map<string, CalOccurrence[]>();
  for (const o of list) out.set(o.date, [...(out.get(o.date) ?? []), o]);
  return out;
};

type BarProps = { ym: Ym; view: CalView; narrow: boolean; go: (delta: number) => void; today: () => void; setView: (v: CalView) => void };

function Bar({ ym, view, narrow, go, today, setView }: BarProps) {
  const views = [{ value: 'list' as const, label: GRUPE_COPY.viewList }, { value: 'month' as const, label: GRUPE_COPY.viewMonth }];
  return (
    <div className="grp-cal-bar">
      <Button variant="secondary" size="sm" aria-label={GRUPE_COPY.prevMonth} onClick={() => go(-1)}>‹</Button>
      <span className="cal-mon" aria-live="polite">{`${RO_MONTHS[ym.m]} ${ym.y}`}</span>
      <Button variant="secondary" size="sm" aria-label={GRUPE_COPY.nextMonth} onClick={() => go(1)}>›</Button>
      <Button variant="secondary" size="sm" onClick={today}>{GRUPE_COPY.today}</Button>
      <span className="cal-sp" />
      <SegmentedControl<CalView> aria-label={GRUPE_COPY.tabProgram} options={views} value={view} onChange={setView} block={narrow} />
    </div>
  );
}

/** The group's dates of one season (6.3): opens on today, or the nearest end of the season; Listă / Lună, any month, "Azi"; chips as `groupChip` writes them; no add buttons (decided 8). */
const openYm = (season: SeasonWindow | null): Ym => {
  const d = calendarOpenDate(ymd(new Date()), season);
  return { y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)) - 1 };
};

export function GroupCalendar({ groupId, api, reloadKey, onOpen, season }: Props) {
  const narrow = useIsPhone();
  const now = new Date();
  const [ym, setYm] = React.useState<Ym>(() => openYm(season));
  const [view, setView] = React.useState<CalView>('list');
  const [selected, setSelected] = React.useState<string | null>(ymd(now));
  const { list, failed } = useMonth(api, groupId, ym, reloadKey, season);
  const grid = { y: ym.y, m: ym.m, byDate: byDate(list), todayKey: ymd(now), onEvent: (o: CalOccurrence) => onOpen(o as Occurrence), view: groupChip };
  const go = (delta: number) => setYm(({ y, m }) => ({ y: new Date(y, m + delta, 1).getFullYear(), m: new Date(y, m + delta, 1).getMonth() }));
  const body = view === 'list' ? <AgendaList {...grid} focusDate={null} weekTitle={weekTitle} />
    : narrow ? <CompactMonth {...grid} selected={selected} onSelect={setSelected} /> : <MonthGrid {...grid} onMore={() => setView('list')} />;
  return (
    <div className="ui-root cal">
      <style>{CAL_CSS}</style>
      <Bar ym={ym} view={view} narrow={narrow} go={go} today={() => setYm(openYm(season))} setView={setView} />
      <div className="cal-frame">{failed ? <Notice tone="danger">{GROUP_ERRORS.loadFailed}</Notice> : body}</div>
    </div>
  );
}
