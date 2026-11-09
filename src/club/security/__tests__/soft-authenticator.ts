import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto';

/** A software WebAuthn authenticator for tests: ES256 key, `fmt: 'none'` attestation, hand-built CBOR. Never used outside tests. */

const b64 = (b: Buffer): string => b.toString('base64url');
const sha = (b: Buffer | string): Buffer => createHash('sha256').update(b).digest();

const head = (major: number, n: number): Buffer => {
  if (n < 24) return Buffer.from([(major << 5) | n]);
  if (n < 256) return Buffer.from([(major << 5) | 24, n]);
  return Buffer.from([(major << 5) | 25, n >> 8, n & 255]);
};
const cInt = (n: number): Buffer => (n >= 0 ? head(0, n) : head(1, -1 - n));
const cBytes = (b: Buffer): Buffer => Buffer.concat([head(2, b.length), b]);
const cText = (t: string): Buffer => Buffer.concat([head(3, t.length), Buffer.from(t)]);
const cMap = (pairs: [Buffer, Buffer][]): Buffer => Buffer.concat([head(5, pairs.length), ...pairs.flat()]);

export type Flags = { uv?: boolean; up?: boolean; synced?: boolean };
const flagByte = (f: Flags, attested: boolean): number =>
  (f.up === false ? 0 : 0x01) | (f.uv === false ? 0 : 0x04) | (f.synced ? 0x18 : 0) | (attested ? 0x40 : 0);

const counterBytes = (n: number): Buffer => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
};

export type SoftAuthenticator = {
  credentialId: string;
  userHandle: string | null;
  register(o: { challenge: string; origin: string; rpId: string; userHandle?: string; counter?: number; flags?: Flags }): unknown;
  assert(o: { challenge: string; origin: string; rpId: string; counter: number; flags?: Flags; userHandle?: string | null }): unknown;
};

export function softAuthenticator(): SoftAuthenticator {
  const { privateKey, publicKey }: { privateKey: KeyObject; publicKey: KeyObject } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' });
  const x = Buffer.from(jwk.x as string, 'base64url');
  const y = Buffer.from(jwk.y as string, 'base64url');
  const credId = randomBytes(32);
  const cose = cMap([
    [cInt(1), cInt(2)], [cInt(3), cInt(-7)], [cInt(-1), cInt(1)], [cInt(-2), cBytes(x)], [cInt(-3), cBytes(y)],
  ]);
  const client = (type: string, challenge: string, origin: string): Buffer => Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
  const self: SoftAuthenticator = {
    credentialId: b64(credId),
    userHandle: null,
    register({ challenge, origin, rpId, userHandle, counter = 0, flags = {} }) {
      self.userHandle = userHandle ?? null;
      const authData = Buffer.concat([sha(rpId), Buffer.from([flagByte(flags, true)]), counterBytes(counter), Buffer.alloc(16), Buffer.from([credId.length >> 8, credId.length & 255]), credId, cose]);
      const attestation = cMap([[cText('fmt'), cText('none')], [cText('attStmt'), cMap([])], [cText('authData'), cBytes(authData)]]);
      return {
        id: b64(credId), rawId: b64(credId), type: 'public-key', clientExtensionResults: {}, authenticatorAttachment: 'platform',
        response: { clientDataJSON: b64(client('webauthn.create', challenge, origin)), attestationObject: b64(attestation), transports: ['internal'] },
      };
    },
    assert({ challenge, origin, rpId, counter, flags = {}, userHandle }) {
      const clientData = client('webauthn.get', challenge, origin);
      const authData = Buffer.concat([sha(rpId), Buffer.from([flagByte(flags, false)]), counterBytes(counter)]);
      const signature = sign('sha256', Buffer.concat([authData, sha(clientData)]), privateKey);
      const handle = userHandle === undefined ? self.userHandle : userHandle;
      return {
        id: b64(credId), rawId: b64(credId), type: 'public-key', clientExtensionResults: {}, authenticatorAttachment: 'platform',
        response: { clientDataJSON: b64(clientData), authenticatorData: b64(authData), signature: b64(signature), ...(handle ? { userHandle: handle } : {}) },
      };
    },
  };
  return self;
}
