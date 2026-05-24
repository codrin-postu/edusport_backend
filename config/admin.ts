export default ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT'),
    },
  },
  secrets: {
    encryptionKey: env('ENCRYPTION_KEY'),
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
  },
  // Per-content-type Preview opens an external URL in the admin's side panel
  // (or new tab via our SaveBar's Previzualizează button). Currently wired
  // up only for Article — the frontend's /noutati/preview/[documentId] route
  // fetches the draft version and renders it with the same _View used in
  // production, so editors can see the article exactly as it would appear.
  preview: {
    enabled: env.bool('STRAPI_PREVIEW_ENABLED', true),
    config: {
      allowedOrigins: env(
        'STRAPI_PREVIEW_FRONTEND_URL',
        'http://localhost:3000',
      ),
      handler: (
        uid: string,
        { documentId, status }: { documentId: string; status: 'draft' | 'published' },
      ) => {
        if (uid !== 'api::article.article') return null;
        const base = env('STRAPI_PREVIEW_FRONTEND_URL', 'http://localhost:3000');
        const secret = env('STRAPI_PREVIEW_SECRET', '');
        const params = new URLSearchParams({ documentId, status });
        if (secret) params.set('secret', secret);
        return `${base}/api/preview?${params.toString()}`;
      },
    },
  },
});
