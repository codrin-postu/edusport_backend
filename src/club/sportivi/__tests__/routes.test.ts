import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  OLD_EDITOR_PATH, SPORTIVI_PATH, addAthleteTo, athleteRecordTo, oldEditorProfileId, recordIdFromSplat, registrationPanelTo, wantsAddAthlete,
} from '../routes';

const src = (p: string) => join(__dirname, '..', '..', '..', p);
const read = (p: string) => readFileSync(src(p), 'utf8');

describe('Sportivi addresses (spec 5, 6, 7)', () => {
  it('the record is a full page under the list route; plan 3-4 links to it', () => {
    expect(SPORTIVI_PATH).toBe('/plugins/edusport-sportivi');
    expect(athleteRecordTo('k3j2h1')).toBe('/plugins/edusport-sportivi/k3j2h1');
    expect(athleteRecordTo('a b')).toBe('/plugins/edusport-sportivi/a%20b');
  });

  it('reads the record id from the route splat', () => {
    expect(recordIdFromSplat(undefined)).toBeNull();
    expect(recordIdFromSplat('')).toBeNull();
    expect(recordIdFromSplat('  ')).toBeNull();
    expect(recordIdFromSplat('k3j2h1')).toBe('k3j2h1');
    expect(recordIdFromSplat('k3j2h1/extra')).toBe('k3j2h1');
    expect(recordIdFromSplat('a%20b')).toBe('a b');
    expect(recordIdFromSplat('%E0')).toBeNull();
  });

  it('old editor links carry the public profile id', () => {
    expect(OLD_EDITOR_PATH).toBe('/plugins/edusport-sportiv-edit');
    expect(oldEditorProfileId('?id=sp1')).toBe('sp1');
    expect(oldEditorProfileId('?id=')).toBeNull();
    expect(oldEditorProfileId('')).toBeNull();
  });

  it('"Adaugă sportiv" from the dashboard, and one registration panel', () => {
    expect(addAthleteTo).toBe('/plugins/edusport-sportivi?adauga=1');
    expect(wantsAddAthlete('?adauga=1')).toBe(true);
    expect(wantsAddAthlete('')).toBe(false);
    expect(registrationPanelTo('r1')).toBe('/plugins/edusport-inscrieri?open=r1');
  });
});
