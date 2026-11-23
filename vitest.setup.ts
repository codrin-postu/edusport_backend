// The portal second factor and passkeys are off by default in production (PORTAL_2FA); the suite runs with them on so the built code stays tested.
// Tests of the off switch set `process.env.PORTAL_2FA = 'off'` themselves.
process.env.PORTAL_2FA = 'on';
// Portals are opt-in (PORTAL_HOSTS empty means none); the suite runs with both on and their invite origins set.
// Tests of the off switch clear `process.env.PORTAL_HOSTS` themselves.
process.env.PORTAL_HOSTS = 'antrenor,sportiv';
process.env.PORTAL_ANTRENOR_URL = 'https://antrenor.scoaladepatinaj.com';
process.env.PORTAL_SPORTIV_URL = 'https://sportiv.scoaladepatinaj.com';
