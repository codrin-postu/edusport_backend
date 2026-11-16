import * as React from 'react';
import { Button, Select } from '../../../ui';
import { monthOf } from '../../../../club/presence/dates';
import type { CatalogAnswer } from '../../../../club/tables/catalog-api';
import { TABLES_COPY } from '../../../../club/tables/copy';
import { clearMonths, periodLabel, periodMonths, seasonMonths, setSeason, shortMonth, toggleMonth } from '../../../../club/tables/view-model';
import type { TableDefinition } from '../../../../club/tables/types';
import { MenuButton } from '../../SubmissionTable';

type Props = { definition: TableDefinition; catalog: CatalogAnswer; onChange: (d: TableDefinition) => void };

/**
 * The one period button (Select look). Its popover holds the season select and the twelve months of the season (several may be ticked;
 * Prezență pe ședințe takes exactly one, none ahead of today). Sportivi has the season only.
 */
export function PeriodPicker({ definition, catalog, onChange }: Props) {
  const [open, setOpen] = React.useState(false);
  const { subject } = definition;
  const season = catalog.seasons.find((s) => s.id === definition.scope.seasonId) ?? catalog.seasons[0];
  const months = periodMonths(definition, catalog.today);
  const grid = subject !== 'sportivi' && season !== undefined;
  const sedinte = subject === 'sedinte';
  const label = season === undefined ? TABLES_COPY.select : sedinte && months.length === 0 ? TABLES_COPY.select : periodLabel(season.label, months);
  return (
    <span className="tbl-period">
      <MenuButton label={label} open={open} onToggle={() => setOpen((o) => !o)} onClose={() => setOpen(false)} popClassName="tbl-pop tbl-period-pop">
        <Select
          value={season?.id ?? ''} aria-label={TABLES_COPY.season} options={catalog.seasons.map((s) => ({ value: s.id, label: s.label }))}
          onChange={(id) => { const next = catalog.seasons.find((s) => s.id === id); if (next) onChange(setSeason(definition, next, catalog.today)); }}
        />
        {grid && (
          <div className="tbl-months">
            {seasonMonths(season).map((m) => (
              <button
                key={m} type="button" className="tbl-month" aria-pressed={months.includes(m)} disabled={sedinte && m > monthOf(catalog.today)}
                onClick={() => onChange(toggleMonth(definition, m, catalog.today))}
              >
                {shortMonth(m)}
              </button>
            ))}
          </div>
        )}
        {!sedinte && months.length > 0 && <Button variant="ghost" onClick={() => onChange(clearMonths(definition))}>{TABLES_COPY.wholeSeason}</Button>}
      </MenuButton>
    </span>
  );
}
