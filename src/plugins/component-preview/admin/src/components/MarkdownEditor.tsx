import * as React from 'react';
import { useTheme } from 'styled-components';
import type { StrapiTheme } from '@strapi/design-system';
import { Box, Flex } from '@strapi/design-system';
import { Bold, Image as ImageIcon, Italic, Link as LinkIcon } from '@strapi/icons';
import { MediaPicker, type PickedImage } from './MediaPicker';
import { LinkPicker, type LinkValue } from './LinkPicker';

export type HeadingLevel = 1 | 2 | 3;

export interface MarkdownEditorFeatures {
  /** Bold toolbar button. Default: true. */
  bold?: boolean;
  /** Italic toolbar button. Default: true. */
  italic?: boolean;
  /** Link toolbar button. Default: true. */
  link?: boolean;
  /**
   * Image toolbar button + media picker. Default: true (unlimited).
   * - `false` → button hidden.
   * - `true` → button shown, no count limit.
   * - `number` → button shown but disabled once that many images are embedded.
   */
  image?: boolean | number;
  /**
   * Heading levels allowed. Default: `[1, 2, 3]` (all three buttons).
   * - `false` → no heading buttons.
   * - Array → only those levels render (e.g. `[2]` → only H2 button).
   */
  headings?: false | HeadingLevel[];
  /** Bullet-list toolbar button. Default: true. */
  list?: boolean;
}

export interface MarkdownEditorProps {
  id?: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  italic?: boolean;
  onChange: (val: string) => void;
  ariaLabel?: string;
  rows?: number;
  /**
   * Per-feature toggles for the toolbar. Omitted features default to enabled.
   * Pass `features={{ image: false, headings: false }}` to render a minimal
   * editor; pass `features={{ image: 1 }}` to allow at most one image.
   */
  features?: MarkdownEditorFeatures;
}

interface EmbeddedImage {
  alt: string;
  url: string;
  start: number;
  end: number;
}

const IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

function findEmbeddedImages(src: string): EmbeddedImage[] {
  const out: EmbeddedImage[] = [];
  for (const m of src.matchAll(IMAGE_RE)) {
    if (m.index === undefined) continue;
    out.push({ alt: m[1], url: m[2], start: m.index, end: m.index + m[0].length });
  }
  return out;
}

// Lightweight markdown editor: textarea + toolbar (Bold / Italic / Link / Image
// / H1-H3 / List). Uses the Strapi media library for image insertion. Pairs
// with `frontend/src/utils/markdown.tsx`'s renderer.
export function MarkdownEditor({
  id,
  value,
  placeholder,
  disabled,
  italic,
  onChange,
  ariaLabel,
  rows = 5,
  features,
}: MarkdownEditorProps) {
  const theme = useTheme() as StrapiTheme;
  const ref = React.useRef<HTMLTextAreaElement | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const linkSelectionRef = React.useRef<{ start: number; end: number; text: string }>({
    start: 0,
    end: 0,
    text: '',
  });

  const showBold = features?.bold !== false;
  const showItalic = features?.italic !== false;
  const showLink = features?.link !== false;
  const imageFeature = features?.image ?? true;
  const showImage = imageFeature !== false;
  const imageMax = typeof imageFeature === 'number' ? imageFeature : Infinity;
  const headingLevels: HeadingLevel[] =
    features?.headings === false
      ? []
      : features?.headings ?? [1, 2, 3];
  const showList = features?.list !== false;

  const wrap = (before: string, after: string) => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, end + before.length);
    });
  };

  // Prepends `prefix` to every line of the current selection (or to the line
  // the caret sits on when selection is empty). Used for headings and lists.
  // For headings, strips any existing `#`-prefix first so the user can switch
  // levels by clicking H1 → H2 → H3 without stacking.
  const prefixLines = (prefix: string, replaceHeadings = false) => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = value.indexOf('\n', end);
    const blockEnd = lineEnd === -1 ? value.length : lineEnd;
    const block = value.slice(lineStart, blockEnd);
    const stripExisting = (l: string) =>
      replaceHeadings ? l.replace(/^#{1,6}\s+/, '') : l;
    const prefixed = block.length === 0
      ? prefix
      : block
          .split('\n')
          .map((l) => {
            const stripped = stripExisting(l);
            return stripped.startsWith(prefix) ? stripped : prefix + stripped;
          })
          .join('\n');
    const next = value.slice(0, lineStart) + prefixed + value.slice(blockEnd);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(lineStart + prefixed.length, lineStart + prefixed.length);
    });
  };

  // Snapshot the current selection (the textarea loses focus when the modal
  // opens, so we restore it to insert at the right offset on submit).
  const openLinkPicker = () => {
    const ta = ref.current;
    const start = ta?.selectionStart ?? value.length;
    const end = ta?.selectionEnd ?? value.length;
    linkSelectionRef.current = {
      start,
      end,
      text: value.slice(start, end),
    };
    setLinkOpen(true);
  };

  const insertLinkFromPicker = (link: LinkValue) => {
    const { start, end } = linkSelectionRef.current;
    const md = `[${link.text}](${link.url})`;
    const next = value.slice(0, start) + md + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      const ta = ref.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(start + md.length, start + md.length);
    });
  };

  const insertImageMarkdown = (img: PickedImage) => {
    const ta = ref.current;
    const start = ta?.selectionStart ?? value.length;
    const end = ta?.selectionEnd ?? value.length;
    const md = `![${img.alt}](${img.url})`;
    const next = value.slice(0, start) + md + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(start + md.length, start + md.length);
    });
  };

  const removeImageAt = (start: number, end: number) => {
    onChange(value.slice(0, start) + value.slice(end));
  };

  // Resolve a stored `/uploads/...` URL to something the admin browser can load.
  // The Strapi admin runs on the same origin as the backend, so window.location.origin works.
  const resolveSrc = (url: string): string => {
    if (/^https?:\/\//i.test(url)) return url;
    if (typeof window === 'undefined') return url;
    if (url.startsWith('/')) return `${window.location.origin}${url}`;
    return url;
  };

  const ToolbarButton = ({
    label,
    onClick,
    children,
    softDisabled,
  }: {
    label: string;
    onClick: () => void;
    children: React.ReactNode;
    /** When true, the button looks disabled and ignores clicks but the tooltip
     * (`label`) still fires on hover so users see why. */
    softDisabled?: boolean;
  }) => {
    const inactive = disabled || softDisabled;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={inactive ? undefined : onClick}
        title={label}
        aria-label={label}
        aria-disabled={inactive || undefined}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          padding: 0,
          border: 'none',
          borderRadius: 6,
          background: 'transparent',
          color: theme.colors.neutral700,
          cursor: inactive ? 'not-allowed' : 'pointer',
          opacity: inactive ? 0.4 : 1,
          fontFamily: 'inherit',
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => {
          if (inactive) return;
          e.currentTarget.style.background = theme.colors.neutral150;
          e.currentTarget.style.color = theme.colors.neutral800;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = theme.colors.neutral700;
        }}
      >
        {children}
      </button>
    );
  };

  const Divider = () => (
    <Box style={{ width: 1, height: 22, background: theme.colors.neutral200, margin: '0 6px' }} />
  );

  const embedded = findEmbeddedImages(value);
  const imageAtLimit = embedded.length >= imageMax;
  const imageLabel = imageAtLimit
    ? imageMax === 1
      ? 'Doar o imagine este permisă'
      : `Limită atinsă (${imageMax} imagini)`
    : 'Inserează imagine';

  const inlineGroup = showBold || showItalic || showLink || showImage;
  const headingGroup = headingLevels.length > 0;
  const listGroup = showList;

  const headingFontSize: Record<HeadingLevel, number> = { 1: 14, 2: 13, 3: 12 };

  return (
    <Flex direction="column" alignItems="stretch" gap={2} style={{ width: '100%' }}>
      <Flex gap={1} alignItems="center" wrap="wrap">
        {showBold && (
          <ToolbarButton label="Bold" onClick={() => wrap('**', '**')}>
            <Bold width="1.25rem" height="1.25rem" fill="currentColor" />
          </ToolbarButton>
        )}
        {showItalic && (
          <ToolbarButton label="Italic" onClick={() => wrap('*', '*')}>
            <Italic width="1.25rem" height="1.25rem" fill="currentColor" />
          </ToolbarButton>
        )}
        {showLink && (
          <ToolbarButton label="Inserează link" onClick={openLinkPicker}>
            <LinkIcon width="1.25rem" height="1.25rem" fill="currentColor" />
          </ToolbarButton>
        )}
        {showImage && (
          <ToolbarButton
            label={imageLabel}
            softDisabled={imageAtLimit}
            onClick={() => setPickerOpen(true)}
          >
            <ImageIcon width="1.25rem" height="1.25rem" fill="currentColor" />
          </ToolbarButton>
        )}

        {inlineGroup && headingGroup && <Divider />}

        {headingLevels.map((lvl) => (
          <ToolbarButton
            key={lvl}
            label={`Heading ${lvl}`}
            onClick={() => prefixLines('#'.repeat(lvl) + ' ', true)}
          >
            <span style={{ fontSize: headingFontSize[lvl], fontWeight: 700, lineHeight: 1 }}>
              H{lvl}
            </span>
          </ToolbarButton>
        ))}

        {(inlineGroup || headingGroup) && listGroup && <Divider />}

        {listGroup && (
          <ToolbarButton label="Listă" onClick={() => prefixLines('- ')}>
            <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>•</span>
          </ToolbarButton>
        )}
      </Flex>

      <textarea
        ref={ref}
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 10px',
          fontSize: 13,
          lineHeight: 1.5,
          fontFamily: 'inherit',
          fontStyle: italic ? 'italic' : 'normal',
          color: italic ? theme.colors.neutral500 : theme.colors.neutral800,
          background: disabled ? theme.colors.neutral100 : theme.colors.neutral0,
          border: `1px ${disabled ? 'dashed' : 'solid'} ${theme.colors.neutral200}`,
          borderRadius: 4,
          outline: 'none',
          resize: 'vertical',
          boxSizing: 'border-box',
          minHeight: 120,
        }}
      />

      {embedded.length > 0 && (
        <Box
          padding={2}
          style={{
            background: theme.colors.neutral100,
            borderRadius: 4,
            border: `1px solid ${theme.colors.neutral200}`,
          }}
        >
          <Box paddingBottom={2}>
            <span style={{ fontSize: 11, fontWeight: 600, color: theme.colors.neutral600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Imagini incluse ({embedded.length})
            </span>
          </Box>
          <Flex gap={2} wrap="wrap">
            {embedded.map((img, idx) => (
              <Box
                key={`${img.start}-${idx}`}
                style={{
                  position: 'relative',
                  width: 88,
                  height: 66,
                  borderRadius: 4,
                  overflow: 'hidden',
                  border: `1px solid ${theme.colors.neutral200}`,
                  background: theme.colors.neutral0,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveSrc(img.url)}
                  alt={img.alt}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <button
                  type="button"
                  onClick={() => removeImageAt(img.start, img.end)}
                  title="Elimină imaginea"
                  aria-label="Elimină imaginea"
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    width: 22,
                    height: 22,
                    border: 'none',
                    borderRadius: 4,
                    background: 'rgba(0,0,0,0.55)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </Box>
            ))}
          </Flex>
        </Box>
      )}

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={insertImageMarkdown}
      />

      <LinkPicker
        open={linkOpen}
        initialText={linkSelectionRef.current.text}
        onClose={() => setLinkOpen(false)}
        onSubmit={insertLinkFromPicker}
      />
    </Flex>
  );
}
