import * as React from 'react';
import { SaveBarView, useDiscardConfirm, useSlideIn } from './ui/SaveBarView';
import { useAdminTheme } from './ui/useAdminTheme';
import { ensureAdminUi } from './ui/styles';

/**
 * Global save bar for Strapi's native content-manager edit pages. app.tsx
 * hides Strapi's own Save / Publish / Unpublish / Preview controls and tags
 * them; this bar mirrors their state through a MutationObserver and forwards
 * clicks to them. The look is the shared SaveBarView (src/admin/ui), the same
 * bar custom pages get from ui/SaveBar.tsx; colours come from the --theme-*
 * tokens and the theme from useAdminTheme.
 *
 * Custom pages never show this bar: their buttons sit inside `.pce` or
 * `.ui-root`, which the app.tsx tagger skips, so nothing is tagged there.
 */

const DEFAULT_SAVE_SELECTOR = '[data-edusport-default-save]';
const DEFAULT_PUBLISH_SELECTOR = '[data-edusport-default-publish]';
const DEFAULT_UNPUBLISH_SELECTOR = '[data-edusport-default-unpublish]';
const DEFAULT_PREVIEW_SELECTOR = '[data-edusport-default-preview]';

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
  // a `disabled` attribute, only buttons do). Check both signals so the
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
  // wrong page, the DevTools console shows exactly which URL was clicked ,
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

export function SaveBar(): React.ReactElement | null {
  const theme = useAdminTheme();
  const { state: barState, clickSave, clickPublish, clickUnpublish, clickPreview } = useBarState();

  // Tokens + .ui-savebar classes; the bootstrap already injects them, this is a safety net.
  React.useEffect(() => {
    ensureAdminUi();
  }, []);

  // Derived flags. Save is "active" when its button exists and is enabled
  // (Strapi disables it when the form is clean). Saving = either the Save
  // OR a publishing action is currently in flight, both freeze the bar.
  const dirty = barState.save.enabled;
  const saving = barState.save.loading || barState.publish.loading || barState.unpublish.loading;
  const canSave = barState.save.enabled;
  const canPublish = barState.publish.exists && barState.publish.enabled;
  const canUnpublish = barState.unpublish.exists && barState.unpublish.enabled;
  // Preview is opportunistic, show whenever Strapi has registered a preview
  // URL for this content type, regardless of dirty state.
  const canPreview = barState.preview.exists && barState.preview.enabled;

  // Show the bar whenever ANY relevant action is available, dirty form,
  // an enabled publish, an enabled unpublish, OR a preview URL configured.
  // Clean entries with no actions don't surface the bar at all.
  const shouldShow = dirty || saving || canPublish || canUnpublish || canPreview;
  const { mounted, visible } = useSlideIn(shouldShow);

  // Two-step discard: first click asks, second click reloads. Esc while
  // asking cancels (keyboard handling lives in SaveBarView).
  const { confirming, ask, cancel } = useDiscardConfirm(dirty);
  const confirmDiscard = React.useCallback(() => {
    cancel();
    discardViaReload();
  }, [cancel]);

  if (!mounted) return null;

  return (
    <SaveBarView
      theme={theme}
      state={saving ? 'saving' : dirty ? 'dirty' : 'idle'}
      visible={visible}
      confirming={confirming}
      canSave={canSave}
      canPublish={canPublish}
      canUnpublish={canUnpublish}
      canPreview={canPreview}
      onSave={clickSave}
      onDiscard={ask}
      onConfirmDiscard={confirmDiscard}
      onCancelDiscard={cancel}
      onPublish={clickPublish}
      onUnpublish={clickUnpublish}
      onPreview={clickPreview}
    />
  );
}
