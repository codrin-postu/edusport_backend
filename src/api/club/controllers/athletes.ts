import { refuseWith, type AdminCtx } from '../../../club/admin-http';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { readHistory } from '../../../club/athletes/history-read';
import { clubStore } from '../../../club/athletes/http';
import { SUBJECT } from '../../../club/history-text';

/** Admin API of Sportivi (routes/05-athletes.ts, all `global::is-admin`). A deleted athlete is not found (gaps #40). */
export default {
  async history(ctx: AdminCtx) {
    const store = clubStore(strapi);
    const id = ctx.params.documentId ?? '';
    if (!(await store.athlete(id))) return refuseWith(ctx, 404, ADMIN_ERRORS.notFound);
    ctx.body = { data: await readHistory(store, SUBJECT.athlete, id) };
  },
};
