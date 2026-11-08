import type { Core } from '@strapi/strapi';
import { refreshReuseMiddleware, reuseDeps } from '../club/admin-login/refresh-reuse';

/**
 * Global middleware in front of Strapi's `POST /admin/access-token`: a copied refresh cookie that Strapi would keep answering
 * (it re-signs the child of a rotated token) ends the device's sessions instead (6b-1 B1 H1).
 */
export default (_config: unknown, { strapi }: { strapi: Core.Strapi }) => refreshReuseMiddleware(reuseDeps)(strapi);
