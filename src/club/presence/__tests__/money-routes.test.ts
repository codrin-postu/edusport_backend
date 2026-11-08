import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import athletes from '../../../api/club/controllers/athletes';
import groups from '../../../api/club/controllers/groups';
import payments from '../../../api/club/controllers/payments';
import subscriptions from '../../../api/club/controllers/subscriptions';
import groupRoutes from '../../../api/club/routes/06-groups';
import paymentRoutes from '../../../api/club/routes/11-payments';
import subscriptionRoutes from '../../../api/club/routes/10-subscriptions';
import { areaOfRoute } from '../../admin-area';
import { staticBeforeParams } from '../../groups/__tests__/route-order';

const SRC = join(__dirname, '../../..');
const CONTROLLERS: Record<string, Record<string, unknown>> = { groups, athletes, payments, subscriptions };

describe('money routes (spec 6, 11.3)', () => {
  it('every route is admin only (6, 11.3); the money routes name their area', () => {
    for (const r of [...subscriptionRoutes.routes, ...paymentRoutes.routes]) {
      if (r.path.startsWith('/club/money/')) expect(areaOfRoute(r.config), r.path).toBe('money');
      else expect(r.config, r.path).toEqual({ auth: false, policies: ['global::is-admin'], middlewares: [] });
    }
  });
  it('the paths and handlers of spec 6', () => {
    expect(subscriptionRoutes.routes.map((r) => `${r.method} ${r.path} ${r.handler}`)).toEqual([
      'GET /club/subscriptions subscriptions.list', 'GET /club/subscriptions/extend/preview subscriptions.extendPreview', 'POST /club/subscriptions/extend subscriptions.extend',
      'POST /club/subscriptions/:documentId/cancel subscriptions.cancel', 'GET /club/athletes/:documentId/subscriptions/new subscriptions.form',
      'GET /club/athletes/:documentId/subscriptions subscriptions.athlete', 'POST /club/athletes/:documentId/subscriptions subscriptions.add']);
    expect(paymentRoutes.routes.map((r) => `${r.method} ${r.path} ${r.handler}`)).toEqual([
      'GET /club/payments payments.list', 'POST /club/payments payments.create', 'GET /club/due payments.due',
      'GET /club/money/overview payments.moneyOverview', 'GET /club/money/accounting payments.accounting', 'GET /club/money/accounting.xlsx payments.accountingXlsx',
      'GET /club/money/accounting.csv payments.accountingCsv', 'PUT /club/payments/:documentId payments.update',
      'POST /club/payments/:documentId/cancel payments.cancel', 'GET /club/athletes/:documentId/payments/options payments.options', 'GET /club/athletes/:documentId/payments payments.athlete']);
  });
  it('static before parameter paths in each file; move preview in 06-groups (P4 8.2)', () => {
    for (const file of [subscriptionRoutes, paymentRoutes, groupRoutes]) expect(staticBeforeParams(file.routes.map((r) => r.path))).toBe(true);
    expect(groupRoutes.routes.some((r) => r.path === '/club/memberships/:documentId/move-preview' && r.handler === 'groups.movePreview')).toBe(true);
  });
  it('every handler exists in its controller', () => {
    for (const r of [...subscriptionRoutes.routes, ...paymentRoutes.routes]) {
      const [name, fn] = r.handler.split('.');
      expect(typeof CONTROLLERS[name][fn], r.handler).toBe('function');
    }
  });
  it('the move and undo handlers pass the presence carry; the Sportivi list passes the cells', () => {
    const groupsSrc = readFileSync(join(SRC, 'api/club/controllers/groups.ts'), 'utf8');
    expect(groupsSrc).toMatch(/moveMembership\([^)]*presenceCarry\(/s);
    expect(groupsSrc).toMatch(/undoAction\([^)]*ports/s);
    const athletesSrc = readFileSync(join(SRC, 'api/club/controllers/athletes.ts'), 'utf8');
    expect(athletesSrc).toMatch(/abonamentCells\(/);
    expect(athletesSrc).toMatch(/activity: await loadPresenceActivity\(/);
  });

  it('the athlete abonamente route answers with the dated cards, through the shared responder', () => {
    const src = readFileSync(join(SRC, 'api/club/controllers/subscriptions.ts'), 'utf8');
    expect(src).toMatch(/respond\(ctx, await readAthleteSubscriptionCards\(strapiPresenceStore\(strapi\), id\(ctx\), queryText\(ctx\.query\.season\), todayIso\(\)\)\)/);
    expect(src).not.toContain('athleteSubscriptions');
  });
});
