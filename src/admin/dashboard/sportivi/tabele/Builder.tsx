import * as React from 'react';
import { SegmentedControl, Select, type SelectOption } from '../../../ui';
import { withSubject } from '../../../../club/tables/builder-state';
import type { CatalogAnswer } from '../../../../club/tables/catalog-api';
import { TABLES_COPY } from '../../../../club/tables/copy';
import { addMonths, monthOf, monthTitle } from '../../../../club/presence/dates';
import type { PeriodSpec, Subject, TableDefinition } from '../../../../club/tables/types';
import { ColumnList } from './ColumnList';
import { FilterList } from './FilterList';

type Props = { definition: TableDefinition; catalog: CatalogAnswer; onChange: (d: TableDefinition) => void };

const SUBJECTS: Subject[] = ['sportivi', 'plati', 'abonamente', 'prezenta'];
const NONE = '';

/** Months of a season, first to last (a season is under two years, so the loop is short). */
function monthsOf(startMonth: string, endMonth: string): string[] {
  const out: string[] = [];
  for (let m = monthOf(startMonth); m <= monthOf(endMonth) && out.length < 36; m = addMonths(m, 1)) out.push(m);
  return out;
}

const periodValue = (p: PeriodSpec, today: string): string => (p === null ? NONE : p.kind === 'current' ? monthOf(today) : p.month);

function ScopeFields({ definition, catalog, onChange }: Props) {
  const { scope } = definition;
  const season = catalog.seasons.find((s) => s.id === scope.seasonId) ?? catalog.seasons[0];
  const sections: SelectOption[] = [{ value: NONE, label: TABLES_COPY.all }, ...catalog.sections.map((s) => ({ value: s.id, label: s.name }))];
  const groups: SelectOption[] = [{ value: NONE, label: TABLES_COPY.all }, ...catalog.groups
    .filter((g) => (g.active || g.id === scope.groupId) && (scope.sectionId === null || g.sectionId === scope.sectionId))
    .map((g) => ({ value: g.id, label: g.name }))];
  const months = season ? monthsOf(season.startMonth, season.endMonth) : [];
  const current = periodValue(scope.period, catalog.today);
  if (current !== NONE && !months.includes(current)) months.push(current);
  const periods: SelectOption[] = [{ value: NONE, label: TABLES_COPY.wholeSeason }, ...months.map((m) => ({ value: m, label: monthTitle(m) }))];
  const set = (patch: Partial<TableDefinition['scope']>) => onChange({ ...definition, scope: { ...scope, ...patch } });
  return (
    <div className="tbl-scope">
      <div>
        <span className="tbl-label">{TABLES_COPY.season}</span>
        <Select value={scope.seasonId} aria-label={TABLES_COPY.season} options={catalog.seasons.map((s) => ({ value: s.id, label: s.label }))} onChange={(seasonId) => set({ seasonId, period: null })} />
      </div>
      <div>
        <span className="tbl-label">{TABLES_COPY.period}</span>
        <Select
          value={current} aria-label={TABLES_COPY.period} options={periods}
          onChange={(v) => set({ period: v === NONE ? null : { kind: 'month', month: v } })}
        />
      </div>
      <div>
        <span className="tbl-label">{TABLES_COPY.section}</span>
        <Select value={scope.sectionId ?? NONE} aria-label={TABLES_COPY.section} options={sections} onChange={(v) => set({ sectionId: v === NONE ? null : v, groupId: null })} />
      </div>
      <div>
        <span className="tbl-label">{TABLES_COPY.group}</span>
        <Select value={scope.groupId ?? NONE} aria-label={TABLES_COPY.group} options={groups} onChange={(v) => set({ groupId: v === NONE ? null : v })} />
      </div>
    </div>
  );
}

/** Subject, scope, columns, filters, group-by and sort: every control edits a catalog key, never anything else. */
export function Builder({ definition, catalog, onChange }: Props) {
  const subject = catalog.subjects[definition.subject];
  const names: Record<string, string[]> = { grupa: catalog.groups.map((g) => g.name), sectiune: catalog.sections.map((s) => s.name) };
  const groupBys: SelectOption[] = [{ value: NONE, label: TABLES_COPY.none }, ...subject.groupBy.map((k) => ({ value: k, label: catalog.groupLabels[k] }))];
  const sortCols: SelectOption[] = [{ value: NONE, label: TABLES_COPY.none }, ...definition.columns.flatMap((k) => {
    const c = subject.columns.find((x) => x.key === k);
    return c ? [{ value: c.key, label: c.label }] : [];
  })];
  return (
    <div className="tbl-sheet">
      <div className="tbl-sec tbl-wide">
        <span className="tbl-label" id="tbl-subject">{TABLES_COPY.subject}</span>
        <SegmentedControl
          aria-labelledby="tbl-subject" value={definition.subject} block className="tbl-subject"
          options={SUBJECTS.map((s) => ({ value: s, label: catalog.subjects[s].label }))}
          onChange={(s) => s !== definition.subject && onChange(withSubject(definition, s))}
        />
      </div>
      <div className="tbl-sec tbl-wide">
        <span className="tbl-label">{TABLES_COPY.scope}</span>
        <ScopeFields definition={definition} catalog={catalog} onChange={onChange} />
      </div>
      <div className="tbl-sec">
        <span className="tbl-label">{TABLES_COPY.columns}</span>
        <ColumnList definition={definition} catalog={subject.columns} onChange={onChange} />
      </div>
      <div className="tbl-sec">
        <span className="tbl-label">{TABLES_COPY.filters}</span>
        <FilterList definition={definition} catalog={subject.columns} names={names} onChange={onChange} />
      </div>
      <div className="tbl-sec">
        <span className="tbl-label">{TABLES_COPY.groupBy}</span>
        <Select value={definition.groupBy ?? NONE} aria-label={TABLES_COPY.groupBy} options={groupBys} onChange={(v) => onChange({ ...definition, groupBy: v === NONE ? null : (v as TableDefinition['groupBy']) })} />
      </div>
      <div className="tbl-sec">
        <span className="tbl-label">{TABLES_COPY.sort}</span>
        <div className="tbl-sort">
          <Select
            value={definition.sort?.column ?? NONE} aria-label={TABLES_COPY.sort} options={sortCols}
            onChange={(v) => onChange({ ...definition, sort: v === NONE ? null : { column: v, dir: definition.sort?.dir ?? 'asc' } })}
          />
          {definition.sort && (
            <SegmentedControl
              aria-label={TABLES_COPY.sort} size="sm" value={definition.sort.dir}
              options={[{ value: 'asc', label: '▲' }, { value: 'desc', label: '▼' }]}
              onChange={(dir) => definition.sort && onChange({ ...definition, sort: { column: definition.sort.column, dir } })}
            />
          )}
        </div>
      </div>
    </div>
  );
}
