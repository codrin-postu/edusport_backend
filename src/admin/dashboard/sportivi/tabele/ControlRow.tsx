import * as React from 'react';
import { SegmentedControl, Select, type SelectOption } from '../../../ui';
import { setSubject } from '../../../../club/tables/builder-state';
import type { Aspect } from '../../../../club/tables/aspect';
import type { CatalogAnswer } from '../../../../club/tables/catalog-api';
import { TABLES_COPY } from '../../../../club/tables/copy';
import { addMonths, monthOf, monthTitle } from '../../../../club/presence/dates';
import type { PeriodSpec, Subject, TableDefinition } from '../../../../club/tables/types';
import { ColumnsPopover } from './ColumnsPopover';
import { FilterBar } from './FilterList';

type Props = { definition: TableDefinition; catalog: CatalogAnswer; onChange: (d: TableDefinition) => void; aspect: Aspect; onAspect: (a: Aspect) => void };

const SUBJECTS: Subject[] = ['sportivi', 'plati', 'abonamente', 'prezenta'];
const NONE = '';

/** Months of a season, first to last (a season is under two years, so the loop is short). */
function monthsOf(startMonth: string, endMonth: string): string[] {
  const out: string[] = [];
  for (let m = monthOf(startMonth); m <= monthOf(endMonth) && out.length < 36; m = addMonths(m, 1)) out.push(m);
  return out;
}

const periodValue = (p: PeriodSpec, today: string): string => (p === null ? NONE : p.kind === 'current' ? monthOf(today) : p.month);

/** A select with its name written before it ("Secțiune: Toate"). */
function Named({ name, children }: { name: string; children: React.ReactNode }) {
  return <span className="tbl-named"><span className="tbl-named-label">{name}:</span>{children}</span>;
}

/** The one row above the table: subject, season, period, section, group, filters, group-by, columns and aspect. Every control edits a catalog key. */
export function ControlRow({ definition, catalog, onChange, aspect, onAspect }: Props) {
  const { scope } = definition;
  const subject = catalog.subjects[definition.subject];
  const names: Record<string, string[]> = { grupa: catalog.groups.map((g) => g.name), sectiune: catalog.sections.map((s) => s.name) };
  const season = catalog.seasons.find((s) => s.id === scope.seasonId) ?? catalog.seasons[0];
  const sections: SelectOption[] = [{ value: NONE, label: TABLES_COPY.all }, ...catalog.sections.map((s) => ({ value: s.id, label: s.name }))];
  const groups: SelectOption[] = [{ value: NONE, label: TABLES_COPY.all }, ...catalog.groups
    .filter((g) => (g.active || g.id === scope.groupId) && (scope.sectionId === null || g.sectionId === scope.sectionId))
    .map((g) => ({ value: g.id, label: g.name }))];
  const months = season ? monthsOf(season.startMonth, season.endMonth) : [];
  const current = periodValue(scope.period, catalog.today);
  if (current !== NONE && !months.includes(current)) months.push(current);
  const periods: SelectOption[] = [{ value: NONE, label: TABLES_COPY.wholeSeason }, ...months.map((m) => ({ value: m, label: monthTitle(m) }))];
  const groupBys: SelectOption[] = [{ value: NONE, label: TABLES_COPY.none }, ...subject.groupBy.map((k) => ({ value: k, label: catalog.groupLabels[k] }))];
  const set = (patch: Partial<TableDefinition['scope']>) => onChange({ ...definition, scope: { ...scope, ...patch } });
  return (
    <div className="tbl-controls">
      <Named name={TABLES_COPY.table}>
        <Select
          className="tbl-subject" value={definition.subject} aria-label={TABLES_COPY.table}
          options={SUBJECTS.map((s) => ({ value: s, label: TABLES_COPY.subjects[s] }))}
          onChange={(s) => s !== definition.subject && onChange(setSubject(definition, s as Subject))}
        />
      </Named>
      <Select value={scope.seasonId} aria-label={TABLES_COPY.season} options={catalog.seasons.map((s) => ({ value: s.id, label: s.label }))} onChange={(seasonId) => set({ seasonId, period: null })} />
      <Select value={current} aria-label={TABLES_COPY.period} options={periods} onChange={(v) => set({ period: v === NONE ? null : { kind: 'month', month: v } })} />
      <Named name={TABLES_COPY.section}>
        <Select value={scope.sectionId ?? NONE} aria-label={TABLES_COPY.section} options={sections} onChange={(v) => set({ sectionId: v === NONE ? null : v, groupId: null })} />
      </Named>
      <Named name={TABLES_COPY.group}>
        <Select value={scope.groupId ?? NONE} aria-label={TABLES_COPY.group} options={groups} onChange={(v) => set({ groupId: v === NONE ? null : v })} />
      </Named>
      <FilterBar definition={definition} catalog={subject.columns} names={names} onChange={onChange} />
      <span className="tbl-sep" aria-hidden="true" />
      <Named name={TABLES_COPY.groupLabel}>
        <Select value={definition.groupBy ?? NONE} aria-label={TABLES_COPY.groupLabel} options={groupBys} onChange={(v) => onChange({ ...definition, groupBy: v === NONE ? null : (v as TableDefinition['groupBy']) })} />
      </Named>
      <ColumnsPopover definition={definition} catalog={subject.columns} onChange={onChange} />
      <span className="tbl-named tbl-aspect">
        <span className="tbl-named-label" id="tbl-aspect">{TABLES_COPY.aspect.label}:</span>
        <SegmentedControl
          aria-labelledby="tbl-aspect" size="sm" value={aspect} onChange={onAspect}
          options={[{ value: 'lista', label: TABLES_COPY.aspect.lista }, { value: 'foaie', label: TABLES_COPY.aspect.foaie }]}
        />
      </span>
    </div>
  );
}
