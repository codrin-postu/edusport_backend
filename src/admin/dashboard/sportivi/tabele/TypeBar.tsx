import * as React from 'react';
import { SegmentedControl, Select, useIsPhone, type SelectOption } from '../../../ui';
import { setSubject } from '../../../../club/tables/builder-state';
import type { CatalogAnswer } from '../../../../club/tables/catalog-api';
import { TABLES_COPY } from '../../../../club/tables/copy';
import { monthOf, monthTitle } from '../../../../club/presence/dates';
import { applyPeriodChoice, periodChoices, periodValue } from '../../../../club/tables/view-model';
import type { Subject, TableDefinition } from '../../../../club/tables/types';

type Props = { definition: TableDefinition; catalog: CatalogAnswer; onChange: (d: TableDefinition) => void };

const SUBJECTS: Subject[] = ['sportivi', 'plati', 'abonamente', 'prezenta', 'sedinte'];

/** The type picker and the one period select (months of a season and the whole season). */
export function TypeBar({ definition, catalog, onChange }: Props) {
  const phone = useIsPhone();
  const sedinte = definition.subject === 'sedinte';
  const options: SelectOption[] = periodChoices(definition.subject, catalog);
  const value = periodValue(definition, catalog.today);
  const known = options.some((o) => o.value === value);
  const month = value.split('|')[1];
  if (!known && month) options.push({ value, label: monthTitle(month) });
  const firstGroup = catalog.groups.find((g) => g.active)?.id ?? null;
  const pick = (s: Subject) => onChange(setSubject(definition, s, { groupId: firstGroup, month: monthOf(catalog.today) }));
  const subjectOptions = SUBJECTS.map((s) => ({ value: s, label: TABLES_COPY.subjects[s] }));
  return (
    <div className="tbl-bar-row">
      {phone ? (
        <Select className="tbl-type-select" value={definition.subject} aria-label={TABLES_COPY.pageTitle} options={subjectOptions} onChange={(v) => pick(v as Subject)} />
      ) : (
        <SegmentedControl aria-label={TABLES_COPY.pageTitle} className="tbl-types" value={definition.subject} options={subjectOptions} onChange={pick} />
      )}
      <Select
        className="tbl-period" value={known || month ? value : ''} aria-label={TABLES_COPY.period} options={options}
        placeholder={sedinte && !month ? TABLES_COPY.select : undefined}
        onChange={(v) => v !== '' && onChange(applyPeriodChoice(definition, v))}
      />
    </div>
  );
}
