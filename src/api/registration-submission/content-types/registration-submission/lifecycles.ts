/**
 * Lifecycle hooks for registration-submission.
 *
 * afterCreate: append the new submission to the configured Google Sheet. This
 * is best-effort and fully inert when Sheets env vars are unset — it never
 * throws and never blocks the create, so a public submission always succeeds
 * regardless of whether the Sheet integration is configured or reachable.
 */
import { appendOne } from '../../services/sheets';
import type { SubmissionLike } from '../../services/sheets';

export default {
  async afterCreate(event: { result?: SubmissionLike }) {
    const result = event.result;
    if (!result) return;
    try {
      await appendOne(result);
    } catch {
      /* never let Sheets export affect the write */
    }
  },
};
