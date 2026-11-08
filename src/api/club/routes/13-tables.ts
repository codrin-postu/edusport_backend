/**
 * Admin API of the Sportivi "Tabele" tab (phase 11-4): the catalog, queries, downloads and saved views. Every route names the `money` area
 * (personal data and amounts leave only through these routes). Fixed paths come before parameter paths.
 */
import { adminRoute } from '../../../club/admin-area';

export default {
  routes: [
    { method: 'GET', path: '/club/tables/catalog', handler: 'tables.catalog', config: adminRoute('money') },
    { method: 'POST', path: '/club/tables/query', handler: 'tables.query', config: adminRoute('money') },
    { method: 'POST', path: '/club/tables/export', handler: 'tables.export', config: adminRoute('money') },
    { method: 'GET', path: '/club/table-views', handler: 'tables.views', config: adminRoute('money') },
    { method: 'POST', path: '/club/table-views', handler: 'tables.createView', config: adminRoute('money') },
    { method: 'PUT', path: '/club/table-views/:documentId', handler: 'tables.updateView', config: adminRoute('money') },
    { method: 'DELETE', path: '/club/table-views/:documentId', handler: 'tables.deleteView', config: adminRoute('money') },
  ],
};
