import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { documentsRoot, isSafeDocumentId, listStored, registrationDir, removeStored, replaceStored } from '../storage';

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'edusport-docs-'));
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

const ID = 'reg0000000000000000000001';
const pdf = (text: string) => Buffer.from(`%PDF-1.7 ${text}`);

describe('private document storage', () => {
  it('lives in PRIVATE_FILES_DIR, or <app>/private/documents by default', () => {
    expect(documentsRoot('/opt/app', {})).toBe('/opt/app/private/documents');
    expect(documentsRoot('/opt/app', { PRIVATE_FILES_DIR: '/data/docs' })).toBe('/data/docs');
  });

  it('never builds a path from an unsafe id', () => {
    expect(isSafeDocumentId(ID)).toBe(true);
    for (const bad of ['../../etc', 'abc', 'REG0000000000000000000001', '', null]) expect(isSafeDocumentId(bad)).toBe(false);
    expect(() => registrationDir(root, '../x/../../y')).toThrow('Invalid registration id');
  });

  it('lists nothing for a registration without documents', async () => {
    await expect(listStored(registrationDir(root, ID))).resolves.toEqual([]);
  });

  it('replaces the set: same name overwritten, files no longer in the set deleted', async () => {
    const dir = registrationDir(root, ID);
    await replaceStored(dir, [
      { kind: 'acord', fileName: 'Ana_Pop_Acord_2026-2027.pdf', data: pdf('old acord') },
      { kind: 'adeziune', fileName: 'Ana_Pop_Adeziune_2026-2027.pdf', data: pdf('old cerere') },
    ]);
    const stored = await replaceStored(dir, [{ kind: 'acord', fileName: 'Ana_Pop_Acord_2026-2027.pdf', data: pdf('new acord') }]);
    expect(stored).toEqual([{ kind: 'acord', fileName: 'Ana_Pop_Acord_2026-2027.pdf', path: path.join(dir, 'Ana_Pop_Acord_2026-2027.pdf') }]);
    expect(await fs.readdir(dir)).toEqual(['Ana_Pop_Acord_2026-2027.pdf']);
    expect(await fs.readFile(stored[0].path, 'utf8')).toBe('%PDF-1.7 new acord');
  });

  it('a renamed child gets the new file and loses the old one', async () => {
    const dir = registrationDir(root, ID);
    await replaceStored(dir, [{ kind: 'acord', fileName: 'Ana_Pop_Acord_2026-2027.pdf', data: pdf('a') }]);
    await replaceStored(dir, [{ kind: 'acord', fileName: 'Ana_Popescu_Acord_2026-2027.pdf', data: pdf('b') }]);
    expect((await listStored(dir)).map((d) => d.fileName)).toEqual(['Ana_Popescu_Acord_2026-2027.pdf']);
  });

  it('keeps the old files when a new one cannot be written', async () => {
    const dir = registrationDir(root, ID);
    await replaceStored(dir, [{ kind: 'acord', fileName: 'Ana_Pop_Acord_2026-2027.pdf', data: pdf('old') }]);
    await fs.mkdir(path.join(dir, 'Ana_Pop_Adeziune_2026-2027.pdf')); // a folder in the way: the rename fails
    await expect(
      replaceStored(dir, [
        { kind: 'adeziune', fileName: 'Ana_Pop_Adeziune_2026-2027.pdf', data: pdf('new') },
        { kind: 'acord', fileName: 'Ana_Popescu_Acord_2026-2027.pdf', data: pdf('new') },
      ]),
    ).rejects.toThrow();
    expect(await fs.readFile(path.join(dir, 'Ana_Pop_Acord_2026-2027.pdf'), 'utf8')).toBe('%PDF-1.7 old');
    expect((await fs.readdir(dir)).filter((n) => n.endsWith('.tmp'))).toEqual([]);
  });

  it('removes a registration folder, and does nothing when it is already gone', async () => {
    const dir = registrationDir(root, ID);
    await replaceStored(dir, [{ kind: 'acord', fileName: 'Ana_Pop_Acord_2026-2027.pdf', data: pdf('a') }]);
    await removeStored(dir);
    await expect(fs.access(dir)).rejects.toThrow();
    await expect(removeStored(dir)).resolves.toBeUndefined();
  });
});
