import * as React from 'react';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Notice } from './Notice';
import { EmptyState } from './EmptyState';
import { Loading } from './Spinner';

/**
 * One image picker for every custom page, on the shared Modal.
 *
 * Same data as the dashboard MediaModal (src/admin/dashboard/MediaPicker.tsx):
 * GET /upload/files, newest first, 60 per load, `_q` search; optional upload
 * through POST /upload (as NavigationPage's picker did). `accept` picks the
 * file kind: 'image' (default), 'video' (replaces VideoEmbedEditor's own
 * VideoPicker) or 'any'.
 *
 *   <ImagePicker open={o} onClose={close} onPick={(img) => ...} />
 *   <ImagePicker open={o} onClose={close} multiple onPick={(imgs) => ...} />
 *   <ImagePicker open={o} onClose={close} accept="video" onPick={(v) => ...} />
 *
 * Single mode picks on click. Multiple mode toggles tiles and confirms with
 * "Adaugă".
 */

export interface PickedImage {
  id: number;
  url: string;
  name: string | null;
  mime?: string;
  thumbnailUrl?: string;
}

interface UploadFile {
  id: number;
  name: string;
  url: string;
  mime: string;
  formats?: { thumbnail?: { url?: string } };
}

/** Picked file of any kind (same shape as PickedImage). */
export type PickedMedia = PickedImage;

export type MediaAccept = 'image' | 'video' | 'any';

interface BaseProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Kind of file offered and uploaded. Default 'image'. */
  accept?: MediaAccept;
  /** Show "Încarcă fișier". Default true. */
  allowUpload?: boolean;
}

export type ImagePickerProps =
  | (BaseProps & { multiple?: false; onPick: (image: PickedImage) => void })
  | (BaseProps & { multiple: true; onPick: (images: PickedImage[]) => void });

const toPicked = (f: UploadFile): PickedImage => ({
  id: f.id,
  url: f.url,
  name: f.name ?? null,
  mime: f.mime,
  thumbnailUrl: f.formats?.thumbnail?.url ?? f.url,
});

const MIME: Record<MediaAccept, string | null> = { image: 'image', video: 'video', any: null };

const COPY: Record<MediaAccept, { title: string; search: string; none: string; failed: string; one: string; many: string; zero: string }> = {
  image: {
    title: 'Alege o imagine',
    search: 'Caută imagini...',
    none: 'Nu există imagini.',
    failed: 'Nu am putut încărca imaginile.',
    zero: 'Nicio imagine aleasă',
    one: '1 imagine aleasă',
    many: 'imagini alese',
  },
  video: {
    title: 'Alege un videoclip',
    search: 'Caută videoclipuri...',
    none: 'Nu există videoclipuri.',
    failed: 'Nu am putut încărca videoclipurile.',
    zero: 'Niciun videoclip ales',
    one: '1 videoclip ales',
    many: 'videoclipuri alese',
  },
  any: {
    title: 'Alege un fișier',
    search: 'Caută fișiere...',
    none: 'Nu există fișiere.',
    failed: 'Nu am putut încărca fișierele.',
    zero: 'Niciun fișier ales',
    one: '1 fișier ales',
    many: 'fișiere alese',
  },
};

const fileExt = (name: string) => {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toUpperCase() : 'FIȘIER';
};

/** Tile preview: the thumbnail for images, the first frame for videos, the extension otherwise. */
function MediaPreview({ img }: { img: PickedImage }) {
  if (img.mime?.startsWith('image/')) return <div className="ui-img-pv" style={{ backgroundImage: `url(${img.thumbnailUrl})` }} />;
  if (img.mime?.startsWith('video/'))
    return (
      <div className="ui-img-pv">
        <video src={img.url} muted preload="metadata" playsInline aria-hidden="true" tabIndex={-1} />
      </div>
    );
  return (
    <div className="ui-img-pv ui-img-file">
      <span>{fileExt(img.name ?? '')}</span>
    </div>
  );
}

/** The media library query shared with the dashboard MediaModal. */
function useImageLibrary(open: boolean, q: string, reload: number, accept: MediaAccept) {
  const { get } = useFetchClient();
  const [files, setFiles] = React.useState<UploadFile[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (!open) return undefined;
    let off = false;
    setLoading(true);
    setFailed(false);
    const mime = MIME[accept];
    const params: Record<string, string | number> = {
      sort: 'updatedAt:desc',
      page: 1,
      pageSize: 60,
    };
    if (mime) params['filters[mime][$contains]'] = mime;
    if (q.trim()) params._q = q.trim();
    const t = window.setTimeout(() => {
      get('/upload/files', { params })
        .then((res: { data?: unknown }) => {
          if (off) return;
          const data = res?.data as UploadFile[] | { results?: UploadFile[] } | undefined;
          const list: UploadFile[] = Array.isArray(data) ? data : (data?.results ?? []);
          setFiles(mime ? list.filter((f) => f.mime?.startsWith(`${mime}/`)) : list);
        })
        .catch(() => {
          if (!off) setFailed(true);
        })
        .finally(() => {
          if (!off) setLoading(false);
        });
    }, q ? 250 : 0);
    return () => {
      off = true;
      window.clearTimeout(t);
    };
  }, [open, q, get, reload, accept]);

  return { files, loading, failed };
}

export function ImagePicker(props: ImagePickerProps) {
  const { open, onClose, accept = 'image', allowUpload = true } = props;
  const copy = COPY[accept];
  const title = props.title ?? copy.title;
  const { post } = useFetchClient();
  const [q, setQ] = React.useState('');
  const [reload, setReload] = React.useState(0);
  const [uploading, setUploading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [chosen, setChosen] = React.useState<PickedImage[]>([]);
  const fileInput = React.useRef<HTMLInputElement | null>(null);
  const searchRef = React.useRef<HTMLInputElement | null>(null);
  const { files, loading, failed } = useImageLibrary(open, q, reload, accept);

  React.useEffect(() => {
    if (open) {
      setChosen([]);
      setErr(null);
    }
  }, [open]);

  const pick = (img: PickedImage) => {
    if (props.multiple) {
      setChosen((cur) => (cur.some((c) => c.id === img.id) ? cur.filter((c) => c.id !== img.id) : [...cur, img]));
    } else {
      props.onPick(img);
    }
  };

  const upload = async (file: File) => {
    setUploading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append('files', file);
      const res = (await post('/upload', fd)) as { data?: UploadFile | UploadFile[] };
      const uploaded = Array.isArray(res?.data) ? res.data[0] : res?.data;
      if (uploaded && typeof uploaded.id === 'number') {
        if (props.multiple) {
          setChosen((cur) => [...cur, toPicked(uploaded)]);
          setReload((n) => n + 1);
        } else {
          props.onPick(toPicked(uploaded));
        }
      } else {
        setReload((n) => n + 1);
      }
    } catch {
      setErr('Nu am putut încărca fișierul.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      initialFocusRef={searchRef}
      headerExtra={
        <>
          <Input
            ref={searchRef}
            type="search"
            placeholder={copy.search}
            aria-label={copy.search.replace('...', '')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {allowUpload && (
            <>
              <input
                ref={fileInput}
                type="file"
                accept={accept === 'any' ? undefined : `${accept}/*`}
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void upload(f);
                }}
              />
              <Button variant="secondary" size="sm" loading={uploading} onClick={() => fileInput.current?.click()}>
                {uploading ? 'Se încarcă' : 'Încarcă fișier'}
              </Button>
            </>
          )}
          <Button variant="secondary" size="sm" onClick={onClose}>
            Închide
          </Button>
        </>
      }
      footer={
        props.multiple ? (
          <>
            <span className="ui-muted" style={{ marginRight: 'auto', alignSelf: 'center' }}>
              {chosen.length === 0 ? copy.zero : chosen.length === 1 ? copy.one : `${chosen.length} ${copy.many}`}
            </span>
            <Button variant="secondary" onClick={onClose}>Anulează</Button>
            <Button variant="primary" disabled={chosen.length === 0} onClick={() => props.onPick(chosen)}>
              Adaugă
            </Button>
          </>
        ) : undefined
      }
    >
      {err && <Notice tone="danger">{err}</Notice>}
      {loading ? (
        <Loading />
      ) : failed ? (
        <EmptyState>{copy.failed}</EmptyState>
      ) : files.length === 0 ? (
        <EmptyState>{copy.none}</EmptyState>
      ) : (
        <div className="ui-imgs" style={err ? { marginTop: 12 } : undefined}>
          {files.map((f) => {
            const img = toPicked(f);
            const on = chosen.some((c) => c.id === f.id);
            return (
              <button
                key={f.id}
                type="button"
                className="ui-img"
                title={f.name}
                aria-pressed={props.multiple ? on : undefined}
                onClick={() => pick(img)}
              >
                <MediaPreview img={img} />
                <div className="ui-img-name">{f.name}</div>
                {props.multiple && <span className="ui-img-tick">ales</span>}
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

export default ImagePicker;
