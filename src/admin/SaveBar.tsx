import * as React from 'react';

const STRAPI_THEME_KEY = 'STRAPI_THEME';
const DEFAULT_SAVE_SELECTOR = '[data-edusport-default-save]';
const DEFAULT_PUBLISH_SELECTOR = '[data-edusport-default-publish]';
const DEFAULT_UNPUBLISH_SELECTOR = '[data-edusport-default-unpublish]';
const DEFAULT_PREVIEW_SELECTOR = '[data-edusport-default-preview]';

type ThemeName = 'light' | 'dark';

interface Palette {
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryHover: string;
  primaryText: string;
  success: string;
  successHover: string;
  successText: string;
  danger: string;
  warning: string;
  shadow: string;
}

const PALETTES: Record<ThemeName, Palette> = {
  light: {
    surface: '#212134',
    surfaceMuted: '#32324d',
    border: '#4a4a6a',
    text: '#f6f6f9',
    textMuted: '#c0c0cf',
    primary: '#4945ff',
    primaryHover: '#7b79ff',
    primaryText: '#ffffff',
    success: '#328048',
    successHover: '#5cb176',
    successText: '#ffffff',
    danger: '#d02b20',
    warning: '#d9822f',
    shadow: '0 10px 32px rgba(33, 33, 52, 0.32), 0 4px 12px rgba(33, 33, 52, 0.16)',
  },
  dark: {
    surface: '#0f0f1c',
    surfaceMuted: '#1a1a2e',
    border: '#2a2a3e',
    text: '#f0f0ff',
    textMuted: '#a5a5ba',
    primary: '#7b79ff',
    primaryHover: '#9b99ff',
    primaryText: '#0f0f1c',
    success: '#5cb176',
    successHover: '#78c597',
    successText: '#0f0f1c',
    danger: '#f56565',
    warning: '#ed8936',
    shadow: '0 10px 32px rgba(0, 0, 0, 0.6), 0 4px 12px rgba(0, 0, 0, 0.4)',
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
    const onStorage = (e: StorageEvent) => {
      if (e.key === STRAPI_THEME_KEY) setTheme(read());
    };
    window.addEventListener('storage', onStorage);
    const interval = window.setInterval(() => setTheme(read()), 1500);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(interval);
    };
  }, [read]);
  return theme;
}

function useNarrow(threshold = 640): boolean {
  const [narrow, setNarrow] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(max-width: ${threshold}px)`).matches,
  );
  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${threshold}px)`);
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, [threshold]);
  return narrow;
}

/**
 * Mirror the (hidden) default Save button's `disabled` and saving state into
 * React state. Strapi disables the Save button when the form is clean OR
 * submitting; we disambiguate the saving state by checking for an
 * `aria-busy="true"` attribute or a child SVG with a `[class*="spinner"]`
 * (the conventions Strapi's admin uses on action buttons in v5).
 */
interface ActionState {
  exists: boolean;       // button is in the DOM
  enabled: boolean;      // button is interactable (not disabled)
  loading: boolean;      // button is in a saving / publishing state
}

interface BarState {
  save: ActionState;
  publish: ActionState;
  unpublish: ActionState;
  preview: ActionState;
}

const EMPTY_ACTION: ActionState = { exists: false, enabled: false, loading: false };

function readActionState(btn: Element | null): ActionState {
  if (!btn) return EMPTY_ACTION;
  // Strapi disables the Preview link by setting `aria-disabled` and
  // `pointer-events: none` on the underlying anchor (the link doesn't have
  // a `disabled` attribute — only buttons do). Check both signals so the
  // SaveBar's preview button mirrors Strapi's enabled/disabled state.
  const htmlBtn = btn as HTMLButtonElement;
  const ariaDisabled = btn.getAttribute('aria-disabled') === 'true';
  const ptrEventsNone =
    (btn as HTMLElement).style?.pointerEvents === 'none' ||
    (window.getComputedStyle?.(btn as Element).pointerEvents === 'none');
  const disabled = htmlBtn.disabled || ariaDisabled || ptrEventsNone;
  const ariaBusy = btn.getAttribute('aria-busy') === 'true';
  const hasSpinner =
    btn.querySelector('[class*="spinner" i], [class*="loading" i], [data-state="loading"]') != null;
  const loading = ariaBusy || hasSpinner;
  return { exists: true, enabled: !disabled, loading };
}

function actionsEqual(a: ActionState, b: ActionState): boolean {
  return a.exists === b.exists && a.enabled === b.enabled && a.loading === b.loading;
}

function useBarState(): {
  state: BarState;
  clickSave: () => void;
  clickPublish: () => void;
  clickUnpublish: () => void;
  clickPreview: () => void;
} {
  const [state, setState] = React.useState<BarState>({
    save: EMPTY_ACTION,
    publish: EMPTY_ACTION,
    unpublish: EMPTY_ACTION,
    preview: EMPTY_ACTION,
  });

  React.useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      if (cancelled) return;
      const save = readActionState(document.querySelector(DEFAULT_SAVE_SELECTOR));
      const publish = readActionState(document.querySelector(DEFAULT_PUBLISH_SELECTOR));
      const unpublish = readActionState(document.querySelector(DEFAULT_UNPUBLISH_SELECTOR));
      const preview = readActionState(document.querySelector(DEFAULT_PREVIEW_SELECTOR));
      setState((prev) => {
        if (
          actionsEqual(prev.save, save) &&
          actionsEqual(prev.publish, publish) &&
          actionsEqual(prev.unpublish, unpublish) &&
          actionsEqual(prev.preview, preview)
        ) {
          return prev;
        }
        return { save, publish, unpublish, preview };
      });
    };

    refresh();

    const observer = new MutationObserver(refresh);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'disabled',
        'aria-busy',
        'class',
        'data-state',
        'data-edusport-default-save',
        'data-edusport-default-publish',
        'data-edusport-default-unpublish',
        'data-edusport-default-preview',
      ],
    });

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  const clickBySelector = (selector: string) => {
    const el = document.querySelector(selector) as HTMLElement | null;
    el?.click();
  };

  // Preview click goes through its own helper that LOGS the target anchor's
  // href before clicking. If the SaveBar's preview button ever opens the
  // wrong page, the DevTools console shows exactly which URL was clicked —
  // which makes diagnosing tagging bugs trivial.
  const clickPreview = React.useCallback(() => {
    const el = document.querySelector(DEFAULT_PREVIEW_SELECTOR) as
      | HTMLAnchorElement
      | HTMLButtonElement
      | null;
    if (!el) {
      console.warn('[edusport] Previzualizează clicked but no tagged preview element found');
      return;
    }
    const href = (el as HTMLAnchorElement).href ?? '';
    const ariaDisabled = el.getAttribute('aria-disabled') === 'true';
    console.debug('[edusport] Previzualizează → forwarding click to', {
      element: el,
      href,
      ariaDisabled,
    });
    el.click();
  }, []);

  return {
    state,
    clickSave: React.useCallback(() => clickBySelector(DEFAULT_SAVE_SELECTOR), []),
    clickPublish: React.useCallback(() => clickBySelector(DEFAULT_PUBLISH_SELECTOR), []),
    clickUnpublish: React.useCallback(() => clickBySelector(DEFAULT_UNPUBLISH_SELECTOR), []),
    clickPreview,
  };
}

/**
 * Discard pending changes. Strapi v5 doesn't expose a flat "Discard" button
 * in the right rail (the action lives behind the "More actions" dropdown,
 * which we don't want to programmatically traverse). Pragmatic approach:
 * reload the page; Strapi's content controller refetches the persisted entry,
 * effectively discarding the in-memory edits. We clear Strapi's own
 * beforeunload guard first so the user isn't double-prompted.
 *
 * The "are you sure?" UX is rendered inline by <SaveBar />, not via
 * window.confirm.
 */
function discardViaReload(): void {
  window.onbeforeunload = null;
  window.location.reload();
}

interface SaveBarUIProps {
  palette: Palette;
  narrow: boolean;
  state: 'dirty' | 'saving' | 'idle';
  confirming: boolean;
  canSave: boolean;
  canPublish: boolean;
  canUnpublish: boolean;
  canPreview: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onPreview: () => void;
  onConfirmDiscard: () => void;
  onCancelDiscard: () => void;
  visible: boolean;
}

function SaveBarUI({
  palette,
  narrow,
  state,
  confirming,
  canSave,
  canPublish,
  canUnpublish,
  canPreview,
  onSave,
  onDiscard,
  onPublish,
  onUnpublish,
  onPreview,
  onConfirmDiscard,
  onCancelDiscard,
  visible,
}: SaveBarUIProps): React.ReactElement {
  const isSaving = state === 'saving';
  const isIdle = state === 'idle';

  const rootStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    left: narrow ? 0 : '50%',
    right: narrow ? 0 : undefined,
    bottom: narrow ? 0 : 16,
    transform: visible
      ? narrow
        ? 'translateY(0)'
        : 'translate(-50%, 0)'
      : narrow
        ? 'translateY(110%)'
        : 'translate(-50%, 110%)',
    opacity: visible ? 1 : 0,
    transition: visible
      ? 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 180ms ease-out'
      : 'transform 140ms ease-in, opacity 140ms ease-in',
    background: palette.surface,
    color: palette.text,
    borderRadius: narrow ? '12px 12px 0 0' : 8,
    boxShadow: palette.shadow,
    display: 'flex',
    alignItems: 'center',
    gap: narrow ? 8 : 14,
    padding: narrow ? '12px 14px' : '10px 12px 10px 16px',
    paddingBottom: narrow ? 'max(12px, env(safe-area-inset-bottom))' : 10,
    minWidth: narrow ? undefined : 360,
    maxWidth: narrow ? undefined : 720,
    width: narrow ? '100%' : undefined,
    border: `1px solid ${palette.border}`,
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    fontSize: 14,
  };

  const labelText = confirming
    ? 'Sigur că renunți la modificări?'
    : isSaving
      ? 'Se salvează…'
      : isIdle
        ? canPublish
          ? 'Modificări gata de publicare'
          : canUnpublish
            ? 'Publicat'
            : canPreview
              ? 'Previzualizare disponibilă'
              : ''
        : 'Modificări nesalvate';

  const iconBg = confirming
    ? palette.danger
    : isIdle && !canPublish
      ? palette.success
      : palette.warning;

  const iconStyle: React.CSSProperties = {
    width: 18,
    height: 18,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: iconBg,
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1,
  };

  const ghostBtnStyle: React.CSSProperties = {
    padding: narrow ? '8px 12px' : '6px 12px',
    border: `1px solid ${palette.border}`,
    borderRadius: 6,
    background: 'transparent',
    color: palette.text,
    cursor: isSaving ? 'not-allowed' : 'pointer',
    opacity: isSaving ? 0.5 : 1,
    fontSize: 13,
    fontFamily: 'inherit',
    fontWeight: 500,
    flexShrink: 0,
    transition: 'background 0.15s, border-color 0.15s',
  };

  // Hover handlers shared by every ghost button. Subtle background tint
  // mirroring the SaveBar's surfaceMuted color, plus a brighter border so
  // the button reads as "interactive" without competing with the primary.
  const ghostHover = {
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isSaving) return;
      e.currentTarget.style.background = palette.surfaceMuted;
      e.currentTarget.style.borderColor = palette.textMuted;
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.borderColor = palette.border;
    },
  };

  const primaryBtnStyle: React.CSSProperties = {
    padding: narrow ? '8px 16px' : '6px 14px',
    border: 'none',
    borderRadius: 6,
    background: palette.primary,
    color: palette.primaryText,
    cursor: isSaving ? 'progress' : 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    transition: 'background 0.15s',
  };

  const labelStyle: React.CSSProperties = {
    color: palette.textMuted,
    flex: 1,
    minWidth: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const dangerBtnStyle: React.CSSProperties = {
    ...primaryBtnStyle,
    background: palette.danger,
  };

  const successBtnStyle: React.CSSProperties = {
    ...primaryBtnStyle,
    background: palette.success,
    color: palette.successText,
  };

  return (
    <div role="status" aria-live="polite" style={rootStyle}>
      <span aria-hidden style={iconStyle}>
        {isSaving ? <Spinner color="#fff" /> : '!'}
      </span>
      <span style={labelStyle}>{labelText}</span>
      {confirming ? (
        <>
          <button
            type="button"
            onClick={onCancelDiscard}
            style={ghostBtnStyle}
            aria-label="Anulează renunțarea"
            {...ghostHover}
          >
            Nu
          </button>
          <button
            type="button"
            onClick={onConfirmDiscard}
            style={dangerBtnStyle}
            aria-label="Confirmă renunțarea"
            autoFocus
          >
            Da, renunță
          </button>
        </>
      ) : (
        <>
          {/* Discard + Save are only meaningful while the form is dirty. */}
          {!isIdle && (
            <>
              <button
                type="button"
                onClick={onDiscard}
                disabled={isSaving}
                style={ghostBtnStyle}
                aria-label="Renunță la modificări"
                {...ghostHover}
              >
                Renunță
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving || !canSave}
                style={primaryBtnStyle}
                aria-label="Salvează modificările"
                onMouseEnter={(e) => {
                  if (!isSaving) e.currentTarget.style.background = palette.primaryHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = palette.primary;
                }}
              >
                {isSaving ? <Spinner color={palette.primaryText} /> : null}
                Salvează
              </button>
            </>
          )}
          {/* Preview — visible whenever a preview URL is configured for this
              content type. Renders next to Save/Discard so it's reachable
              without committing changes. */}
          {canPreview && (
            <button
              type="button"
              onClick={onPreview}
              disabled={isSaving}
              style={ghostBtnStyle}
              aria-label="Previzualizează articolul"
              {...ghostHover}
            >
              Previzualizează
            </button>
          )}
          {/* Publish / Unpublish stay available whether the form is dirty or
              clean — Strapi will prompt to save first if needed. */}
          {canPublish && (
            <button
              type="button"
              onClick={onPublish}
              disabled={isSaving}
              style={successBtnStyle}
              aria-label="Publică"
              onMouseEnter={(e) => {
                if (!isSaving) e.currentTarget.style.background = palette.successHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = palette.success;
              }}
            >
              Publică
            </button>
          )}
          {canUnpublish && (
            <button
              type="button"
              onClick={onUnpublish}
              disabled={isSaving}
              style={ghostBtnStyle}
              aria-label="Retrage publicarea"
              {...ghostHover}
            >
              Retrage publicarea
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Spinner({ color }: { color: string }): React.ReactElement {
  return (
    <span
      aria-hidden
      style={{
        width: 12,
        height: 12,
        border: `2px solid ${color}`,
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'edusport-savebar-spin 0.7s linear infinite',
        display: 'inline-block',
      }}
    />
  );
}

const KEYFRAMES_ID = 'edusport-savebar-keyframes';
function injectKeyframes(): void {
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = '@keyframes edusport-savebar-spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
}

export function SaveBar(): React.ReactElement | null {
  const theme = useTheme();
  const narrow = useNarrow();
  const palette = PALETTES[theme];
  const { state: barState, clickSave, clickPublish, clickUnpublish, clickPreview } = useBarState();

  // Derived flags. Save is "active" when its button exists and is enabled
  // (Strapi disables it when the form is clean). Saving = either the Save
  // OR a publishing action is currently in flight — both freeze the bar.
  const dirty = barState.save.enabled;
  const saving = barState.save.loading || barState.publish.loading || barState.unpublish.loading;
  const canSave = barState.save.enabled;
  const canPublish = barState.publish.exists && barState.publish.enabled;
  const canUnpublish = barState.unpublish.exists && barState.unpublish.enabled;
  // Preview is opportunistic — show whenever Strapi has registered a preview
  // URL for this content type, regardless of dirty state.
  const canPreview = barState.preview.exists && barState.preview.enabled;

  React.useEffect(() => {
    injectKeyframes();
  }, []);

  // Mount lifecycle decoupled from "should be visible" so we can play the
  // exit animation before unmounting the DOM.
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  // Show the bar whenever ANY relevant action is available — dirty form,
  // an enabled publish, an enabled unpublish, OR a preview URL configured.
  // Clean entries with no actions don't surface the bar at all.
  const shouldShow = dirty || saving || canPublish || canUnpublish || canPreview;

  React.useEffect(() => {
    if (shouldShow) {
      setMounted(true);
      const t = window.setTimeout(() => setVisible(true), 16);
      return () => window.clearTimeout(t);
    }
    setVisible(false);
    const t = window.setTimeout(() => setMounted(false), 180);
    return () => window.clearTimeout(t);
  }, [shouldShow]);

  // Two-step discard: first click flips into a confirming state; second click
  // commits the reload. Esc while confirming cancels back to the dirty state.
  const [confirming, setConfirming] = React.useState(false);

  const handleDiscard = React.useCallback(() => {
    setConfirming(true);
  }, []);
  const handleConfirmDiscard = React.useCallback(() => {
    setConfirming(false);
    discardViaReload();
  }, []);
  const handleCancelDiscard = React.useCallback(() => {
    setConfirming(false);
  }, []);

  // Auto-revert the confirming state after 5 seconds of inactivity so the
  // bar doesn't get stuck waiting for an answer the user has forgotten about.
  React.useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), 5000);
    return () => window.clearTimeout(t);
  }, [confirming]);

  // Reset confirming state if the form becomes clean (e.g. save just landed).
  React.useEffect(() => {
    if (!dirty) setConfirming(false);
  }, [dirty]);

  React.useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        if (dirty && !saving) {
          e.preventDefault();
          if (confirming) setConfirming(false);
          clickSave();
        }
      } else if (e.key === 'Escape' && dirty && !saving) {
        if (confirming) {
          setConfirming(false);
        } else {
          handleDiscard();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mounted, dirty, saving, confirming, clickSave, handleDiscard]);

  if (!mounted) return null;

  const state: 'dirty' | 'saving' | 'idle' = saving
    ? 'saving'
    : dirty
      ? 'dirty'
      : 'idle';

  return (
    <SaveBarUI
      palette={palette}
      narrow={narrow}
      state={state}
      confirming={confirming}
      canSave={canSave}
      canPublish={canPublish}
      canUnpublish={canUnpublish}
      canPreview={canPreview}
      visible={visible}
      onSave={clickSave}
      onDiscard={handleDiscard}
      onPublish={clickPublish}
      onUnpublish={clickUnpublish}
      onPreview={clickPreview}
      onConfirmDiscard={handleConfirmDiscard}
      onCancelDiscard={handleCancelDiscard}
    />
  );
}
