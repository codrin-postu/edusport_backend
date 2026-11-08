/**
 * Admin API of Plăți, De încasat and the money overview (spec 6, 11.3; 11-5 4.6). The `/club/money/*` routes name the `money` area. Content-api routes (under /api), auth off, `global::is-admin`.
 * Fixed paths come before parameter paths within each prefix (a source-reading test checks it).
 */
import { adminRoute } from '../../../club/admin-area';

const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/club/payments', handler: 'payments.list', config: adminGuard },
    { method: 'POST', path: '/club/payments', handler: 'payments.create', config: adminGuard },
    { method: 'GET', path: '/club/due', handler: 'payments.due', config: adminGuard },
    { method: 'GET', path: '/club/money/overview', handler: 'payments.moneyOverview', config: adminRoute('money') },
    { method: 'GET', path: '/club/money/accounting', handler: 'payments.accounting', config: adminRoute('money') },
    { method: 'GET', path: '/club/money/accounting.xlsx', handler: 'payments.accountingXlsx', config: adminRoute('money') },
    { method: 'GET', path: '/club/money/accounting.csv', handler: 'payments.accountingCsv', config: adminRoute('money') },
    { method: 'PUT', path: '/club/payments/:documentId', handler: 'payments.update', config: adminGuard },
    { method: 'POST', path: '/club/payments/:documentId/cancel', handler: 'payments.cancel', config: adminGuard },
    { method: 'GET', path: '/club/athletes/:documentId/payments/options', handler: 'payments.options', config: adminGuard },
    { method: 'GET', path: '/club/athletes/:documentId/payments', handler: 'payments.athlete', config: adminGuard },
  ],
};
