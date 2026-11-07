import * as React from 'react';
import { Button, Select, type SelectOption } from '../../ui';
import { PERIOD_COPY } from '../../../club/presence/copy/prezenta-ui';
import { periodOf, stepPeriod, type PeriodView } from '../../../club/presence/period';
import { periodLabel } from '../../../club/prezenta/period-view';
import { Switcher } from './Switcher';

type Props = { view: PeriodView; date: string; today: string; onChange: (next: { view?: PeriodView; date?: string }) => void };

const VIEW_OPTIONS: SelectOption[] = (['zi', 'saptamana', 'luna'] as const).map((v) => ({ value: v, label: PERIOD_COPY.views[v] }));

/** View select, "<" label ">" and "Azi". The label opens the browser's date picker; a pick moves the period to that date. */
export function PeriodHeader({ view, date, today, onChange }: Props) {
  const picker = React.useRef<HTMLInputElement>(null);
  const label = periodLabel(view, periodOf(view, date), today);
  const openPicker = () => {
    const input = picker.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') input.showPicker();
    else input.focus();
  };
  return (
    <>
      <Select value={view} options={VIEW_OPTIONS} aria-label={PERIOD_COPY.views[view]} className="pz-view-select" onChange={(v) => onChange({ view: v as PeriodView })} />
      <span className="pz-datewrap">
        <Switcher
          label={label} prevLabel={PERIOD_COPY.prev[view]} nextLabel={PERIOD_COPY.next[view]}
          onPrev={() => onChange({ date: stepPeriod(view, date, -1) })} onNext={() => onChange({ date: stepPeriod(view, date, 1) })}
          middle={label} onMiddle={openPicker} middleOn
        />
        <input
          ref={picker} type="date" className="pz-datehidden" value={date} tabIndex={-1} aria-hidden="true" lang="ro"
          onChange={(e) => { if (e.target.value) onChange({ date: e.target.value }); }}
        />
      </span>
      <Button variant="secondary" disabled={date === today || periodOf(view, date).from === periodOf(view, today).from} onClick={() => onChange({ date: today })}>{PERIOD_COPY.today}</Button>
    </>
  );
}
