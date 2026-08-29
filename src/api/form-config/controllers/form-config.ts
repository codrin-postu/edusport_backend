/**
 * form-config controller — three endpoints over the editable form overlay:
 *   GET  /api/forms/:type/config        (public, auth:false)  effective render model
 *   GET  /api/forms/:type/config/edit   (admin)               editor model + locks
 *   PUT  /api/forms/:type/config        (admin)               validate + save overlay
 *
 * All real work (registry merge + overlay validation) lives in the service.
 */

import { factories } from '@strapi/strapi';
import { isFormType, FORM_TYPES } from '../registry';
import { OverlayValidationError } from '../services/form-config';

const UID = 'api::form-config.form-config' as const;

function svc(strapi: any) {
  return strapi.service(UID);
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  /** GET /api/forms/:type/config — public merged model (hidden questions omitted). */
  async publicConfig(ctx) {
    const type = String(ctx.params.type ?? '');
    if (!isFormType(type)) {
      ctx.status = 404;
      ctx.body = { ok: false, error: `Formular necunoscut. Valori acceptate: ${FORM_TYPES.join(', ')}.` };
      return;
    }
    ctx.body = await svc(strapi).publicConfig(type);
  },

  /** GET /api/forms/:type/config/edit — admin editor model. */
  async editConfig(ctx) {
    const type = String(ctx.params.type ?? '');
    if (!isFormType(type)) {
      return ctx.notFound(`Formular necunoscut. Valori acceptate: ${FORM_TYPES.join(', ')}.`);
    }
    ctx.body = await svc(strapi).editConfig(type);
  },

  /** PUT /api/forms/:type/config — validate + persist the overlay. */
  async saveConfig(ctx) {
    const type = String(ctx.params.type ?? '');
    if (!isFormType(type)) {
      return ctx.notFound(`Formular necunoscut. Valori acceptate: ${FORM_TYPES.join(', ')}.`);
    }
    const payload = (ctx.request.body as any)?.data ?? ctx.request.body ?? {};
    try {
      const model = await svc(strapi).saveConfig(type, payload);
      ctx.body = model;
    } catch (err) {
      if (err instanceof OverlayValidationError) {
        return ctx.badRequest(err.message);
      }
      strapi.log.error(`[form-config] save failed: ${(err as Error)?.message ?? err}`);
      return ctx.badRequest('Nu am putut salva configurația formularului.');
    }
  },
}));
