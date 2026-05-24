import * as React from 'react';
import { useField, useFetchClient, useStrapiApp } from '@strapi/admin/strapi-admin';
import {
  Box,
  Button,
  Field,
  Flex,
  Loader,
  Modal,
  Radio,
  TextInput,
  Typography,
} from '@strapi/design-system';
import { CloudUpload, Plus, Trash } from '@strapi/icons';
import { EditorCard } from './components/EditorCard';
import { EditorField } from './components/EditorField';
import {
  imagePickerStore,
  type MediaPickerAsset,
} from '../../../../admin/imagePickerStore';

interface Props {
  name: string;
  attribute: Record<string, unknown>;
}

// JSON shape stored in the underlying field.
type Mode = 'url' | 'upload';
interface VideoEmbedValue {
  mode: Mode;
  url: string; // YouTube/Vimeo URL when mode='url', or absolute media URL when mode='upload'
  mime?: string; // populated when mode='upload' so the frontend knows the file type
}

const EMPTY: VideoEmbedValue = { mode: 'url', url: '' };

interface UploadedVideo {
  id: number;
  name: string;
  url: string;
  mime: string;
  size?: number;
}

interface UploadResponse {
  results?: UploadedVideo[];
}

const PAGE_SIZE = 30;

/** Inline video picker. Same shape as MediaPicker but filtered to video MIME. */
function VideoPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (video: UploadedVideo) => void;
}): React.ReactElement | null {
  const { get } = useFetchClient();
  const [videos, setVideos] = React.useState<UploadedVideo[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params: Record<string, string | number> = {
      'filters[mime][$contains]': 'video',
      sort: 'updatedAt:desc',
      page: 1,
      pageSize: PAGE_SIZE,
    };
    if (search.trim()) {
      params['filters[name][$containsi]'] = search.trim();
    }
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    get<UploadResponse>(`/upload/files?${qs}`)
      .then((res) => {
        if (cancelled) return;
        setVideos(res.data?.results ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Nu s-au putut încărca videoclipurile.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, search, get]);

  if (!open) return null;

  return (
    <Modal.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>Selectează un video din Bibliotecă</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Box paddingBottom={3}>
            <TextInput
              id="video-picker-search"
              name="search"
              aria-label="Caută video"
              value={search}
              placeholder="Caută după nume…"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            />
          </Box>
          {loading ? (
            <Flex justifyContent="center" padding={6}>
              <Loader>Se încarcă…</Loader>
            </Flex>
          ) : error ? (
            <Typography textColor="danger600">{error}</Typography>
          ) : videos.length === 0 ? (
            <Typography textColor="neutral500" fontStyle="italic">
              Niciun video găsit. Încarcă unul mai întâi în Biblioteca Media.
            </Typography>
          ) : (
            <Flex direction="column" gap={2} alignItems="stretch">
              {videos.map((v) => (
                <Box
                  key={v.id}
                  background="neutral0"
                  borderColor="neutral200"
                  borderStyle="solid"
                  borderWidth="1px"
                  borderRadius="4px"
                  padding={3}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    onPick(v);
                    onClose();
                  }}
                >
                  <Flex justifyContent="space-between" alignItems="center" gap={3}>
                    <Box flex="1" minWidth="0">
                      <Typography variant="omega" fontWeight="semiBold" ellipsis>
                        {v.name}
                      </Typography>
                      <Typography variant="pi" textColor="neutral500">
                        {v.mime}
                        {typeof v.size === 'number' ? ` · ${Math.round(v.size)} KB` : ''}
                      </Typography>
                    </Box>
                    <Button variant="tertiary" size="S">
                      Selectează
                    </Button>
                  </Flex>
                </Box>
              ))}
            </Flex>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="tertiary" onClick={onClose}>
            Închide
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}

/**
 * In-tree bridge to Strapi's native MediaLibraryDialog. Subscribes to
 * `imagePickerStore` and renders the dialog when an external caller (the
 * body-mounted Blocks toolbar) has requested it. Lives inside this editor
 * so it inherits the StrapiAppProvider context — `useStrapiApp` would
 * throw at the body-level mount where the toolbar buttons live.
 *
 * Renders null when no picker is requested, so it has zero visual cost.
 */
function MediaLibraryBridge(): React.ReactElement | null {
  // useSyncExternalStore would be ideal here, but we don't need
  // concurrent-mode guarantees — a plain useState + subscribe works fine
  // and keeps the rerender behavior obvious.
  const [snapshot, setSnapshot] = React.useState(() => imagePickerStore.get());
  React.useEffect(() => imagePickerStore.subscribe(() => setSnapshot(imagePickerStore.get())), []);

  const components = useStrapiApp(
    'MediaLibraryBridge',
    (state: { components: Record<string, React.ComponentType<unknown>> }) => state.components,
  );

  if (!snapshot.isOpen) return null;
  if (!components) return null;
  const MediaLibraryDialog = components['media-library'] as React.ComponentType<{
    allowedTypes: string[];
    onClose: () => void;
    onSelectAssets: (assets: MediaPickerAsset[]) => void;
  }> | undefined;
  if (!MediaLibraryDialog) return null;

  const handleSelect = (assets: MediaPickerAsset[]) => {
    const cb = snapshot.onPick;
    imagePickerStore.close();
    cb?.(assets);
  };

  return (
    <MediaLibraryDialog
      allowedTypes={snapshot.allowedTypes}
      onClose={() => imagePickerStore.close()}
      onSelectAssets={handleSelect}
    />
  );
}

export default function VideoEmbedEditor({ name }: Props): React.ReactElement {
  const field = useField(name);

  const [data, setData] = React.useState<VideoEmbedValue>(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const raw = v as Partial<VideoEmbedValue>;
      return {
        mode: raw.mode === 'upload' ? 'upload' : 'url',
        url: typeof raw.url === 'string' ? raw.url : '',
        mime: typeof raw.mime === 'string' ? raw.mime : undefined,
      };
    }
    return EMPTY;
  });

  React.useEffect(() => {
    const v = field.value;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const raw = v as Partial<VideoEmbedValue>;
      setData({
        mode: raw.mode === 'upload' ? 'upload' : 'url',
        url: typeof raw.url === 'string' ? raw.url : '',
        mime: typeof raw.mime === 'string' ? raw.mime : undefined,
      });
    }
  }, [field.value]);

  const commit = (next: VideoEmbedValue) => {
    setData(next);
    field.onChange(name, next);
  };

  // Switching modes clears the URL — enforces strict XOR.
  const setMode = (mode: Mode) => {
    commit({ mode, url: '', mime: undefined });
  };

  const [pickerOpen, setPickerOpen] = React.useState(false);

  return (
    <Box width="100%">
      {/* Side-mounted bridge that lets the body-level Blocks toolbar open
          Strapi's native MediaLibraryDialog. Renders null until the toolbar
          publishes an open request, so zero visual cost otherwise. */}
      <MediaLibraryBridge />
      <EditorCard
        title="Video"
        description="Adaugă un singur video — fie ca link extern (YouTube, Vimeo) fie ca fișier încărcat. Doar una dintre cele două opțiuni poate fi setată în același timp."
      >
        <Box padding={4}>
          <Flex direction="column" gap={4} alignItems="stretch">
            <Field.Root id={`${name}-mode`} name="mode">
              <Field.Label>Tip video</Field.Label>
              <Box paddingTop={2}>
                <Radio.Group
                  value={data.mode}
                  onValueChange={(value: string) => setMode(value as Mode)}
                  aria-label="Tip video"
                  style={{ display: 'flex', gap: 24, alignItems: 'center' }}
                >
                  <label
                    htmlFor={`${name}-mode-url`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                  >
                    <Radio.Item id={`${name}-mode-url`} value="url" />
                    <Typography variant="omega">Link extern (URL)</Typography>
                  </label>
                  <label
                    htmlFor={`${name}-mode-upload`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                  >
                    <Radio.Item id={`${name}-mode-upload`} value="upload" />
                    <Typography variant="omega">Fișier încărcat în Strapi</Typography>
                  </label>
                </Radio.Group>
              </Box>
            </Field.Root>

            {data.mode === 'url' ? (
              <EditorField
                name={`${name}-url`}
                label="Link video"
                hint="ex: https://youtube.com/watch?v=… sau https://vimeo.com/…"
              >
                <TextInput
                  id={`${name}-url`}
                  name={`${name}-url`}
                  type="url"
                  value={data.url}
                  placeholder="https://youtube.com/watch?v=..."
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    commit({ ...data, url: e.target.value, mime: undefined })
                  }
                />
              </EditorField>
            ) : (
              <Field.Root id={`${name}-file`} name="file" hint="Fișierul ales din Biblioteca Media">
                <Field.Label>Fișier video</Field.Label>
                <Box paddingTop={2}>
                  {data.url ? (
                    <Flex
                      gap={3}
                      alignItems="center"
                      padding={3}
                      background="neutral100"
                      borderColor="neutral200"
                      borderStyle="solid"
                      borderWidth="1px"
                      borderRadius="4px"
                    >
                      <Box flex="1" minWidth="0">
                        <Typography variant="omega" fontWeight="semiBold" ellipsis>
                          {data.url.split('/').pop() ?? data.url}
                        </Typography>
                        <Typography variant="pi" textColor="neutral500">
                          {data.mime ?? 'video'}
                        </Typography>
                      </Box>
                      <Button
                        variant="tertiary"
                        startIcon={<CloudUpload />}
                        onClick={() => setPickerOpen(true)}
                      >
                        Schimbă
                      </Button>
                      <Button
                        variant="danger-light"
                        startIcon={<Trash />}
                        onClick={() => commit({ ...data, url: '', mime: undefined })}
                      >
                        Elimină
                      </Button>
                    </Flex>
                  ) : (
                    <Button
                      variant="secondary"
                      startIcon={<Plus />}
                      onClick={() => setPickerOpen(true)}
                    >
                      Alege un video din Biblioteca Media
                    </Button>
                  )}
                </Box>
                <Field.Hint />
              </Field.Root>
            )}
          </Flex>
        </Box>
      </EditorCard>

      <VideoPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(v) =>
          commit({
            mode: 'upload',
            url: v.url,
            mime: v.mime,
          })
        }
      />
    </Box>
  );
}
