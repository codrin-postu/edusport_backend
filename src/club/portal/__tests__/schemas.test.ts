import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type Attr = Record<string, unknown>;
type Schema = {
  collectionName: string;
  options: { draftAndPublish: boolean };
  pluginOptions: { 'content-manager': { visible: boolean } };
  attributes: Record<string, Attr>;
};

const API = join(__dirname, '../../../api');
const schema = (name: string): Schema =>
  JSON.parse(readFileSync(join(API, name, 'content-types', name, 'schema.json'), 'utf8')) as Schema;

const PORTAL_TYPES = ['portal-account', 'portal-token', 'portal-auth-limit', 'portal-device'];

describe('portal content types', () => {
  it('portal-account has the spec 3.2 fields', () => {
    const a = schema('portal-account');
    expect(a.collectionName).toBe('portal_accounts');
    expect(a.options.draftAndPublish).toBe(false);
    expect(a.pluginOptions['content-manager'].visible).toBe(false);
    expect(a.attributes.user).toMatchObject({ type: 'relation', relation: 'oneToOne', target: 'plugin::users-permissions.user' });
    expect(a.attributes.email).toMatchObject({ type: 'string', required: true, unique: true });
    expect(a.attributes.status).toMatchObject({ type: 'enumeration', enum: ['invited', 'active', 'disabled'], required: true });
    expect(a.attributes.teamMember).toMatchObject({ type: 'relation', relation: 'oneToOne', target: 'api::team-member.team-member' });
    expect(a.attributes.teamMember.inversedBy).toBeUndefined();
    expect(a.attributes.googleSub).toMatchObject({ type: 'string', unique: true });
    for (const k of ['invitedAt', 'activatedAt', 'disabledAt', 'lastLoginAt']) expect(a.attributes[k].type).toBe('datetime');
    for (const k of ['phone', 'invitedBy', 'disabledBy']) expect(a.attributes[k].type).toBe('string');
    expect(a.attributes.role).toBeUndefined();
  });

  it('portal-token has the spec 3.3 fields', () => {
    const t = schema('portal-token');
    expect(t.collectionName).toBe('portal_tokens');
    expect(t.attributes.account).toMatchObject({ type: 'relation', relation: 'manyToOne', target: 'api::portal-account.portal-account', required: true });
    expect(t.attributes.kind).toMatchObject({ type: 'enumeration', enum: ['invite', 'reset'], required: true });
    expect(t.attributes.secretHash).toMatchObject({ type: 'string', required: true });
    expect(t.attributes.expiresAt).toMatchObject({ type: 'datetime', required: true });
    expect(t.attributes.usedAt.type).toBe('datetime');
    expect(t.attributes.tries).toMatchObject({ type: 'integer', default: 0 });
  });

  it('portal-auth-limit has the spec 3.4 fields', () => {
    const l = schema('portal-auth-limit');
    expect(l.collectionName).toBe('portal_auth_limits');
    expect(l.attributes.key).toMatchObject({ type: 'string', required: true, unique: true });
    expect(l.attributes.count).toMatchObject({ type: 'integer', default: 0 });
    expect(l.attributes.windowStart).toMatchObject({ type: 'datetime', required: true });
    expect(l.attributes.lockedUntil.type).toBe('datetime');
    expect(l.attributes.notifiedAt.type).toBe('datetime');
  });

  it('portal-device has the spec 3.5 fields', () => {
    const d = schema('portal-device');
    expect(d.collectionName).toBe('portal_devices');
    expect(d.attributes.account).toMatchObject({ type: 'relation', relation: 'manyToOne', target: 'api::portal-account.portal-account', required: true });
    expect(d.attributes.deviceKeyHash).toMatchObject({ type: 'string', required: true });
    expect(d.attributes.sessionId).toMatchObject({ type: 'string' });
    expect(d.attributes.label).toMatchObject({ type: 'string', required: true });
    expect(d.attributes.firstSeenAt.type).toBe('datetime');
    expect(d.attributes.lastSeenAt).toMatchObject({ type: 'datetime', required: true });
    expect(d.attributes.revokedAt.type).toBe('datetime');
  });

  it('every portal type is hidden from the Content Manager, not draft-and-publish, and has no routes or controllers', () => {
    for (const name of PORTAL_TYPES) {
      const s = schema(name);
      expect(s.options.draftAndPublish).toBe(false);
      expect(s.pluginOptions['content-manager'].visible).toBe(false);
      expect(existsSync(join(API, name, 'routes'))).toBe(false);
      expect(existsSync(join(API, name, 'controllers'))).toBe(false);
      expect(existsSync(join(API, name, 'services', `${name}.ts`))).toBe(true);
    }
  });

  it('team-member schema gains nothing', () => {
    expect(Object.keys(schema('team-member').attributes)).toEqual(['name', 'role', 'bio', 'photo', 'groups', 'order']);
  });
});
