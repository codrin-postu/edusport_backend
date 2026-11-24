/**
 * Admin API of Plăți, De încasat and the money overview (spec 6, 11.3; 11-5 4.6). The `/club/money/*` routes name the `money` area. Content-api routes (under /api), auth off, `global::has-role`.
 * Fixed paths come before parameter paths within each prefix (a source-reading test checks it).
 */
import { featureRoute } from '../../../club/admin-area';

export default {
  routes: [
    { method: 'GET', path: '/club/payments', handler: 'payments.list', config: featureRoute('abonamente', 'club') },
    { method: 'POST', path: '/club/payments', handler: 'payments.create', config: featureRoute('abonamente', 'club') },
    { method: 'GET', path: '/club/due', handler: 'payments.due', config: featureRoute('abonamente', 'club') },
    { method: 'GET', path: '/club/money/overview', handler: 'payments.moneyOverview', config: featureRoute('abonamente', 'money') },
    { method: 'GET', path: '/club/money/accounting', handler: 'payments.accounting', config: featureRoute('abonamente', 'money') },
    { method: 'GET', path: '/club/money/accounting.xlsx', handler: 'payments.accountingXlsx', config: featureRoute('abonamente', 'money') },
    { method: 'GET', path: '/club/money/accounting.csv', handler: 'payments.accountingCsv', config: featureRoute('abonamente', 'money') },
    { method: 'PUT', path: '/club/payments/:documentId', handler: 'payments.update', config: featureRoute('abonamente', 'club') },
    { method: 'POST', path: '/club/payments/:documentId/cancel', handler: 'payments.cancel', config: featureRoute('abonamente', 'club') },
    { method: 'GET', path: '/club/athletes/:documentId/payments/options', handler: 'payments.options', config: featureRoute('abonamente', 'club') },
    { method: 'GET', path: '/club/athletes/:documentId/payments', handler: 'payments.athlete', config: featureRoute('abonamente', 'club') },
  ],
};
