import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

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

  it('auth_factors has a unique index on subject and kind, created at bootstrap', () => {
    const index = readFileSync(join(__dirname, '../../../index.ts'), 'utf8');
    expect(index).toContain('ensureSecurityIndexesAtBoot(strapi.db.connection, process.env');
    const source = readFileSync(join(__dirname, '../indexes.ts'), 'utf8');
    expect(source).toContain('auth_factors_subject_kind_uq');
    expect(source).toMatch(/create unique index if not exists[^\n]*"subject_type", "subject_id", "kind"/);
  });
});
