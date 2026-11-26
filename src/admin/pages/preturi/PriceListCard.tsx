import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, DataTable, EditorCard, HelpTip, StatusBadge, type DataColumn } from '../../ui';
import { IconPlus } from '../../ui/icons';
import { isExamplePriceList } from '../../../club/onboarding/fixtures';
import type { AdminPriceItem, AdminPriceList } from '../../../club/price-admin';
import { GRUPE_COPY } from '../../../club/groups/copy';
import { groupPageTo } from '../../../club/grupe/routes';
import { KIND_LABELS, priceText } from './format';

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
        {r.tooltip && <> <HelpTip label={r.tooltip} /></>}
      </>
    ),
  },
  { key: 'kind', header: 'Tip', render: (r) => KIND_LABELS[r.kind] },
  { key: 'sessions', header: 'Ședințe', render: (r) => (r.sessions === null ? '-' : String(r.sessions)) },
  { key: 'memberPrice', header: 'Membri', render: priceCell((r) => r.memberPrice) },
  { key: 'nonMemberPrice', header: 'Neafiliați', render: priceCell((r) => r.nonMemberPrice) },
];

/** The groups using the list, each a link to its page. */
function ListGroups({ groups }: { groups: AdminPriceList['groups'] }) {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
      <span className="ui-hint" style={{ margin: 0 }}>{GRUPE_COPY.title}</span>
      {groups.map((g) => (
        <Button key={g.documentId} variant="ghost" size="sm" onClick={() => navigate(groupPageTo(g.documentId, null))}>{g.name}</Button>
      ))}
    </div>
  );
}

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
      <DataTable<Row>
        columns={COLUMNS}
        rows={rows}
        getRowKey={(r) => `${r.index}-${r.name}`}
        onRowClick={(r) => onOpen(r.index)}
        rowProps={(r) => (isExamplePriceList(list.documentId) && r.index === 0 ? ({ 'data-tour': 'pr-pret' } as React.HTMLAttributes<HTMLTableRowElement>) : {})}
        rowLabel={(r) => `Editează ${r.name}`}
        pageSize={0}
        empty="Niciun preț"
      />
      {list.groups.length > 0 && <ListGroups groups={list.groups} />}
    </EditorCard>
  );
}
