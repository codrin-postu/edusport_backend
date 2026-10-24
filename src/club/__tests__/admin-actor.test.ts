import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';
import { UNKNOWN_ACTOR, adminActor, type ActorStrapi } from '../admin-actor';

const SECRET = 'test-secret';

function fakeStrapi(user: unknown = { email: 'ana@club.ro' }) {
  const findOne = vi.fn().mockResolvedValue(user);
  const strapi: ActorStrapi = {
    config: { get: (key: string) => (key === 'admin.auth.secret' ? SECRET : undefined) },
    db: { query: () => ({ findOne }) },
  };
  return { strapi, findOne };
}

const bearer = (payload: object, secret = SECRET) => `Bearer ${jwt.sign(payload, secret)}`;

describe('adminActor', () => {
  it("returns the admin's e-mail from the token's userId", async () => {
    const { strapi, findOne } = fakeStrapi();
    await expect(adminActor(bearer({ userId: 7 }), strapi)).resolves.toBe('ana@club.ro');
    expect(findOne).toHaveBeenCalledWith({ where: { id: 7 }, select: ['email'] });
  });

  it('falls back when there is no token, a wrong signature or no such admin', async () => {
    await expect(adminActor(undefined, fakeStrapi().strapi)).resolves.toBe(UNKNOWN_ACTOR);
    await expect(adminActor(bearer({ userId: 7 }, 'other'), fakeStrapi().strapi)).resolves.toBe(UNKNOWN_ACTOR);
    await expect(adminActor(bearer({ userId: 7 }), fakeStrapi(null).strapi)).resolves.toBe(UNKNOWN_ACTOR);
  });
});
