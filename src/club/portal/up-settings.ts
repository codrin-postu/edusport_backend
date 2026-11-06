import type { Core } from '@strapi/strapi';

const KEYS = ['allow_register', 'email_confirmation'] as const;

// The coach portal creates its accounts itself. Public registration and U&P's
// own e-mail confirmation must stay off, so boot switches them off if an admin turned them on.
export async function checkUpSettings(strapi: Core.Strapi): Promise<void> {
  const store = strapi.store({ type: 'plugin', name: 'users-permissions', key: 'advanced' });
  const value = (await store.get()) as Record<string, unknown> | null;
  if (!value || !KEYS.some((k) => value[k] === true)) return;
  const next: Record<string, unknown> = { ...value };
  for (const k of KEYS) next[k] = false;
  await store.set({ value: next });
  strapi.log.warn('[portal] U&P registration and e-mail confirmation turned off');
}
