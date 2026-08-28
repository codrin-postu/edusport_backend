import { factories } from '@strapi/strapi';

// Default core router (admin/permission-gated CRUD). The public submit and the
// admin custom endpoints live in 01-public.ts and 02-admin.ts respectively.
export default factories.createCoreRouter('api::registration-submission.registration-submission');
