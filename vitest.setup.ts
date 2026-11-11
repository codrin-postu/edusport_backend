// The portal second factor and passkeys are off by default in production (PORTAL_2FA); the suite runs with them on so the built code stays tested.
// Tests of the off switch set `process.env.PORTAL_2FA = 'off'` themselves.
process.env.PORTAL_2FA = 'on';
