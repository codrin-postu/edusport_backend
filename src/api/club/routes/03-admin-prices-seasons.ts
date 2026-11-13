/**
 * Admin API of the Prețuri and Sezoane pages. Content-api routes (under /api) with auth off and the
 * `global::has-role` policy: usable from the admin UI with its Bearer token, never from the public API.
 */
import { adminRoute } from '../../../club/admin-area';

const website = adminRoute('website');
const settings = adminRoute('settings');

export default {
  routes: [
    { method: 'GET', path: '/club/prices', handler: 'prices.list', config: website },
    { method: 'POST', path: '/club/price-lists', handler: 'prices.createList', config: website },
    { method: 'POST', path: '/club/price-lists/:documentId/items', handler: 'prices.addItem', config: website },
    { method: 'PUT', path: '/club/price-lists/:documentId/items/:index', handler: 'prices.updateItem', config: website },
    { method: 'DELETE', path: '/club/price-lists/:documentId/items/:index', handler: 'prices.removeItem', config: website },
    { method: 'PUT', path: '/club/sections/:documentId/price-notes', handler: 'prices.saveNotes', config: website },
    { method: 'GET', path: '/club/seasons', handler: 'seasons.list', config: settings },
    { method: 'POST', path: '/club/seasons', handler: 'seasons.create', config: settings },
    { method: 'PUT', path: '/club/seasons/:documentId', handler: 'seasons.update', config: settings },
  ],
};
