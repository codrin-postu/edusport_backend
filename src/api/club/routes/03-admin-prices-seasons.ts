/**
 * Admin API of the Prețuri and Sezoane pages. Content-api routes (under /api) with auth off and the
 * `global::is-admin` policy: usable from the admin UI with its Bearer token, never from the public API.
 */
const adminGuard = { auth: false, policies: ['global::is-admin'], middlewares: [] };

export default {
  routes: [
    { method: 'GET', path: '/club/prices', handler: 'prices.list', config: adminGuard },
    { method: 'POST', path: '/club/price-lists', handler: 'prices.createList', config: adminGuard },
    { method: 'POST', path: '/club/price-lists/:documentId/items', handler: 'prices.addItem', config: adminGuard },
    { method: 'PUT', path: '/club/price-lists/:documentId/items/:index', handler: 'prices.updateItem', config: adminGuard },
    { method: 'DELETE', path: '/club/price-lists/:documentId/items/:index', handler: 'prices.removeItem', config: adminGuard },
    { method: 'PUT', path: '/club/sections/:documentId/price-notes', handler: 'prices.saveNotes', config: adminGuard },
    { method: 'GET', path: '/club/seasons', handler: 'seasons.list', config: adminGuard },
    { method: 'POST', path: '/club/seasons', handler: 'seasons.create', config: adminGuard },
    { method: 'PUT', path: '/club/seasons/:documentId', handler: 'seasons.update', config: adminGuard },
  ],
};
