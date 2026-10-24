/**
 * Registration PDFs (plan 2D). The public route is guarded by the signed 24-hour token in the query,
 * the others by the admin JWT (`global::is-admin`), like the other club admin routes.
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    {
      method: 'GET',
      path: '/forms/inscriere/documents',
      handler: 'documents.publicDownload',
      config: { auth: false, policies: [], middlewares: [] },
    },
    { method: 'GET', path: '/club/registrations/:documentId/documents/:kind', handler: 'documents.registrationDocument', config: adminGuard },
    { method: 'GET', path: '/club/documents/blank/:kind', handler: 'documents.blankForm', config: adminGuard },
  ],
};
