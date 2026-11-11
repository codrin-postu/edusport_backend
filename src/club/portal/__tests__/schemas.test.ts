import { readFileSync } from 'node:fs';
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

describe('portal-session (5B, spike fallback)', () => {
  it('has the session fields, hidden, with hashes only', () => {
    const s = schema('portal-session');
    expect(s.collectionName).toBe('portal_sessions');
    expect(s.options.draftAndPublish).toBe(false);
    expect(s.pluginOptions['content-manager'].visible).toBe(false);
    expect(s.attributes.account).toMatchObject({ type: 'relation', relation: 'manyToOne', target: 'api::portal-account.portal-account', required: true });
    expect(s.attributes.deviceId).toMatchObject({ type: 'string', required: true });
    expect(s.attributes.refreshHash).toMatchObject({ type: 'string', required: true, unique: true });
    expect(s.attributes.accessHash).toMatchObject({ type: 'string', unique: true });
    expect(s.attributes.familyStartedAt).toMatchObject({ type: 'datetime', required: true });
    expect(s.attributes.lastUsedAt).toMatchObject({ type: 'datetime', required: true });
    for (const k of ['accessExpiresAt', 'revokedAt']) expect(s.attributes[k].type).toBe('datetime');
    expect(Object.keys(s.attributes).some((k) => /token|secret/i.test(k) && !/hash/i.test(k))).toBe(false);
  });
});

describe('portal unique columns (a content-type "unique" alone creates no database index)', () => {
  it.each([['portal-auth-limit', 'key'], ['portal-session', 'refreshHash'], ['portal-session', 'accessHash'], ['portal-account', 'email'], ['portal-account', 'googleSub']])(
    '%s.%s has a database unique index',
    (name, key) => {
      expect(schema(name).attributes[key]).toMatchObject({ unique: true, column: { unique: true } });
    },
  );
});
