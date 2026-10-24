import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('ships the header image at twice the size the e-mail shows (176x32)', () => {
  const png = readFileSync(join(__dirname, '..', '..', '..', 'public', 'email', 'edusport-header.png'));
  expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([352, 64]);
});
