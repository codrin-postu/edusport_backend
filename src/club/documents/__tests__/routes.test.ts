import { expect, it } from 'vitest';
import { adminRoute } from '../../admin-area';
import routes from '../../../api/club/routes/03-documents';

it('serves the PDFs at the contract paths: public by token, the rest admin-only', () => {
  expect(routes.routes).toEqual([
    { method: 'GET', path: '/forms/inscriere/documents', handler: 'documents.publicDownload', config: { auth: false, policies: [], middlewares: [] } },
    {
      method: 'GET',
      path: '/club/registrations/:documentId/documents/:kind',
      handler: 'documents.registrationDocument',
      config: adminRoute('club'),
    },
    { method: 'GET', path: '/club/documents/blank/:kind', handler: 'documents.blankForm', config: adminRoute('club') },
  ]);
});
