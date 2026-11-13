# 08. Authentication levels

Yardstick: NIST SP 800-63B Revision 4 (final, July 2025), Authenticator Assurance Levels (AAL).
Source: https://pages.nist.gov/800-63-4/sp800-63b.html

## The three levels

| Level | Requires | Re-login at least every | After inactivity |
|---|---|---|---|
| AAL1 | One factor | 30 days | not required |
| AAL2 | Two distinct factors; the service must offer a phishing-resistant option | 24 hours | 1 hour |
| AAL3 | Hardware-bound, non-exportable key, phishing-resistant, two factors | 12 hours | 15 minutes |

## Our login methods

| Method | Factors | Level | Phishing-resistant |
|---|---|---|---|
| E-mail + password | know | AAL1 | no |
| Password + code by e-mail | know (+ e-mail) | AAL1. NIST: "Email SHALL NOT be used for out-of-band authentication" | no |
| Password + authenticator app (TOTP) | know + have | AAL2 | no |
| Passkey, synced (iCloud Keychain, Google Password Manager) | have + are/know (device unlock) | AAL2. Syncable passkeys are not allowed at AAL3 | yes |
| Passkey, device-bound (hardware key) | have + are/know | up to AAL3 | yes |
| Google login | depends on the person's Google account (we cannot see it) | treat as AAL1 | depends on Google |

## Findings

1. E-mail codes do not raise the level above AAL1. Useful as a convenience, not as real two-factor.
2. Passkey or authenticator app reach AAL2. We already offer a phishing-resistant option (passkey), which AAL2 requires.
3. Sessions: AAL1 allows staying logged in up to 30 days. The 1-year session proposed earlier exceeds this.
4. Admin panel (Strapi): password only today, so AAL1, while admins see all athletes' data.
5. Rate limiting: at most 100 consecutive failed attempts per authenticator per account (NIST maximum); we use a much lower limit.

## Decisions (see DECISIONS.md)

- AAL1 accepted for portal users; passkey and authenticator app offered (AAL2), optional.
- Session: sliding 7 days (each visit restarts the 7 days). Hard maximum 30 days, then login again (NIST AAL1).
- Admin panel: e-mail + password or Google (built by us; Strapi SSO is paid), then optional two-factor (app, e-mail code, passkey). Google login skips two-factor.
- Portal: e-mail + password or Google; optional two-factor (app, e-mail code); passkey replaces password and code.

## Passkey domain move runbook (spec 8.6)

Passkeys are bound to the rpId (`WEBAUTHN_RP_ID`). Today it is `codrin.space`; after the move to `scoaladepatinaj.com` every key made before it stops working. Nobody depends on a key alone: every admin and coach has a password or Google.

1. Before the switch, check that at least two Super Admins can sign in with a password or Google (not a passkey).
2. In the same deploy step that moves `cms.` and `antrenor.`, set `WEBAUTHN_RP_ID=scoaladepatinaj.com` and `WEBAUTHN_ORIGINS` to the new hosts, and set `WEBAUTHN_MOVED_AT` to the day of the switch (ISO date, for example `2027-01-10`).
3. Run `npm run passkeys:cutover -- --dry-run` in the `backend` service. It prints the keys per rpId and how many people would see the offer again. Then run `npm run passkeys:cutover`: it clears `passkeyOfferedAt` for everyone whose keys are all on the old rpId, so the "Creează o cheie de acces" offer shows once more. It deletes nothing.
4. Old keys are never offered by the browser on the new hosts. Securitate lists them as "Cheie veche, nu mai merge. Creează una nouă." with "Șterge". The daily purge deletes them 30 days after `WEBAUTHN_MOVED_AT`; the keys of the new rpId are never touched.
5. People sign in on the new host with password (and 2FA) or Google, then create a new key from the offer or from Securitate. The authenticator app and the backup codes are not bound to a domain and keep working. Device cookies belong to a host, so the first sign-in on a new host asks for 2FA once and sends the new-device e-mail. Tell the club in the cutover note.

## Hosts (phase 7-1)

The portal has two hosts, `antrenor.` and `sportiv.` (`PORTAL_HOSTS`). Every sign-in path (password, second step, Google, passkey, reset, invite accept, refresh) carries the host and checks it: `antrenor` needs a team member that is not coach-disabled, `sportiv` needs a live athlete access. The session, the device and an invite token belong to one host; a coach token on a sportiv route (and the reverse) is refused. One account can hold both roles. `WEBAUTHN_ORIGINS` must list both hosts (for example `https://antrenor.scoaladepatinaj.com,https://sportiv.scoaladepatinaj.com`), and device cookies are per host, so the first sign-in on the other host asks for 2FA once.

### Portal 2FA switch (2026-11-11)

`PORTAL_2FA=on|off` (default off). Off: the coach and student portals sign in with e-mail + password or Google only. The portal 2FA enrol and use routes, backup codes and passkey routes answer 404, and stored factors are ignored at sign-in (a session is issued after the usual host check). The code stays for later; admin-auth 2FA is not affected.

## Admin roles (phase 6b-3)

Three admin roles come from one map, `src/club/roles/map.ts`. The two EduSport roles are created at boot by `src/club/roles/bootstrap.ts`; Super Admin is Strapi's own role.

| Role | Code | Areas |
|---|---|---|
| Super Admin | `strapi-super-admin` | all areas |
| Administrator club | `edusport-club-admin` | all areas except `superAdmin` |
| Editor site | `edusport-site-editor` | `any`, `website` |

Areas: `any` (every signed-in admin has it), `club`, `money`, `settings`, `website`, `coachAccounts`, `superAdmin`. The admin is allowed what any of their roles grants.

Boot and permissions:

- A role with zero permissions gets the default matrix again at the next boot. A role that has permissions is never changed by boot, so edits made in the admin are kept.
- The content types hidden from the Content Manager (`announcement`, `club-figures`, `navigation`) are read-only for the roles: they get `explorer.read` only, and are edited on their own admin pages.

Checks:

- Every admin route has exactly one area. `adminRoute(area)` in `src/club/admin-area.ts` emits `global::has-role` with `{ area }`. A source test fails when a route has no known area.
- `global::has-role` answers 401 when there is no session, or the admin is inactive or blocked. It answers 403 when none of the admin's roles grants the area. On a pass it puts the admin's areas in `policyContext.state.adminAreas`.
- The admin UI hides the menu entries and pages outside the admin's areas (`useAreas`, `AreaGate`). A direct URL shows "Nu ai acces la această pagină." Contabilitate hides "Pe scurt" and "Pe grupe" without `money`. Tabele is `money`.

`HAS_ROLE_ENFORCED` (see `.env.example`):

- `true`: refusals are answered (401 or 403).
- `false`: nothing is refused. Each refusal is only logged as `[has-role] would refuse <area> for <id>`.
- Unset: enforced outside production; in production (`NODE_ENV=production`) it behaves as `false`.

Deploy order:

1. Set `HAS_ROLE_ENFORCED=true` in the VM's `.env.production`. The deploy env must set it; do not rely on the unset default.
2. Restart the backend so the variable is read.
3. To check the rules before enforcement, deploy with `HAS_ROLE_ENFORCED=false` first and read the `[has-role] would refuse` lines in the server log for the real admins. Then set `true` and restart.

Portal sign-in: the coach and student portals sign in with e-mail and password or Google only (portal 2FA and passkeys are off, see `PORTAL_2FA` above). Admin 2FA stays.

Coach Școala rights: a coach whose portal e-mail matches an active, non-blocked admin with the `club` area edits his own Școala groups the same way as his Club groups. There is no switch (user decision, 2026-11-13).
