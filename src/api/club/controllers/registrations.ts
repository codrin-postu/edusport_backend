import { refuseWith, type AdminCtx } from '../../../club/admin-http';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { readHistory } from '../../../club/athletes/history-read';
import { clubStore } from '../../../club/athletes/http';
import { SUBJECT } from '../../../club/history-text';

/** Admin API of the Înscrieri confirmation (routes/04-registrations.ts, all `global::is-admin`). */
export default {
  async history(ctx: AdminCtx) {
    const store = clubStore(strapi);
    const id = ctx.params.documentId ?? '';
    const registration = await store.registration(id);
    if (!registration) return refuseWith(ctx, 404, ADMIN_ERRORS.notFound);
    ctx.body = { data: await readHistory(store, SUBJECT.registration, id, registration.submittedAt) };
  },
};
