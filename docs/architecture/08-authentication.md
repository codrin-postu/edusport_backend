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
