import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminPage, Window, PageHeader, Notice, Button, DataTable, EmptyState, StatusBadge, type DataColumn } from '../ui';
import { useCollection, type Row } from '../lib';
import { DASHBOARD_TO } from '../dashboard/menu';
import { EVENIMENT_COLABORARE_EDIT_TO, UID } from './routes';

/**
 * Evenimente colaborare: the collaboration-event list (shown on /parteneri,
 * sorted by `order`). A row opens its own edit page
 * (EVENIMENT_COLABORARE_EDIT_TO?id=<documentId>); "Adaugă eveniment" opens it
 * without an id.
 *
 * `date` is free text on this type ("Decembrie 2024"), so the date column
 * sorts on the month and year read from it; text without a year sorts last.
 */

interface MediaFile {
  id: number;
  url: string;
  name?: string | null;
  formats?: { thumbnail?: { url?: string } } | null;
}

interface CollaborationEvent {
  title: string | null;
  partner: string | null;
  date: string | null;
  description: string | null;
  image: MediaFile | null;
  order: number | null;
}

type EventRow = Row<CollaborationEvent>;

const MONTHS: Record<string, number> = {
  ianuarie: 1,
  februarie: 2,
  martie: 3,
  aprilie: 4,
  mai: 5,
  iunie: 6,
  iulie: 7,
  august: 8,
  septembrie: 9,
  octombrie: 10,
  noiembrie: 11,
  decembrie: 12,
};

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** "Decembrie 2024" -> 202412, "2023" -> 202300, no year -> null (sorts last). */
function dateSortKey(text: string | null | undefined): number | null {
  const t = fold(text ?? '');
  const year = t.match(/\b(19|20)\d{2}\b/);
  if (!year) return null;
  const month = Object.keys(MONTHS).find((m) => t.includes(m));
  return Number(year[0]) * 100 + (month ? MONTHS[month] : 0);
}

const THUMB_STYLE: React.CSSProperties = {
  display: 'block',
  width: 'calc(var(--ui-space-4) * 3)',
  height: 'calc(var(--ui-space-4) * 3)',
  objectFit: 'cover',
  borderRadius: 'var(--ui-radius-sm)',
  border: '1px solid var(--theme-border)',
  background: 'var(--theme-surface-sunken)',
};

function Thumb({ image }: { image: MediaFile | null }) {
  if (!image?.url) return <span style={THUMB_STYLE} aria-hidden="true" />;
  return <img style={THUMB_STYLE} src={image.formats?.thumbnail?.url ?? image.url} alt="" loading="lazy" />;
}

function Status({ row }: { row: EventRow }) {
  if (!row.image) return <StatusBadge tone="warning">Fără imagine</StatusBadge>;
  if (!(row.description ?? '').trim()) return <StatusBadge tone="warning">Fără descriere</StatusBadge>;
  return <StatusBadge tone="success">Complet</StatusBadge>;
}

const editUrl = (documentId?: string) => (documentId ? `${EVENIMENT_COLABORARE_EDIT_TO}?id=${encodeURIComponent(documentId)}` : EVENIMENT_COLABORARE_EDIT_TO);

const EvenimenteColaborarePage: React.FC = () => {
  const navigate = useNavigate();
  const list = useCollection<CollaborationEvent>(UID.collaborationEvent);

  const columns: DataColumn<EventRow>[] = [
    { key: 'image', header: 'Imagine', width: '64px', searchable: false, render: (r) => <Thumb image={r.image} />, value: () => null },
    { key: 'title', header: 'Titlu', sortable: true, render: (r) => <strong>{r.title || 'Fără titlu'}</strong>, value: (r) => r.title ?? '' },
    { key: 'partner', header: 'Partener', sortable: true, value: (r) => r.partner ?? '' },
    { key: 'date', header: 'Dată', sortable: true, render: (r) => r.date ?? '', value: (r) => dateSortKey(r.date) },
    { key: 'order', header: 'Ordine', sortable: true, align: 'right', width: '88px', searchable: false, value: (r) => r.order ?? null },
    { key: 'status', header: 'Stare', searchable: false, render: (r) => <Status row={r} />, value: () => null },
  ];

  return (
    <AdminPage>
      <Window>
        <PageHeader
          back={{ to: DASHBOARD_TO }}
          title="Evenimente colaborare"
          subtitle="Evenimentele realizate împreună cu partenerii, afișate pe pagina /parteneri în ordinea câmpului Ordine"
          actions={<Button onClick={() => navigate(editUrl())}>+ Adaugă eveniment</Button>}
        />
        <div className="ui-body">
          {list.error ? (
            <Notice tone="danger">Nu am putut încărca evenimentele.</Notice>
          ) : (
            <DataTable<EventRow>
              columns={columns}
              rows={list.items}
              getRowKey={(r) => r.documentId}
              onRowClick={(r) => navigate(editUrl(r.documentId))}
              rowLabel={(r) => `Editează ${r.title || 'evenimentul'}`}
              loading={list.loading}
              search
              searchPlaceholder="Caută după titlu, partener sau dată..."
              empty={
                <EmptyState action={<Button onClick={() => navigate(editUrl())}>+ Adaugă eveniment</Button>}>
                  Niciun eveniment adăugat.
                </EmptyState>
              }
            />
          )}
        </div>
      </Window>
    </AdminPage>
  );
};

export default EvenimenteColaborarePage;
