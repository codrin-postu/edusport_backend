import * as React from 'react';
import { createPortal } from 'react-dom';
import { Transforms } from 'slate';
import { imagePickerStore, type MediaPickerAsset } from './imagePickerStore';
import { ensureAdminUi } from './ui/styles';

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
const JWT_KEY = 'jwtToken';
const TOOLBAR_STYLE_ID = 'edu-tbx-styles';

/*
 * The slot sits inside Strapi's own toolbar, outside every page, so it
 * carries `.ui-root`: the --theme-* tokens (light / dark, kept in step with
 * Strapi's theme by useAdminTheme through ensureAdminUi) style the button,
 * no private palette. Kept free of backticks.
 */
const TOOLBAR_CSS = `
.ui-root.edu-tbx{display:inline-flex;align-items:center;gap:2px;margin-left:6px;padding-left:6px;border-left:1px solid var(--theme-border)}
.ui-root .edu-tbx-btn{width:32px;height:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;border:none;border-radius:var(--ui-radius-sm);background:transparent;color:var(--theme-text);cursor:pointer;transition:background-color var(--ui-motion-fast) var(--ui-easing);font-family:inherit}
.ui-root .edu-tbx-btn:hover{background:var(--theme-primary-soft)}
.ui-root .edu-tbx-btn:focus-visible{outline:2px solid var(--theme-focus);outline-offset:-2px}
`;

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
  ariaLabel: string;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}

function ToolbarButton({ ariaLabel, title, onClick, children }: ToolbarButtonProps): React.ReactElement {
  return (
    <button type="button" className="edu-tbx-btn" aria-label={ariaLabel} title={title} onClick={onClick}>
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

function ToolbarExtraButtons({ toolbar }: { toolbar: HTMLElement }): React.ReactElement {
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
    <span className="ui-root edu-tbx">
      <ToolbarButton ariaLabel="Inserează imagine" title="Inserează imagine" onClick={handleImageClick}>
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

/** Injects the tokens (ensureAdminUi) and the button styles once, into <head>. */
function StyleOnce(): null {
  React.useInsertionEffect(() => {
    ensureAdminUi();
    if (document.getElementById(TOOLBAR_STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = TOOLBAR_STYLE_ID;
    el.textContent = TOOLBAR_CSS;
    document.head.appendChild(el);
  }, []);
  return null;
}

export function BlocksToolbarExtra(): React.ReactElement | null {
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
      <StyleOnce />
      {records.map(({ toolbar, slot }, idx) =>
        createPortal(
          <ToolbarExtraButtons toolbar={toolbar} />,
          slot,
          `edusport-toolbar-extra-${idx}`,
        ),
      )}
    </>
  );
}
