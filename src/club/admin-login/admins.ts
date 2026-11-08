import type { Core } from '@strapi/strapi';

export type AdminRow = {
  id: number; email: string; firstname: string | null; lastname: string | null; isActive: boolean; blocked: boolean | null; passwordHash: string | null; roleCodes: string[];
};

type Raw = Record<string, unknown>;
const USER = 'admin::user' as const;

const text = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

function toAdmin(raw: Raw | null): AdminRow | null {
  if (!raw) return null;
  const roles = Array.isArray(raw.roles) ? (raw.roles as Raw[]) : [];
  return {
    id: Number(raw.id),
    email: String(raw.email),
    firstname: text(raw.firstname),
    lastname: text(raw.lastname),
    isActive: raw.isActive === true,
    blocked: typeof raw.blocked === 'boolean' ? raw.blocked : null,
    passwordHash: text(raw.password),
    roleCodes: roles.map((r) => text(r.code)).filter((c): c is string => c !== null),
  };
}

/** The admin of an e-mail, matched without regard to case (Strapi's own `$eqi`). */
export async function adminByEmail(strapi: Core.Strapi, email: string): Promise<AdminRow | null> {
  return toAdmin((await strapi.db.query(USER).findOne({ where: { email: { $eqi: email } }, populate: ['roles'] })) as Raw | null);
}

export async function adminById(strapi: Core.Strapi, id: number): Promise<AdminRow | null> {
  return toAdmin((await strapi.db.query(USER).findOne({ where: { id }, populate: ['roles'] })) as Raw | null);
}

/** Both flags are read on every login and every request: active, and not blocked (`null` is not blocked). */
export const canEnterAdmin = (a: AdminRow | null): a is AdminRow => a !== null && a.isActive === true && a.blocked !== true;

/** "<firstname> <lastname>" trimmed, else the e-mail. */
export const adminName = (a: AdminRow): string => [a.firstname, a.lastname].filter((p): p is string => p !== null).map((p) => p.trim()).filter(Boolean).join(' ') || a.email;

/** The part of Strapi's `admin::user` service the reset, the invite and the password change use (it hashes the password itself). */
export type AdminUserService = {
  updateById: (id: number, attributes: Record<string, unknown>) => Promise<{ id: number } | null>;
  findRegistrationInfo: (registrationToken: string) => Promise<{ email: string; firstname?: string | null; lastname?: string | null } | undefined>;
  register: (args: { registrationToken: string; userInfo: { firstname?: string | null; lastname?: string | null; password: string } }) => Promise<{ id: number }>;
};

export const adminUserService = (strapi: Core.Strapi): AdminUserService => (strapi as unknown as { service: (uid: string) => AdminUserService }).service(USER);

/** Every admin, oldest first (the Administratori list). */
export async function allAdmins(strapi: Core.Strapi): Promise<AdminRow[]> {
  const rows = (await strapi.db.query(USER).findMany({ orderBy: { id: 'asc' }, populate: ['roles'] })) as Raw[];
  return rows.map((r) => toAdmin(r)).filter((a): a is AdminRow => a !== null);
}
