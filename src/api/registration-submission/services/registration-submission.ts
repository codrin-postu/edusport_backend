import { factories } from '@strapi/strapi';
import type { Modules } from '@strapi/strapi';
import { allocateRegistrationNumber } from '../../../club/number-allocator';

const UID = 'api::registration-submission.registration-submission' as const;

/** Data for a new registration, without its number: the service assigns it. */
export type RegistrationData = Modules.Documents.Params.Data.Input<typeof UID>;
export type NumberedRegistration = { documentId: string; registrationNumber: string };

export default factories.createCoreService(UID, ({ strapi }) => ({
  /**
   * Create a registration under the next free number for the season start year.
   * `registrationNumber` has a database unique index; on a clash the next number is tried.
   */
  async createNumbered(data: RegistrationData, startYear: number): Promise<NumberedRegistration> {
    const { registrationNumber, result } = await allocateRegistrationNumber(startYear, {
      readNumbers: async (year) => {
        const rows: { registrationNumber?: string | null }[] = await strapi.db.query(UID).findMany({
          select: ['registrationNumber'],
          where: { registrationNumber: { $startsWith: `${year}-` } },
        });
        return rows.map((r) => r.registrationNumber ?? null);
      },
      create: (registrationNumber) => strapi.documents(UID).create({ data: { ...data, registrationNumber } }),
    });
    return { documentId: result.documentId, registrationNumber };
  },
}));
