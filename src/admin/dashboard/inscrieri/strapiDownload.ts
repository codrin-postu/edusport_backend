import { attemptTokenRefresh, triggerSessionExpired } from '@strapi/admin/strapi-admin';
import type { PostOptions } from './downloadPdf';

/** The options every fetch-based download passes: the backend URL, Strapi's token renewal and its session-expired redirect. */
export const strapiDownload = (): PostOptions => ({
  backendURL: (window as unknown as { strapi?: { backendURL?: string } }).strapi?.backendURL ?? '',
  refresh: attemptTokenRefresh,
  onSessionExpired: triggerSessionExpired,
});
