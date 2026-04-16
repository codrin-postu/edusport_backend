import type { StrapiApp } from '@strapi/strapi/admin';
import componentPreview from '../plugins/component-preview/admin/src';

export default {
  register(app: StrapiApp) {
    componentPreview.register(app);
  },
  bootstrap() {},
};
