import { adminActor } from '../../../club/admin-actor';
import { indexParam, refuseWith, respond, type AdminCtx } from '../../../club/admin-http';
import { PRICE_ERRORS, readNewListInput, readPriceItemInput, readPriceNotes, type ItemEdit } from '../../../club/price-admin';
import { createPriceList, editPriceItem, loadAdminPrices, savePriceNotes } from '../../../club/price-admin-service';
import { strapiPriceStore } from '../../../club/price-admin-store';

/**
 * Admin API of the Prețuri page (routes/03-admin-prices-seasons.ts, all `global::is-admin`).
 * Every answer is the whole page data (`AdminPrices`), so the page simply replaces its state.
 */
const store = () => strapiPriceStore(strapi);
const actor = (ctx: AdminCtx) => adminActor(ctx.request.header.authorization, strapi);
const text = (v: unknown) => (typeof v === 'string' ? v : '');

async function runItemEdit(ctx: AdminCtx, edit: ItemEdit) {
  respond(ctx, await editPriceItem(store(), ctx.params.documentId ?? '', edit, await actor(ctx)));
}

/** The item edit for PUT and DELETE: the row's place plus the name the admin saw there. */
function placeOf(ctx: AdminCtx, expectedName: unknown): { index: number; expectedName: string } | null {
  const index = indexParam(ctx.params.index);
  return index === null ? null : { index, expectedName: text(expectedName) };
}

export default {
  async list(ctx: AdminCtx) {
    ctx.body = { data: await loadAdminPrices(store()) };
  },

  async createList(ctx: AdminCtx) {
    const input = readNewListInput(ctx.request.body);
    if (input.ok === false) return refuseWith(ctx, 400, input.error);
    respond(ctx, await createPriceList(store(), input.name, input.sectionId, await actor(ctx)));
  },

  async addItem(ctx: AdminCtx) {
    const input = readPriceItemInput(ctx.request.body);
    if (input.ok === false) return refuseWith(ctx, 400, input.error);
    await runItemEdit(ctx, { kind: 'add', item: input.item });
  },

  async updateItem(ctx: AdminCtx) {
    const body = (ctx.request.body ?? {}) as Record<string, unknown>;
    const input = readPriceItemInput(body.item);
    const place = placeOf(ctx, body.expectedName);
    if (input.ok === false) return refuseWith(ctx, 400, input.error);
    if (!place) return refuseWith(ctx, 409, PRICE_ERRORS.stale);
    await runItemEdit(ctx, { kind: 'update', ...place, item: input.item });
  },

  async removeItem(ctx: AdminCtx) {
    const place = placeOf(ctx, ctx.query.expectedName);
    if (!place) return refuseWith(ctx, 409, PRICE_ERRORS.stale);
    await runItemEdit(ctx, { kind: 'remove', ...place });
  },

  async saveNotes(ctx: AdminCtx) {
    const notes = readPriceNotes(ctx.request.body);
    if (!notes) return refuseWith(ctx, 400, PRICE_ERRORS.notes);
    respond(ctx, await savePriceNotes(store(), ctx.params.documentId ?? '', notes, await actor(ctx)));
  },
};
