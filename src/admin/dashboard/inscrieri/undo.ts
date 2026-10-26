import { adminToast } from '../../ui';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { INSCRIERI_PENDING_COPY } from '../../../club/inscrieri-copy';
import { CLUB_URLS } from '../../../club/inscrieri-panel';
import { requestErrorText } from '../../../club/registration-panel';
import type { StableClient } from './useClient';

/**
 * Undo a confirmation (spec 4.6): the toast's "Anulează" and the panel's "Anulează confirmarea". Plain async,
 * no React state, so the toast action still works after the panel is gone. Reports its own result.
 */
export async function runUndo(post: StableClient['post'], registrationId: string): Promise<boolean> {
  try {
    await post(CLUB_URLS.undo(registrationId));
    adminToast.success(INSCRIERI_PENDING_COPY.undone);
    return true;
  } catch (err) {
    adminToast.error(requestErrorText(err, ADMIN_ERRORS.failed));
    return false;
  }
}
