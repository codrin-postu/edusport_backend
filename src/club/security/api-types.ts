export type TwoFactorMethod = 'totp' | 'email' | 'backup';
export type SecondStep = { step: '2fa'; methods: TwoFactorMethod[]; last: TwoFactorMethod; email: string };
export type PasskeyRow = { id: string; name: string; createdAt: string; lastUsedAt: string | null; old: boolean };
export type SecurityView = {
  email: string;
  totp: boolean; emailCode: boolean; backupLeft: number; backupNotice: number | null;
  passkeys: PasskeyRow[]; passkeyLimit: 10;
};
export type TotpStart = { qrSvg: string; key: string }; // key: base32 in groups of 4
export type MethodOn = { toast: string; backupCodes: string[] | null }; // codes only when this was the first method
export type BackupBatch = { toast: string; backupCodes: string[] }; // "XXXXX XXXXX"
export type CodeSent = { sentTo: string };
// WebAuthn JSON shapes are @simplewebauthn/server 14.0.3 types, passed through unchanged:
export type PasskeyRegisterOptions = { options: unknown };
export type PasskeyLoginOptions = { options: unknown };
