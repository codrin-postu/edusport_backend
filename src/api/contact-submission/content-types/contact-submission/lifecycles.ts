/**
 * Lifecycle hooks for contact-submission.
 *
 * Enforces immutability of every field except `status` once a submission has
 * been recorded. This runs on every write regardless of admin role (Super
 * Admin, Editor, custom Viewer, or direct REST), so it's the canonical place
 * to express "the body of a contact message is permanent; only triage state
 * can change."
 *
 * To allow more fields to be edited later (e.g. an `internalNote` scratchpad),
 * add the attribute name to MUTABLE_FIELDS below.
 *
 * It also mirrors every create/update/delete into the connected Google Sheet
 * (see src/sheets/lifecycle.ts). That part is queued, debounced and fully
 * inert when no sheet is connected, so it can never fail a contact message.
 */
import { sheetsLifecycle } from '../../../../sheets/lifecycle';

const sheets = sheetsLifecycle('contact', 'api::contact-submission.contact-submission');

const MUTABLE_FIELDS = new Set<string>(['triageStatus', 'internalNote']);

// Strapi-managed bookkeeping fields that always appear in update payloads —
// ignore them so we don't false-positive on auto-bumped timestamps.
const SYSTEM_FIELDS = new Set<string>([
  'createdAt',
  'updatedAt',
  'publishedAt',
  'createdBy',
  'updatedBy',
  'locale',
  'documentId',
  'id',
]);

export default {
  async beforeUpdate(event: { params: { data?: Record<string, unknown>; where?: Record<string, unknown> } }) {
    const data = event.params.data ?? {};
    const where = event.params.where ?? {};

    const existing = await strapi.db
      .query('api::contact-submission.contact-submission')
      .findOne({ where });
    if (!existing) return;

    for (const key of Object.keys(data)) {
      if (MUTABLE_FIELDS.has(key)) continue;
      if (SYSTEM_FIELDS.has(key)) continue;

      const newVal = data[key];
      const oldVal = (existing as Record<string, unknown>)[key];
      if (newVal !== oldVal) {
        throw new Error(
          `Câmpul „${key}" nu poate fi modificat după trimiterea mesajului. Doar starea (triageStatus) poate fi actualizată.`,
        );
      }
    }
  },

  // --- Google Sheets mirror (fire-and-forget, never blocks a write) ---
  afterCreate: sheets.afterCreate,
  afterUpdate: sheets.afterUpdate,
  afterDelete: sheets.afterDelete,
  afterUpdateMany: sheets.afterUpdateMany,
};
