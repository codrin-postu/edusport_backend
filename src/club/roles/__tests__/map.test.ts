import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADMIN_AREAS, type AdminArea } from '../../admin-area';
import { CLUB_ADMIN_UIDS, CM_ACTIONS, HIDDEN_FROM_CM_UIDS, MEDIA_ACTIONS, ROLE_CODES, WEBSITE_UIDS, areasFor, canUse, nativePermissions, roleCodesOf } from '../map';

// Spec 9.2 table: Super Admin, Administrator club, Editor site.
const TABLE: Record<AdminArea, [boolean, boolean, boolean]> = {
  any: [true, true, true],
  website: [true, true, true],
  club: [true, true, false],
  money: [true, true, false],
  coachAccounts: [true, true, false],
  settings: [true, true, false],
  superAdmin: [true, false, false],
};

describe.each(ADMIN_AREAS)('area %s', (area) => {
  const [superAdmin, clubAdmin, siteEditor] = TABLE[area];
  it('follows the spec 9.2 table', () => {
    expect(canUse([ROLE_CODES.superAdmin], area)).toBe(superAdmin);
    expect(canUse([ROLE_CODES.clubAdmin], area)).toBe(clubAdmin);
    expect(canUse([ROLE_CODES.siteEditor], area)).toBe(siteEditor);
  });
});

describe('areasFor', () => {
  it('unions the areas of several roles', () => {
    const areas = areasFor(['edusport-site-editor', 'edusport-club-admin']);
    expect(areas.has('club')).toBe(true);
    expect(areas.has('website')).toBe(true);
    expect(areas.has('superAdmin')).toBe(false);
  });
  it('gives only any for unknown codes or none', () => {
    expect(areasFor(['strapi-editor'])).toEqual(new Set(['any']));
    expect(areasFor([])).toEqual(new Set(['any']));
  });
});

describe('roleCodesOf', () => {
  it('reads roles[].code', () => {
    expect(roleCodesOf({ roles: [{ code: 'a' }, { code: 'b' }] })).toEqual(['a', 'b']);
  });
  it('is empty for anything else', () => {
    expect(roleCodesOf(null)).toEqual([]);
    expect(roleCodesOf({ roles: 'x' })).toEqual([]);
    expect(roleCodesOf({ roles: [{ code: 1 }, null] })).toEqual([]);
  });
});

describe('nativePermissions', () => {
  const cm = (uids: readonly string[]) => uids.flatMap((subject) =>
      CM_ACTIONS.filter((action) => action.endsWith('.read') || !HIDDEN_FROM_CM_UIDS.includes(subject)).map((action) => ({ action, subject })),
    );
  const media = MEDIA_ACTIONS.map((action) => ({ action, subject: null }));

  it('pins the action ids as literals', () => {
    expect(CM_ACTIONS).toEqual([
      'plugin::content-manager.explorer.create',
      'plugin::content-manager.explorer.read',
      'plugin::content-manager.explorer.update',
      'plugin::content-manager.explorer.delete',
      'plugin::content-manager.explorer.publish',
    ]);
    expect(MEDIA_ACTIONS).toEqual([
      'plugin::upload.read',
      'plugin::upload.assets.create',
      'plugin::upload.assets.update',
      'plugin::upload.assets.download',
      'plugin::upload.assets.copy-link',
    ]);
    expect(CLUB_ADMIN_UIDS).toEqual(['api::site-settings.site-settings', 'api::contact-submission.contact-submission']);
    expect(WEBSITE_UIDS).toHaveLength(22);
    expect(WEBSITE_UIDS).toContain('api::navigation.navigation');
    expect(WEBSITE_UIDS).not.toContain('api::site-settings.site-settings');
  });
  it('gives the site editor the website UIDs and the media library only', () => {
    const list = nativePermissions('edusport-site-editor');
    expect(list).toEqual([...cm(WEBSITE_UIDS), ...media]);
    expect(list.some((p) => p.subject !== null && CLUB_ADMIN_UIDS.includes(p.subject))).toBe(false);
  });
  it('gives the club admin the same plus the club admin UIDs', () => {
    expect(nativePermissions('edusport-club-admin')).toEqual([...cm(WEBSITE_UIDS), ...cm(CLUB_ADMIN_UIDS), ...media]);
  });
});

describe('map.ts source', () => {
  it('has exactly one import, from ../admin-area', () => {
    const source = readFileSync(join(__dirname, '../map.ts'), 'utf8');
    const imports = source.match(/^import .*$/gm) ?? [];
    expect(imports).toHaveLength(1);
    expect(imports[0]).toContain("from '../admin-area'");
  });
});

// Root cause of the real-boot failure: Strapi 5.52.1 registers a content type hidden from the Content Manager
// (`pluginOptions.content-manager.visible: false`) as a subject of `explorer.read` only, so create/update/delete/publish on it
// make `validatePermissionsExist` throw and the whole grant is refused. The fakes in the other tests cannot see this.
describe('native permissions against the real content types', () => {
  const schemaOf = (uid: string) => {
    const name = uid.replace(/^api::/, '').split('.')[0];
    return JSON.parse(readFileSync(join(__dirname, '../../../api', name, 'content-types', name, 'schema.json'), 'utf8')) as {
      pluginOptions?: { 'content-manager'?: { visible?: boolean } };
    };
  };
  const hidden = (uid: string) => schemaOf(uid).pluginOptions?.['content-manager']?.visible === false;
  const uids = [...WEBSITE_UIDS, ...CLUB_ADMIN_UIDS];

  it('names only content types that exist', () => {
    for (const uid of uids) expect(() => schemaOf(uid), uid).not.toThrow();
  });

  it('HIDDEN_FROM_CM_UIDS is exactly the matrix types hidden from the Content Manager', () => {
    expect(uids.filter(hidden).sort()).toEqual([...HIDDEN_FROM_CM_UIDS].sort());
  });

  it('grants only explorer.read on a hidden type, and all five actions on a visible one', () => {
    for (const code of ['edusport-club-admin', 'edusport-site-editor'] as const) {
      const perms = nativePermissions(code);
      for (const uid of uids.filter((u) => perms.some((p) => p.subject === u))) {
        const actions = perms.filter((p) => p.subject === uid).map((p) => p.action);
        expect(actions, `${code} ${uid}`).toEqual(hidden(uid) ? ['plugin::content-manager.explorer.read'] : [...CM_ACTIONS]);
      }
    }
  });
});
