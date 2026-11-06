export default ({ env }) => ({
  'users-permissions': {
    config: {
      jwtSecret: env('JWT_SECRET'),
      jwtManagement: 'refresh',
      sessions: { accessTokenLifespan: 600, idleRefreshTokenLifespan: 7 * 24 * 3600, maxRefreshTokenLifespan: 30 * 24 * 3600 },
    },
  },
});
