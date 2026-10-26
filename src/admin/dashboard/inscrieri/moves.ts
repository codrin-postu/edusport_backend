import { adminToast } from '../../ui';
import type { MoveSchoolResponse } from '../../../club/athletes/api-types';
import { ADMIN_ERRORS } from '../../../club/athletes/errors';
import { moveToasts } from '../../../club/inscrieri-panel';
import { requestErrorText } from '../../../club/registration-panel';
import { dataOf, type StableClient } from './useClient';

/** POST a school move (spec 3.6) and toast the result; true when the request went through. */
export async function moveSchool(
  post: StableClient['post'],
  url: string,
  body: Record<string, unknown>,
  schoolName: string,
  single: boolean,
): Promise<boolean> {
  try {
    const res = dataOf<MoveSchoolResponse>(await post(url, body));
    moveToasts(res, schoolName, single).forEach((t) => adminToast[t.tone](t.text));
    return true;
  } catch (err) {
    adminToast.error(requestErrorText(err, ADMIN_ERRORS.failed));
    return false;
  }
}
