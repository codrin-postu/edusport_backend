import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Core } from '@strapi/strapi';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { deleteRegistrationDocuments, listRegistrationDocuments } from '../service';
import { registrationDir, replaceStored } from '../storage';

const ID = 'reg0000000000000000000001';
let app: string;
beforeEach(async () => {
  app = await fs.mkdtemp(path.join(os.tmpdir(), 'edusport-app-'));
  vi.stubEnv('PRIVATE_FILES_DIR', '');
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(app, { recursive: true, force: true });
});

/** Only `dirs.app.root` is read by the storage side of the service. */
const fakeStrapi = () => ({ dirs: { app: { root: app } } }) as unknown as Core.Strapi;

it('deleting a registration deletes its stored PDFs, and is idempotent', async () => {
  const dir = registrationDir(path.join(app, 'private', 'documents'), ID);
  await replaceStored(dir, [
    { kind: 'acord', fileName: 'Ana_Pop_Acord_2026-2027.pdf', data: Buffer.from('%PDF a') },
    { kind: 'adeziune', fileName: 'Ana_Pop_Adeziune_2026-2027.pdf', data: Buffer.from('%PDF b') },
  ]);
  expect(await listRegistrationDocuments(fakeStrapi(), ID)).toHaveLength(2);
  await deleteRegistrationDocuments(fakeStrapi(), ID);
  await expect(fs.access(dir)).rejects.toThrow();
  await expect(deleteRegistrationDocuments(fakeStrapi(), ID)).resolves.toBeUndefined();
  await expect(deleteRegistrationDocuments(fakeStrapi(), '../../etc')).resolves.toBeUndefined();
});
