import * as React from 'react';
import { Button, Chip, FilterPanel, Input, Notice, Select } from '../../ui';
import { IconSearch } from '../../ui/icons';
import {
  LIST_COPY, SORT_OPTIONS, activeChips, athletesText, clearFilters, filterSections, incompleteBanner, incompleteShown, matchingText, seasonOptions,
  seasonValue, showIncomplete, showLabel, sortSection, withSearch, withSeason, withSection, withoutChip,
} from '../../../club/sportivi/list-view';
import { INCOMPLETE_HIDDEN_KEY, incompleteHidden } from '../../../club/sportivi/incomplete-banner';
import type { AthleteList } from './useAthleteList';

/** Search field with the magnifier of filters-v3. */
function SearchBox({ list }: { list: AthleteList }) {
  const { state, setState } = list;
  return (
    <span className="spv-q">
      <IconSearch />
      <Input
        type="search"
        value={state.q}
        onChange={(e) => setState(withSearch(state, e.target.value))}
        placeholder={LIST_COPY.search}
        aria-label={LIST_COPY.search}
      />
    </span>
  );
}

/** Search, season and filters-v3 on one row, sort at its end (spec 5). On phones the sort is one more section of the filter sheet. */
export function ListToolbar({ list, phone }: { list: AthleteList; phone: boolean }) {
  const { state, setState, page } = list;
  const filters = filterSections(state, page);
  const total = page?.pagination.total ?? 0;
  return (
    <div className="spv-toolbar">
      <SearchBox list={list} />
      <Select className="spv-season" aria-label={LIST_COPY.season} value={seasonValue(state, page)} options={seasonOptions(page)} onChange={(v) => setState(withSeason(state, v))} />
      <FilterPanel
        sections={phone ? [...filters, sortSection(state)] : filters}
        onChange={(key, selected) => setState(withSection(state, key, selected))}
        onClearAll={() => setState(clearFilters(state))}
        totalLabel={athletesText(total)}
        showLabel={showLabel(total)}
      />
      {!phone && (
        <label className="spv-sort">
          <span>{LIST_COPY.sort}:</span>
          <Select aria-label={LIST_COPY.sort} value={state.sort} options={SORT_OPTIONS} onChange={(v) => setState(withSection(state, 'sort', [v]))} />
        </label>
      )}
    </div>
  );
}

/** The chosen filter values as removable chips, and on desktop how many athletes match (filters-v3). */
export function ActiveFilters({ list, phone }: { list: AthleteList; phone: boolean }) {
  const { state, setState, page } = list;
  const chips = activeChips(state, page);
  if (chips.length === 0) return null;
  return (
    <div className="spv-chips">
      {chips.map((chip) => (
        <Chip key={`${chip.key}-${chip.value}`} onRemove={() => setState(withoutChip(state, chip))}>
          {chip.label}
        </Chip>
      ))}
      {!phone && page && <span className="spv-chips-n">{matchingText(page.pagination.total)}</span>}
    </div>
  );
}

/** "N sportivi au date incomplete." + "Arată-i" (3b Q21, gaps #10); gone once the list already shows them. */
export function IncompleteBanner({ list }: { list: AthleteList }) {
  const n = list.page?.incomplete ?? 0;
  const [closed, setClosed] = React.useState(() => {
    try {
      return incompleteHidden(window.sessionStorage.getItem(INCOMPLETE_HIDDEN_KEY), Date.now());
    } catch {
      return false;
    }
  });
  if (n === 0 || incompleteShown(list.state) || closed) return null;
  const dismiss = () => {
    setClosed(true);
    try {
      window.sessionStorage.setItem(INCOMPLETE_HIDDEN_KEY, String(Date.now()));
    } catch {
      /* storage unavailable: hidden for this page view only */
    }
  };
  const action = (
    <Button size="sm" variant="secondary" onClick={() => list.setState(showIncomplete(list.state))}>
      {LIST_COPY.showThem}
    </Button>
  );
  return (
    <div className="spv-banner">
      <Notice tone="warning" action={action} onDismiss={dismiss}>
        {incompleteBanner(n)}
      </Notice>
    </div>
  );
}
