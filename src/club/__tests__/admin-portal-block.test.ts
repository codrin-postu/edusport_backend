import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { ACCOUNT_BLOCK } from '../portal/copy-admin';

const source = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');
const block = source('admin/dashboard/portal/AccountBlock.tsx');

it('AccountBlock imports only the allowed modules', () => {
  const froms = [...block.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  const allowed = ['react', '@strapi/admin/strapi-admin', '../../ui', '../../ConfirmDialog', './api', '../../../club/portal/accounts/api-types', '../../../club/portal/copy-admin'];
  for (const f of froms) expect(allowed, f).toContain(f);
});

it('has no round, dashed or dotted shapes', () => {
  for (const bad of ['border-radius: 50%', 'border-radius:50%', '9999px', 'dashed', 'dotted']) expect(block).not.toContain(bad);
  expect(source('admin/dashboard/portal/api.ts')).not.toMatch(/dashed|dotted/);
});

it('uses every ACCOUNT_BLOCK key', () => {
  for (const key of Object.keys(ACCOUNT_BLOCK)) expect(block, key).toContain(`ACCOUNT_BLOCK.${key}`);
});

it('the disable confirmation text is a marked placeholder, not invented copy', () => {
  expect(source('club/portal/copy-admin.ts')).toMatch(/COPY NEEDED/);
  expect(block).toContain('ACCOUNT_DISABLE_CONFIRM_TEXT');
});

it('the member editor and the group page render the block', () => {
  expect(source('admin/dashboard/MembriEchipaPage.tsx')).toContain('<AccountBlock');
  expect(source('admin/dashboard/grupe/GroupPage.tsx')).toContain('<AccountBlock');
});
