import { describe, expect, it } from 'vitest';
import type { Core } from '@strapi/strapi';
import { checkUpSettings } from '../up-settings';

type Fake = { value: Record<string, unknown>; sets: unknown[]; logs: string[] };

const fakeStrapi = (value: Record<string, unknown>): { strapi: Core.Strapi; fake: Fake } => {
  const fake: Fake = { value, sets: [], logs: [] };
  const store = () => ({
    get: async () => fake.value,
    set: async (params: { value: unknown }) => {
      fake.sets.push(params.value);
    },
    delete: async () => undefined,
  });
  const strapi = {
    store,
    log: { info: (m: string) => fake.logs.push(m), warn: (m: string) => fake.logs.push(m) },
  };
  return { strapi: strapi as unknown as Core.Strapi, fake };
};

describe('checkUpSettings', () => {
  it('turns registration and e-mail confirmation off and logs it', async () => {
    const { strapi, fake } = fakeStrapi({ allow_register: true, email_confirmation: true, unique_email: true });
    await checkUpSettings(strapi);
    expect(fake.sets).toEqual([{ allow_register: false, email_confirmation: false, unique_email: true }]);
    expect(fake.logs).toEqual(['[portal] U&P registration and e-mail confirmation turned off']);
  });

  it('turns off only the flag that is on', async () => {
    const { strapi, fake } = fakeStrapi({ allow_register: false, email_confirmation: true });
    await checkUpSettings(strapi);
    expect(fake.sets).toEqual([{ allow_register: false, email_confirmation: false }]);
    expect(fake.logs).toHaveLength(1);
  });

  it('leaves the store untouched when both are false', async () => {
    const { strapi, fake } = fakeStrapi({ allow_register: false, email_confirmation: false });
    await checkUpSettings(strapi);
    expect(fake.sets).toEqual([]);
    expect(fake.logs).toEqual([]);
  });
});
