/**
 * Admin-guarded publish for a sportsperson, used by the custom Sportiv editor.
 * Auth disabled but gated by `global::has-role`, so only a logged-in CMS admin
 * (whose Bearer token the admin fetch client attaches) can publish.
 */
import { adminRoute } from '../../../club/admin-area';

const website = adminRoute('website');

export default {
  routes: [
    {
      method: 'POST',
      path: '/sportspeople/:documentId/publish',
      handler: 'sportsperson.publishOne',
      config: website,
    },
  ],
};
