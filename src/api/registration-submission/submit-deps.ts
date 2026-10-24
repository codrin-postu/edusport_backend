import type { Core } from '@strapi/strapi';
import { findCurrentSeason } from '../../club/current-season';
import { loadSchoolPrices } from '../../club/public-info-loader';
import { isRegistrationOpen, type SubmitDeps } from '../../club/registration-submit';
import type { NumberedRegistration, RegistrationData } from './services/registration-submission';

const FORM = 'inscriere';
const FORM_CONFIG_UID = 'api::form-config.form-config' as const;
const UID = 'api::registration-submission.registration-submission' as const;

type NumberedService = { createNumbered(data: RegistrationData, startYear: number): Promise<NumberedRegistration> };

/** The real Strapi side of submitRegistration. `RegistrationCreateData` is type-checked against the schema here. */
export function buildSubmitDeps(strapi: Core.Strapi): SubmitDeps {
  const config = () => strapi.service(FORM_CONFIG_UID);
  const registrations = () => strapi.service(UID) as NumberedService;
  return {
    effectiveRequired: () => config().effectiveRequired(FORM),
    validateBuiltinSelects: (values) => config().validateBuiltinSelects(FORM, values),
    validateFieldFormats: (values) => config().validateFieldFormats(FORM, values),
    registrationsEnabled: async () =>
      isRegistrationOpen((await strapi.documents('api::site-settings.site-settings').findFirst({}))?.registration),
    findCurrentSeason: () => findCurrentSeason(strapi),
    findSections: () => strapi.documents('api::section.section').findMany({ limit: 100 }),
    findSchoolPrices: (documentId) => loadSchoolPrices(strapi, documentId),
    createNumbered: (data, startYear) => registrations().createNumbered(data, startYear),
    logError: (message) => strapi.log.error(message),
    now: () => new Date(),
  };
}
