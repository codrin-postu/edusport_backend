/**
 * Lifecycle hooks for partner-submission.
 *
 * Mirrors every create/update/delete into the connected Google Sheet. Queued
 * and debounced (see src/sheets/queue.ts); inert when no sheet is connected.
 */
import { sheetsLifecycle } from '../../../../sheets/lifecycle';

export default sheetsLifecycle('parteneri', 'api::partner-submission.partner-submission');
