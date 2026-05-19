import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import {
  Box,
  Flex,
  Loader,
  Modal,
  TextInput,
  Typography,
} from '@strapi/design-system';

export interface PickedImage {
  url: string;
  alt: string;
}

interface UploadedImage {
  id: number;
  name: string;
  url: string;
  mime: string;
  alternativeText: string | null;
  formats?: { thumbnail?: { url?: string } };
}

interface UploadResponse {
  results?: UploadedImage[];
}

const PAGE_SIZE = 30;

// Pulls uploaded images from Strapi's media library. Stores relative URLs
// (e.g. `/uploads/foo.png`) in markdown - the frontend prepends
// `NEXT_PUBLIC_STRAPI_URL` when rendering.
export function MediaPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (image: PickedImage) => void;
}) {
  const { get } = useFetchClient();
  const [images, setImages] = React.useState<UploadedImage[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params: Record<string, string | number> = {
      'filters[mime][$contains]': 'image',
      'sort': 'updatedAt:desc',
      'page': 1,
      'pageSize': PAGE_SIZE,
    };
    if (search.trim()) params['_q'] = search.trim();
    get('/upload/files', { params })
      .then((res: unknown) => {
        if (cancelled) return;
        // /upload/files returns either an array or { results, pagination }
        const data = (res as { data: unknown }).data;
        const list = Array.isArray(data)
          ? (data as UploadedImage[])
          : ((data as UploadResponse).results ?? []);
        setImages(list.filter((f) => f.mime?.startsWith('image/')));
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message ?? 'Eroare la încărcarea imaginilor');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (img: UploadedImage) => {
    onPick({ url: img.url, alt: img.alternativeText ?? img.name ?? '' });
    onClose();
  };

  return (
    <Modal.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Modal.Content style={{ maxWidth: 760 }}>
        <Modal.Header>
          <Modal.Title>Alege o imagine din bibliotecă</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Flex direction="column" gap={4} alignItems="stretch">
            <TextInput
              aria-label="Caută"
              placeholder="Caută imagini după nume…"
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            />

            {loading ? (
              <Flex justifyContent="center" paddingTop={6} paddingBottom={6}>
                <Loader>Se încarcă…</Loader>
              </Flex>
            ) : error ? (
              <Typography textColor="danger600">{error}</Typography>
            ) : images.length === 0 ? (
              <Typography textColor="neutral500" fontStyle="italic">
                Nu există imagini.
              </Typography>
            ) : (
              <Box
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: 12,
                  maxHeight: 460,
                  overflowY: 'auto',
                }}
              >
                {images.map((img) => {
                  const thumb = img.formats?.thumbnail?.url ?? img.url;
                  return (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => pick(img)}
                      title={img.name}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        gap: 6,
                        padding: 6,
                        border: '1px solid #eaeaef',
                        borderRadius: 6,
                        background: '#fff',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#4945ff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#eaeaef'; }}
                    >
                      <Box
                        style={{
                          width: '100%',
                          aspectRatio: '4 / 3',
                          background: '#f6f6f9',
                          borderRadius: 4,
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumb}
                          alt={img.alternativeText ?? img.name}
                          loading="lazy"
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover' }}
                        />
                      </Box>
                      <span
                        style={{
                          fontSize: 11,
                          color: '#32324d',
                          textAlign: 'left',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {img.name}
                      </span>
                    </button>
                  );
                })}
              </Box>
            )}
          </Flex>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
