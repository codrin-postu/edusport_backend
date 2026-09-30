import * as React from 'react';
import { useForm } from '@strapi/admin/strapi-admin';
import type { StrapiApp } from '@strapi/strapi/admin';

/**
 * Bridge between the global save bar (src/admin/SaveBar.tsx, mounted on its
 * own React root outside Strapi's providers) and the content-manager edit
 * view's form, so Renunță can reset the form in place instead of reloading.
 *
 * `NativeFormBridge` is injected into the edit view's `editView.right-links`
 * zone, which Strapi renders inside the edit view's <Form>, so it can read
 * the form context through `useForm`. It registers the form's `resetForm`
 * here while the edit view is mounted. `resetForm()` without arguments puts
 * the values back to the form's initial values (the last saved or loaded
 * document) and clears errors, so `modified` turns false: Strapi's Save
 * button disables, its navigation blocker and its beforeunload warning
 * (useWarnIfUnsavedChanges) switch off, and the save bar hides.
 */

type Reset = () => void;

/** Every mounted bridge, newest last (the desktop rail and the phone drawer can both render the zone). */
const resets: { id: symbol; reset: Reset }[] = [];

function register(reset: Reset): () => void {
  const entry = { id: Symbol('edusport-form-reset'), reset };
  resets.push(entry);
  return () => {
    const i = resets.findIndex((r) => r.id === entry.id);
    if (i !== -1) resets.splice(i, 1);
  };
}

/**
 * Reset the open content-manager form to its last saved values. Returns
 * false when no edit view form is registered (not on an edit view, or the
 * injection zone did not render), so the caller can fall back.
 */
export function resetNativeForm(): boolean {
  const last = resets[resets.length - 1];
  if (!last) return false;
  last.reset();
  return true;
}

/** Rendered by Strapi inside the edit view's form; renders nothing itself. */
function NativeFormBridge(): null {
  // shouldThrow=false: undefined instead of an error if the zone ever renders outside a form.
  const resetForm = useForm('EdusportNativeFormBridge', (s) => s.resetForm, false);
  React.useEffect(() => {
    if (!resetForm) return undefined;
    return register(() => resetForm());
  }, [resetForm]);
  return null;
}

/** Inject the bridge into the content-manager edit view. Call from the admin bootstrap. */
export function registerNativeFormBridge(app: Pick<StrapiApp, 'getPlugin'>): void {
  try {
    app.getPlugin('content-manager').injectComponent('editView', 'right-links', {
      name: 'edusport-native-form-bridge',
      Component: NativeFormBridge,
    });
  } catch (e) {
    console.warn('[edusport] could not inject the save bar form bridge; Renunță will reload the page instead.', e);
  }
}
