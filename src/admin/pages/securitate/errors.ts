import { PORTAL_ERRORS } from '../../../club/portal/copy';
import { requestErrorText } from '../../../club/registration-panel';

/** The refusal text the server sent (exact Romanian), or the shared "nothing was saved" text. */
export const errorText = (err: unknown): string => requestErrorText(err, PORTAL_ERRORS.failed);
