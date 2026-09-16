/**
 * Lifecycle hooks for registration-submission.
 *
 * Mirrors every create/update/delete into the connected Google Sheet. The work
 * is queued and debounced (see src/sheets/queue.ts) so a bulk season move costs
 * a couple of API calls, and it is fully inert when no sheet is connected — a
 * public submission always succeeds regardless of the Sheets integration.
 */
import { sheetsLifecycle } from '../../../../sheets/lifecycle';

export default sheetsLifecycle('inscrieri', 'api::registration-submission.registration-submission');
