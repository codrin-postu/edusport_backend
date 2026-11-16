import * as React from 'react';
import { SegmentedControl, Select, useIsPhone } from '../../../ui';
import { setSubject } from '../../../../club/tables/builder-state';
import type { CatalogAnswer } from '../../../../club/tables/catalog-api';
import { TABLES_COPY } from '../../../../club/tables/copy';
import { monthOf } from '../../../../club/presence/dates';
import { PeriodPicker } from './PeriodPicker';
import type { Subject, TableDefinition } from '../../../../club/tables/types';

type Props = { definition: TableDefinition; catalog: CatalogAnswer; onChange: (d: TableDefinition) => void };

const SUBJECTS: Subject[] = ['sportivi', 'plati', 'abonamente', 'prezenta', 'sedinte'];

/** The type picker (only the types the server's catalog offers) and the period button. */
export function TypeBar({ definition, catalog, onChange }: Props) {
  const phone = useIsPhone();
  const firstGroup = catalog.groups.find((g) => g.active)?.id ?? null;
  const pick = (s: Subject) => onChange(setSubject(definition, s, { groupId: firstGroup, month: monthOf(catalog.today) }));
  const subjectOptions = SUBJECTS.filter((s) => catalog.subjects[s] !== undefined).map((s) => ({ value: s, label: TABLES_COPY.subjects[s] }));
  return (
    <div className="tbl-bar-row">
      {phone ? (
        <Select className="tbl-type-select" value={definition.subject} aria-label={TABLES_COPY.pageTitle} options={subjectOptions} onChange={(v) => pick(v as Subject)} />
      ) : (
        <SegmentedControl aria-label={TABLES_COPY.pageTitle} className="tbl-types" value={definition.subject} options={subjectOptions} onChange={pick} />
      )}
      <PeriodPicker definition={definition} catalog={catalog} onChange={onChange} />
    </div>
  );
}
