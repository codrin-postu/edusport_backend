import { describe, expect, it, vi } from 'vitest';

// Load the real service factory without booting Strapi.
vi.mock('@strapi/strapi', () => ({ factories: { createCoreService: (_uid: string, build: unknown) => build } }));

import { withoutCustomQuestions } from '../custom-policy';
import buildService from '../services/form-config';

type PublicModel = { steps: { key: string; questions: { key: string }[] }[] };
type Service = { publicConfig(type: string): Promise<PublicModel> };

function service(overlay: unknown): Service {
  const strapi = { documents: () => ({ findFirst: async () => ({ overlay }) }) };
  return (buildService as unknown as (ctx: { strapi: unknown }) => Service)({ strapi });
}

const keys = (m: PublicModel) => m.steps.flatMap((s) => s.questions.map((q) => q.key));
const custom = (step: string) => ({ key: 'c_old1', type: 'text', step, label: 'Întrebare veche', required: true });

describe('custom questions', () => {
  it('never appear on the public registration form, even when stored', async () => {
    const model = await service({ custom: [custom('date')], order: { date: ['email', 'c_old1'] } }).publicConfig('inscriere');
    expect(keys(model)).not.toContain('c_old1');
    expect(keys(model)).toContain('email');
  });

  it('still appear on the other forms', async () => {
    const model = await service({ custom: [custom('contact')] }).publicConfig('contact');
    expect(keys(model)).toContain('c_old1');
  });

  it('withoutCustomQuestions drops them for inscriere only and keeps the rest of the overlay', () => {
    const overlay = { q: { email: { label: 'E-mail' } }, custom: [custom('date')] };
    expect(withoutCustomQuestions('inscriere', overlay)).toEqual({ q: { email: { label: 'E-mail' } } });
    expect(withoutCustomQuestions('contact', overlay)).toBe(overlay);
  });
});
