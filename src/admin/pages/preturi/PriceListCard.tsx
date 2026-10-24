import * as React from 'react';
import { Button, DataTable, EditorCard, Notice, StatusBadge, type DataColumn } from '../../ui';
import { IconPlus } from '../../ui/icons';
import type { AdminPriceItem, AdminPriceList } from '../../../club/price-admin';
import { KIND_LABELS, hasTooltip, priceText } from './format';

type Row = AdminPriceItem & { index: number };

const missing = <StatusBadge tone="warning">Lipsă</StatusBadge>;

const priceCell = (pick: (r: Row) => number | null) => (r: Row) => (r.incomplete ? missing : priceText(pick(r)));

const COLUMNS: DataColumn<Row>[] = [
  {
    key: 'name',
    header: 'Nume',
    render: (r) => (
      <>
        {r.name}
        {r.tooltip && <span className="ui-hint" style={{ display: 'inline' }}> *</span>}
      </>
    ),
  },
  { key: 'kind', header: 'Tip', render: (r) => KIND_LABELS[r.kind] },
  { key: 'sessions', header: 'Ședințe', render: (r) => (r.sessions === null ? '-' : String(r.sessions)) },
  { key: 'memberPrice', header: 'Membri', render: priceCell((r) => r.memberPrice) },
  { key: 'nonMemberPrice', header: 'Non-membri', render: priceCell((r) => r.nonMemberPrice) },
];

export interface PriceListCardProps {
  list: AdminPriceList;
  sectionName: string;
  onAdd: () => void;
  onOpen: (index: number) => void;
}

/** One price list: compact table, row click opens the drawer (phase2-designs-v1, option A). */
export function PriceListCard({ list, sectionName, onAdd, onOpen }: PriceListCardProps) {
  const rows = React.useMemo(() => list.items.map((item, index) => ({ ...item, index })), [list.items]);
  const add = (
    <Button variant="ghost" size="sm" icon={<IconPlus />} onClick={onAdd}>
      Adaugă preț
    </Button>
  );
  return (
    <EditorCard title={list.name} description={sectionName} headerAction={add}>
      {list.items.some((i) => i.incomplete) && <Notice tone="warning" title="Preț incomplet" />}
      <DataTable<Row>
        columns={COLUMNS}
        rows={rows}
        getRowKey={(r) => `${r.index}-${r.name}`}
        onRowClick={(r) => onOpen(r.index)}
        rowLabel={(r) => `Editează ${r.name}`}
        pageSize={0}
        empty="Niciun preț"
      />
      {hasTooltip(list.items) && <p className="ui-hint">* are tooltip. Clic pe rând pentru editare.</p>}
    </EditorCard>
  );
}
