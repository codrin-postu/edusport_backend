export default ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
    // Strapi's own default numbers, set explicitly: without them the session maximum falls back to the
    // 30 d `expiresIn` (6b-1 spike). "Ține-mă minte": 14 d idle, 30 d max; otherwise 2 h idle, 1 d max.
    sessions: {
      accessTokenLifespan: 30 * 60,
      idleRefreshTokenLifespan: 14 * 24 * 3600,
      maxRefreshTokenLifespan: 30 * 24 * 3600,
      idleSessionLifespan: 2 * 3600,
      maxSessionLifespan: 24 * 3600,
    },
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
  // Agent worktrees live in .worktrees/ inside the repo; without this the dev
  // file watcher follows their node_modules symlinks and crashes when one is
  // removed.
  // private/ holds the generated registration PDFs: writing one must not restart the dev server.
  watchIgnoreFiles: ['**/.worktrees/**', '**/.superpowers/**', '**/private/**'],
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
