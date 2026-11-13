import { canEnterAdmin, type AdminRow } from '../../admin-login/admins';
import { areasFor } from '../../roles/map';

const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Whether the coach of a portal account may edit his Scoala groups like his Club groups: the portal e-mail is that of an
 * admin who is active, not blocked and whose roles grant the `club` area (Administrator club, Super Admin). `findAdmin`
 * looks an admin up by e-mail without regard to case; the match is checked again here. Read on every request.
 */
export async function coachSchoolEdit(email: string | null, findAdmin: (email: string) => Promise<AdminRow | null>): Promise<boolean> {
  const wanted = email?.trim();
  if (!wanted) return false;
  const admin = await findAdmin(wanted);
  return canEnterAdmin(admin) && same(admin.email, wanted) && areasFor(admin.roleCodes).has('club');
}
