import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUBJECT } from '../../subjects';

type Attr = Record<string, unknown>;
type Schema = {
  collectionName: string;
  options: { draftAndPublish: boolean };
  pluginOptions: Record<string, { visible: boolean }>;
  attributes: Record<string, Attr>;
};

const API = join(__dirname, '../../../api');
const schema = (name: string): Schema =>
  JSON.parse(readFileSync(join(API, name, 'content-types', name, 'schema.json'), 'utf8')) as Schema;

const NEW_TYPES = ['auth-factor', 'auth-backup-code', 'auth-challenge', 'auth-passkey', 'admin-account', 'admin-device'];
const subject = (s: Schema) => {
  expect(s.attributes.subjectType).toMatchObject({ type: 'enumeration', enum: ['portal', 'admin'], required: true });
  expect(s.attributes.subjectId).toMatchObject({ type: 'string', required: true });
};

describe('security content types', () => {
  it('auth-factor', () => {
    const s = schema('auth-factor');
    expect(s.collectionName).toBe('auth_factors');
    subject(s);
    expect(s.attributes.kind).toMatchObject({ type: 'enumeration', enum: ['totp', 'email'], required: true });
    expect(s.attributes.secretBox.type).toBe('text');
    expect(s.attributes.lastStep.type).toBe('biginteger');
    for (const k of ['confirmedAt', 'lastUsedAt']) expect(s.attributes[k].type).toBe('datetime');
  });

  it('auth-backup-code', () => {
    const s = schema('auth-backup-code');
    expect(s.collectionName).toBe('auth_backup_codes');
    subject(s);
    for (const k of ['batch', 'codeMac', 'keyId']) expect(s.attributes[k]).toMatchObject({ type: 'string', required: true });
    expect(s.attributes.usedAt.type).toBe('datetime');
  });

  it('auth-challenge', () => {
    const s = schema('auth-challenge');
    expect(s.collectionName).toBe('auth_challenges');
    expect(s.attributes.purpose).toMatchObject({
      type: 'enumeration',
      enum: ['pending-login', 'email-code', 'reset-code', 'passkey-register', 'passkey-login'],
      required: true,
    });
    expect(s.attributes.subjectType).toMatchObject({ type: 'enumeration', enum: ['portal', 'admin'] });
    expect(s.attributes.subjectType.required).toBeUndefined();
    expect(s.attributes.subjectId.type).toBe('string');
    expect(s.attributes.subjectId.required).toBeUndefined();
    expect(s.attributes.secretMac).toMatchObject({ type: 'string', required: true, unique: true, column: { unique: true } });
    expect(s.attributes.data.type).toBe('json');
    expect(s.attributes.expiresAt).toMatchObject({ type: 'datetime', required: true });
    expect(s.attributes.usedAt.type).toBe('datetime');
    expect(s.attributes.tries).toMatchObject({ type: 'integer', default: 0 });
  });

  it('auth-passkey', () => {
    const s = schema('auth-passkey');
    expect(s.collectionName).toBe('auth_passkeys');
    subject(s);
    expect(s.attributes.credentialId).toMatchObject({ type: 'string', required: true, unique: true, column: { unique: true } });
    expect(s.attributes.publicKey).toMatchObject({ type: 'text', required: true });
    expect(s.attributes.counter).toMatchObject({ type: 'biginteger', default: 0 });
    expect(s.attributes.transports.type).toBe('json');
    expect(s.attributes.deviceType).toMatchObject({ type: 'enumeration', enum: ['singleDevice', 'multiDevice'] });
    expect(s.attributes.backedUp.type).toBe('boolean');
    expect(s.attributes.rpId).toMatchObject({ type: 'string', required: true });
    expect(s.attributes.name).toMatchObject({ type: 'string', maxLength: 60, required: true });
    expect(s.attributes.lastUsedAt.type).toBe('datetime');
  });

  it('admin-account', () => {
    const s = schema('admin-account');
    expect(s.collectionName).toBe('admin_accounts');
    expect(s.attributes.adminUserId).toMatchObject({ type: 'integer', required: true, unique: true, column: { unique: true } });
    expect(s.attributes.googleSub).toMatchObject({ type: 'string', unique: true, column: { unique: true } });
    expect(s.attributes.googleSub.required).toBeUndefined();
    expect(s.attributes.googleUnlinkedAt.type).toBe('datetime');
    expect(s.attributes.webauthnUserId).toMatchObject({ type: 'string', required: true, unique: true, column: { unique: true } });
    expect(s.attributes.lastMethod).toMatchObject({ type: 'enumeration', enum: ['totp', 'email', 'backup'] });
    expect(s.attributes.passkeyOfferedAt.type).toBe('datetime');
    expect(s.attributes.securityNotes.type).toBe('json');
  });

  it('admin-device', () => {
    const s = schema('admin-device');
    expect(s.collectionName).toBe('admin_devices');
    expect(s.attributes.adminUserId).toMatchObject({ type: 'integer', required: true });
    expect(s.attributes.deviceKeyHash).toMatchObject({ type: 'string', required: true });
    expect(s.attributes.strapiDeviceId).toMatchObject({ type: 'string', required: true, unique: true, column: { unique: true } });
    expect(s.attributes.label).toMatchObject({ type: 'string', required: true });
    for (const k of ['firstSeenAt', 'lastSeenAt']) expect(s.attributes[k]).toMatchObject({ type: 'datetime', required: true });
    for (const k of ['twoFactorUntil', 'revokedAt']) expect(s.attributes[k].type).toBe('datetime');
  });

  it('every new type is hidden, not draft-and-publish, with a service and no routes or controllers', () => {
    for (const name of NEW_TYPES) {
      const s = schema(name);
      expect(s.options.draftAndPublish).toBe(false);
      expect(s.pluginOptions['content-manager'].visible).toBe(false);
      expect(s.pluginOptions['content-type-builder'].visible).toBe(false);
      expect(existsSync(join(API, name, 'routes'))).toBe(false);
      expect(existsSync(join(API, name, 'controllers'))).toBe(false);
      expect(readFileSync(join(API, name, 'services', `${name}.ts`), 'utf8')).toContain(`createCoreService('api::${name}.${name}')`);
    }
  });

  it('portal-account and portal-device gain the 6b fields', () => {
    const a = schema('portal-account').attributes;
    expect(a.webauthnUserId).toMatchObject({ type: 'string', unique: true, column: { unique: true } });
    expect(a.lastMethod).toMatchObject({ type: 'enumeration', enum: ['totp', 'email', 'backup'] });
    expect(a.passkeyOfferedAt.type).toBe('datetime');
    expect(a.securityNotes.type).toBe('json');
    expect(schema('portal-device').attributes.twoFactorUntil.type).toBe('datetime');
  });

  it('SUBJECT.adminUser', () => {
    expect(SUBJECT.adminUser).toBe('admin-user');
  });

  it('auth_factors has a unique index on subject and kind, created at bootstrap', () => {
    const index = readFileSync(join(__dirname, '../../../index.ts'), 'utf8');
    expect(index).toContain('ensureSecurityIndexesAtBoot(strapi.db.connection, process.env');
    const source = readFileSync(join(__dirname, '../indexes.ts'), 'utf8');
    expect(source).toContain('auth_factors_subject_kind_uq');
    expect(source).toMatch(/create unique index if not exists[^\n]*"subject_type", "subject_id", "kind"/);
  });
});
