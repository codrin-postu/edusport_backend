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
