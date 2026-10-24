import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');

describe('documents: deploy and repo files', () => {
  it('keeps the PDFs out of git, the image and the dev watcher', () => {
    expect(read('.gitignore')).toMatch(/^private\/$/m);
    expect(read('.dockerignore')).toMatch(/^private$/m);
    expect(read('config/admin.ts')).toContain("'**/private/**'");
  });

  it('mounts a volume for them in production and backs it up nightly', () => {
    expect(read('docker-compose.production.yml')).toContain('- private_documents:/opt/app/private');
    expect(read('Dockerfile.production')).toContain('mkdir -p ./public/uploads ./private/documents && chown -R strapi:strapi ./public ./private');
    expect(read('scripts/backup.sh')).toContain('tar -C /opt/app -czf - private > "$DOCUMENTS_FILE"');
  });
});
