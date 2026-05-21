const parseOrigin = (raw: string | undefined): string[] | string => {
  if (!raw) {
    return process.env.NODE_ENV === 'production' ? [] : '*';
  }
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length === 0) {
    return process.env.NODE_ENV === 'production' ? [] : '*';
  }
  return list;
};

export default [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  {
    name: 'strapi::cors',
    config: {
      origin: parseOrigin(process.env.FRONTEND_ORIGIN),
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
      headers: [
        'Content-Type',
        'Authorization',
        'Origin',
        'Accept',
        'X-Requested-With',
      ],
      keepHeaderOnError: true,
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
