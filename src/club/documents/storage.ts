import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { kindFromFileName } from './format';
import type { DocumentKind, StoredDocument } from './types';

/**
 * Private documents folder: env PRIVATE_FILES_DIR, default <app>/private/documents.
 * Outside public/, so Strapi never serves it; files open only through the guarded routes.
 */
export function documentsRoot(appRoot: string, env: NodeJS.ProcessEnv = process.env): string {
  const configured = (env.PRIVATE_FILES_DIR ?? '').trim();
  return configured ? path.resolve(configured) : path.join(appRoot, 'private', 'documents');
}

/** Strapi document ids are lowercase letters and digits; anything else never reaches the file system. */
export function isSafeDocumentId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-z0-9]{10,64}$/.test(id);
}

export function registrationDir(root: string, registrationDocumentId: string): string {
  if (!isSafeDocumentId(registrationDocumentId)) throw new Error('Invalid registration id');
  return path.join(root, 'registrations', registrationDocumentId);
}

/** The PDFs stored for one registration (no folder yet: none). */
export async function listStored(dir: string): Promise<StoredDocument[]> {
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const docs: StoredDocument[] = [];
  for (const fileName of names.sort()) {
    const kind = kindFromFileName(fileName);
    if (kind) docs.push({ kind, fileName, path: path.join(dir, fileName) });
  }
  return docs;
}

/** Deletes a registration's folder and its PDFs; nothing to delete is fine (idempotent). */
export async function removeStored(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

export type NewFile = { kind: DocumentKind; fileName: string; data: Buffer };

/** Writes `data` to `target` through a temporary file in the same folder, so a reader never sees half a PDF. */
async function writeAtomically(target: string, data: Buffer): Promise<void> {
  const temp = `${target}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    await fs.writeFile(temp, data, { mode: 0o600 });
    await fs.rename(temp, target);
  } catch (err) {
    await fs.rm(temp, { force: true });
    throw err;
  }
}

/**
 * Stores a registration's new set of PDFs: every new file is written first, then the files that are
 * no longer part of the set (renamed child, membership changed to Nu) are deleted. A failed write
 * leaves the old files in place (DECISIONS 2026-10-05).
 */
export async function replaceStored(dir: string, files: NewFile[]): Promise<StoredDocument[]> {
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  for (const file of files) await writeAtomically(path.join(dir, file.fileName), file.data);
  const keep = new Set(files.map((f) => f.fileName));
  for (const old of await listStored(dir)) {
    if (!keep.has(old.fileName)) await fs.rm(old.path, { force: true });
  }
  return files.map((f) => ({ kind: f.kind, fileName: f.fileName, path: path.join(dir, f.fileName) }));
}
