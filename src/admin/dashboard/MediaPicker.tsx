import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';

/**
 * Shared media picker modal for the custom admin pages.
 *
 * Extracted verbatim from SportivEditPage so HomepageEditPage can reuse it
 * rather than carrying a second copy. Behaviour is unchanged: it lists image
 * uploads newest first, filters client side on the search box, and hands back
 * the picked file's numeric id and url, which is what the content-manager
 * PUT expects.
 */
// ---- media picker modal ----------------------------------------------------
export interface UploadFile {
  id: number;
  name: string;
  url: string;
  mime: string;
  formats?: { thumbnail?: { url?: string } };
}
export function MediaModal({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (f: { id: number; url: string }) => void }) {
  const { get } = useFetchClient();
  const [files, setFiles] = React.useState<UploadFile[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [q, setQ] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    let off = false;
    setLoading(true);
    const params: Record<string, string | number> = {
      'filters[mime][$contains]': 'image',
      sort: 'updatedAt:desc',
      page: 1,
      pageSize: 60,
    };
    if (q.trim()) params._q = q.trim();
    get('/upload/files', { params })
      .then((res: any) => {
        if (off) return;
        const data = res?.data;
        const list: UploadFile[] = Array.isArray(data) ? data : data?.results ?? [];
        setFiles(list.filter((f) => f.mime?.startsWith('image/')));
      })
      .catch(() => {})
      .finally(() => {
        if (!off) setLoading(false);
      });
    return () => {
      off = true;
    };
  }, [open, q, get]);

  if (!open) return null;
  return (
    <div
      onMouseDown={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,26,54,.28)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width: 720, maxWidth: '100%', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #dcdcdc', borderRadius: 6, overflow: 'hidden' }}
      >
        <div style={{ padding: '13px 15px', borderBottom: '1px solid #e0e2e8', display: 'flex', alignItems: 'center', gap: 10 }}>
          <b style={{ fontSize: 14 }}>Alege o imagine</b>
          <input placeholder="Caută imagini..." value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
          <button className="btn sm" type="button" onClick={onClose}>
            Închide
          </button>
        </div>
        <div style={{ padding: 14, overflowY: 'auto' }}>
          {loading ? (
            <div className="empty">Se încarcă...</div>
          ) : files.length === 0 ? (
            <div className="empty">Nu există imagini.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 10 }}>
              {files.map((f) => {
                const thumb = f.formats?.thumbnail?.url ?? f.url;
                return (
                  <button
                    key={f.id}
                    type="button"
                    title={f.name}
                    onClick={() => onPick({ id: f.id, url: f.url })}
                    style={{ padding: 5, border: '1px solid #d0d0d0', borderRadius: 4, background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <div style={{ width: '100%', aspectRatio: '1/1', background: `#f6f6f9 center/cover no-repeat`, backgroundImage: `url(${thumb})`, borderRadius: 3 }} />
                    <div style={{ fontSize: 11, color: '#32324d', marginTop: 4, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{f.name}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
