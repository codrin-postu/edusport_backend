import * as React from 'react';
import { Button, FilterPanel, Input, Notice, Select } from '../../ui';
import {
  LIST_COPY, SORT_OPTIONS, athletesText, clearFilters, filterSections, incompleteBanner, seasonOptions, seasonValue, showIncomplete, showLabel,
  sortSection, withSearch, withSeason, withSection,
} from '../../../club/sportivi/list-view';
import type { AthleteList } from './useAthleteList';

/** Search, season, filters-v3 and sort (spec 5). On phones the sort is one more section of the filter sheet. */
export function ListToolbar({ list, phone }: { list: AthleteList; phone: boolean }) {
  const { state, setState, page } = list;
  const filters = filterSections(state, page);
  const total = page?.pagination.total ?? 0;
  return (
    <div className="spv-toolbar">
      <Input
        type="search"
        className="spv-q"
        value={state.q}
        onChange={(e) => setState(withSearch(state, e.target.value))}
        placeholder={LIST_COPY.search}
        aria-label={LIST_COPY.search}
      />
      <Select aria-label={LIST_COPY.season} value={seasonValue(state, page)} options={seasonOptions(page)} onChange={(v) => setState(withSeason(state, v))} />
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

/** "N sportivi au date incomplete." + "Arată-i" (3b Q21, gaps #10). */
export function IncompleteBanner({ list }: { list: AthleteList }) {
  const n = list.page?.incomplete ?? 0;
  if (n === 0) return null;
  const action = (
    <Button size="sm" variant="secondary" onClick={() => list.setState(showIncomplete(list.state))}>
      {LIST_COPY.showThem}
    </Button>
  );
  return (
    <div className="spv-banner">
      <Notice tone="warning" action={action}>
        {incompleteBanner(n)}
      </Notice>
    </div>
  );
}
