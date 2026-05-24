import * as React from 'react';
import { createPortal } from 'react-dom';
import { Transforms } from 'slate';
import { imagePickerStore, type MediaPickerAsset } from './imagePickerStore';

/**
 * Discoverability augmentation for Strapi's Blocks editor toolbar.
 *
 * One button rendered INSIDE the Radix Toolbar (via portal), positioned just
 * after Strapi's existing controls:
 *
 *   • Imagine — opens Strapi's native MediaLibraryDialog (browse + upload).
 *     On selection, walks React fibers from the contenteditable to find the
 *     live Slate editor instance, then calls `Transforms.insertNodes` to
 *     insert an image block at the caret. Bypasses Strapi's block-type
 *     dropdown entirely.
 *
 * Why not insert via Slate fragment paste? Strapi's BlocksInput paste handler
 * (`plugins/withLinks.js`) only reads `text/plain` — it doesn't recognise
 * `application/x-slate-fragment` or image clipboard data. Direct
 * `Transforms.insertNodes` on the editor is the only working insertion path.
 */

const TOOLBAR_SELECTOR = '[role="toolbar"]';
const SLOT_ATTR = 'data-edusport-blocks-toolbar-slot';
const STRAPI_THEME_KEY = 'STRAPI_THEME';
const JWT_KEY = 'jwtToken';

type ThemeName = 'light' | 'dark';

interface Palette {
  text: string;
  textMuted: string;
  hoverSurface: string;
  border: string;
  popoverSurface: string;
  popoverBorder: string;
  inputBg: string;
  inputBorder: string;
  primary: string;
  primaryText: string;
  primaryHover: string;
  surface: string;
  backdrop: string;
}

const PALETTES: Record<ThemeName, Palette> = {
  light: {
    text: '#212134',
    textMuted: '#666687',
    hoverSurface: '#f0f0ff',
    border: '#dcdce4',
    popoverSurface: '#ffffff',
    popoverBorder: '#dcdce4',
    inputBg: '#ffffff',
    inputBorder: '#c0c0cf',
    primary: '#4945ff',
    primaryText: '#ffffff',
    primaryHover: '#7b79ff',
    surface: '#f6f6f9',
    backdrop: 'rgba(33, 33, 52, 0.4)',
  },
  dark: {
    text: '#f0f0ff',
    textMuted: '#a5a5ba',
    hoverSurface: '#2c2c45',
    border: '#4a4a6a',
    popoverSurface: '#212134',
    popoverBorder: '#4a4a6a',
    inputBg: '#181826',
    inputBorder: '#4a4a6a',
    primary: '#7b79ff',
    primaryText: '#0f0f1c',
    primaryHover: '#9b99ff',
    surface: '#1a1a2e',
    backdrop: 'rgba(0, 0, 0, 0.6)',
  },
};

function useTheme(): ThemeName {
  const read = React.useCallback((): ThemeName => {
    try {
      const raw = localStorage.getItem(STRAPI_THEME_KEY);
      if (raw) {
        const cleaned = raw.replace(/^"|"$/g, '').toLowerCase();
        if (cleaned === 'light' || cleaned === 'dark') return cleaned;
      }
    } catch {
      /* localStorage unavailable */
    }
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  }, []);
  const [theme, setTheme] = React.useState<ThemeName>(read);
  React.useEffect(() => {
    const id = window.setInterval(() => setTheme(read()), 1500);
    return () => window.clearInterval(id);
  }, [read]);
  return theme;
}

// --------------------------------------------------------------------------
// Slate editor discovery via React fiber walking
// --------------------------------------------------------------------------

interface SlateEditorLike {
  insertNodes?: unknown;
  apply?: unknown;
  selection?: unknown;
  children?: unknown;
}

function isSlateEditor(value: unknown): value is SlateEditorLike {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.apply === 'function' &&
    Array.isArray(v.children) &&
    'selection' in v
  );
}

function getReactFiberKey(el: Element): string | null {
  for (const key of Object.keys(el)) {
    if (key.startsWith('__reactFiber$')) return key;
  }
  return null;
}

interface Fiber {
  return: Fiber | null;
  memoizedProps: Record<string, unknown> | null;
  memoizedState: unknown;
  stateNode: unknown;
}

/**
 * Walk fibers up from the toolbar element looking for the Slate `<Slate>`
 * provider, whose `memoizedProps.editor` is the live editor instance.
 */
function findSlateEditor(toolbar: HTMLElement): SlateEditorLike | null {
  // Find the contenteditable sibling first — fibers from there reach the
  // Slate provider more reliably than fibers from the toolbar (which sits
  // above the editor's <Slate> wrapper).
  let cursor: HTMLElement | null = toolbar.parentElement;
  let editable: HTMLElement | null = null;
  let depth = 0;
  while (cursor && depth < 8) {
    editable = cursor.querySelector<HTMLElement>('[contenteditable="true"]');
    if (editable) break;
    cursor = cursor.parentElement;
    depth++;
  }
  if (!editable) return null;

  const fiberKey = getReactFiberKey(editable);
  if (!fiberKey) return null;
  let fiber: Fiber | null = (editable as unknown as Record<string, Fiber>)[fiberKey];

  // Walk up to 30 fibers — Slate's provider chain is typically 5-10 deep
  // from the contenteditable, but content-manager wrapping adds more.
  let walked = 0;
  while (fiber && walked < 30) {
    const props = fiber.memoizedProps;
    if (props && isSlateEditor(props.editor)) {
      return props.editor as SlateEditorLike;
    }
    fiber = fiber.return;
    walked++;
  }
  return null;
}

// --------------------------------------------------------------------------
// Image node construction + insertion
// --------------------------------------------------------------------------

// Use the shared MediaPickerAsset type from the store. The shape mirrors
// what Strapi's MediaLibraryDialog passes to onSelectAssets — same fields
// the native Image block uses internally.
type StrapiAsset = MediaPickerAsset;

interface SlateImageNode {
  type: 'image';
  image: StrapiAsset;
  children: [{ type: 'text'; text: '' }];
}

function buildImageNode(asset: StrapiAsset): SlateImageNode {
  return {
    type: 'image',
    image: {
      name: asset.name ?? '',
      alternativeText: asset.alternativeText ?? '',
      url: asset.url,
      caption: asset.caption ?? '',
      width: asset.width ?? null,
      height: asset.height ?? null,
      formats: asset.formats ?? null,
      hash: asset.hash ?? '',
      ext: asset.ext ?? '',
      mime: asset.mime ?? '',
      size: asset.size ?? 0,
      previewUrl: asset.previewUrl ?? null,
      provider: asset.provider ?? '',
      provider_metadata: asset.provider_metadata ?? null,
      createdAt: asset.createdAt ?? '',
      updatedAt: asset.updatedAt ?? '',
    },
    children: [{ type: 'text', text: '' }],
  };
}

function insertImagesIntoEditor(
  editor: SlateEditorLike,
  assets: StrapiAsset[],
): void {
  if (!assets.length) return;
  const nodes = assets.map(buildImageNode);
  try {
    // `Transforms.insertNodes` handles caret positioning, splitting current
    // paragraph, and creating a follow-up empty paragraph automatically.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Transforms.insertNodes(editor as any, nodes as any);
  } catch (err) {
    console.error('[edusport] Failed to insert image into Slate editor', err);
  }
}

// --------------------------------------------------------------------------
// Helper: locate the contenteditable element associated with a toolbar.
// Used by the image insertion flow to focus the editor before inserting
// nodes (so the caret position is preserved).
// --------------------------------------------------------------------------

function findEditorContentEditable(toolbar: Element): HTMLElement | null {
  let cursor: Element | null = toolbar.parentElement;
  let depth = 0;
  while (cursor && depth < 8) {
    const ed = cursor.querySelector<HTMLElement>('[contenteditable="true"]');
    if (ed) return ed;
    cursor = cursor.parentElement;
    depth++;
  }
  return null;
}


// --------------------------------------------------------------------------
// Toolbar button
// --------------------------------------------------------------------------

interface ToolbarButtonProps {
  palette: Palette;
  ariaLabel: string;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}

function ToolbarButton({
  palette,
  ariaLabel,
  title,
  onClick,
  children,
}: ToolbarButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={title}
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        padding: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: 4,
        background: 'transparent',
        color: palette.text,
        cursor: 'pointer',
        transition: 'background 0.15s',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = palette.hoverSurface;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}

function IconImage({ size = 18 }: { size?: number }): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

// --------------------------------------------------------------------------
// Per-toolbar UI: rendered via portal directly into Strapi's toolbar root.
// --------------------------------------------------------------------------

function ToolbarExtraButtons({
  toolbar,
  palette,
}: {
  toolbar: HTMLElement;
  palette: Palette;
}): React.ReactElement {
  // Image button publishes to the shared store; MediaLibraryBridge (rendered
  // inside Strapi's app tree via VideoEmbedEditor) picks up the request and
  // shows the native MediaLibraryDialog. Closure captures the live Slate
  // editor reference so the callback inserts into the right toolbar's body.
  const handleImageClick = () => {
    imagePickerStore.open(
      (assets) => {
        const editor = findSlateEditor(toolbar);
        if (!editor) {
          console.error('[edusport] Could not locate Slate editor for toolbar', toolbar);
          return;
        }
        const editable = findEditorContentEditable(toolbar);
        editable?.focus();
        insertImagesIntoEditor(editor, assets);
      },
      ['images'],
    );
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        marginLeft: 6,
        paddingLeft: 6,
        borderLeft: `1px solid ${palette.border}`,
      }}
    >
      <ToolbarButton
        palette={palette}
        ariaLabel="Inserează imagine"
        title="Inserează imagine"
        onClick={handleImageClick}
      >
        <IconImage />
      </ToolbarButton>
    </span>
  );
}

// --------------------------------------------------------------------------
// Top-level
// --------------------------------------------------------------------------

interface ToolbarRecord {
  toolbar: HTMLElement;
  slot: HTMLElement;
}

function isBlocksToolbar(toolbar: HTMLElement): boolean {
  let cursor: HTMLElement | null = toolbar.parentElement;
  let depth = 0;
  while (cursor && depth < 8) {
    if (cursor.querySelector('[contenteditable="true"]')) return true;
    cursor = cursor.parentElement;
    depth++;
  }
  return false;
}

export function BlocksToolbarExtra(): React.ReactElement | null {
  const theme = useTheme();
  const palette = PALETTES[theme];
  const [records, setRecords] = React.useState<ToolbarRecord[]>([]);

  React.useEffect(() => {
    let cancelled = false;

    const sync = () => {
      if (cancelled) return;
      const toolbars = Array.from(document.querySelectorAll<HTMLElement>(TOOLBAR_SELECTOR))
        .filter(isBlocksToolbar);

      const next: ToolbarRecord[] = [];
      for (const toolbar of toolbars) {
        let slot = toolbar.querySelector<HTMLElement>(`[${SLOT_ATTR}]`);
        if (!slot) {
          slot = document.createElement('span');
          slot.setAttribute(SLOT_ATTR, 'true');
          slot.style.display = 'inline-flex';
          slot.style.alignItems = 'center';
          toolbar.appendChild(slot);
        }
        next.push({ toolbar, slot });
      }

      setRecords((prev) => {
        if (prev.length === next.length) {
          let same = true;
          for (let i = 0; i < prev.length; i++) {
            if (prev[i].toolbar !== next[i].toolbar) {
              same = false;
              break;
            }
          }
          if (same) return prev;
        }
        return next;
      });

    };

    sync();
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        sync();
      });
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  if (records.length === 0) return null;

  return (
    <>
      {records.map(({ toolbar, slot }, idx) =>
        createPortal(
          <ToolbarExtraButtons toolbar={toolbar} palette={palette} />,
          slot,
          `edusport-toolbar-extra-${idx}`,
        ),
      )}
    </>
  );
}
