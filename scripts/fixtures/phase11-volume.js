'use strict';
/**
 * Phase 11 volume fixture, run AFTER phase4-shape.js and phase5-shape.js on the same throwaway database and ids file:
 * 130 synthetic athletes in 4 groups of 2 sections, sessions on 45 dates with every member present (about 5.850 attendance rows),
 * abonamente through the add service (with codes), payments through the record service, one name starting with "=" (CSV formula guard).
 * Needs `npm run build` first: the services are read from dist/. Usage (from the repo root, with the throwaway env loaded):
 *   ES_THROWAWAY_DB=1 IDS_FILE=/tmp/x/ids.json node scripts/fixtures/phase11-volume.js
 */
const fs = require('node:fs');
const path = require('node:path');
const { createStrapi, compileStrapi } = require('@strapi/strapi');

if (process.env.ES_THROWAWAY_DB !== '1' || !process.env.IDS_FILE) {
  console.error('refused: set ES_THROWAWAY_DB=1 and IDS_FILE (throwaway databases only)');
  process.exit(2);
}

const THROWAWAY_PORTS = [55441, 55443, 55444, 55445, 55446, 55447, 55448, 55449, 55451, 55452, 55453, 55454, 55455, 55456, 55457, 55461, 55462, 55463, 55464, 55469, 55473, 55474, 55475, 55476];

/** Where Strapi will connect, from DATABASE_URL or DATABASE_HOST / DATABASE_PORT (config/database.ts). */
function dbTarget() {
  if (process.env.DATABASE_URL) {
    try {
      const u = new URL(process.env.DATABASE_URL);
      return { host: u.hostname, port: Number(u.port || 5432) };
    } catch {
      return { host: '', port: 0 };
    }
  }
  return { host: process.env.DATABASE_HOST || 'localhost', port: Number(process.env.DATABASE_PORT || 5432) };
}

const target = dbTarget();
if (!['127.0.0.1', 'localhost'].includes(target.host) || !THROWAWAY_PORTS.includes(target.port)) {
  console.error(`refused: database ${target.host}:${target.port} is not a throwaway (host 127.0.0.1 or localhost, port one of ${THROWAWAY_PORTS.join(', ')})`);
  process.exit(2);
}

const ATHLETES = 130;
const DATES = 45;
const FIRST_DATE = Date.UTC(2026, 9, 1);   // 1 October 2026, the first day of the current season
const GROUPS = ['Avansați Gold', 'Primii Paşi', 'Profesioniști', 'Avansați'];   // two school groups, two Club groups
const pad = (n, w = 3) => String(n).padStart(w, '0');
const dateOf = (i) => new Date(FIRST_DATE + i * 86_400_000).toISOString().slice(0, 10);
const dist = (p) => require(path.join(process.cwd(), 'dist', 'src', p));

async function refuse(app, message) {
  console.error(`refused: ${message}`);
  await app.destroy();
  process.exit(2);
}

(async () => {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  const d = (uid) => app.documents(uid);
  const ids = JSON.parse(fs.readFileSync(process.env.IDS_FILE, 'utf8'));
  if (!ids.groups?.['Avansați Gold'] || !ids.priceLists?.Club) return refuse(app, 'run phase4-shape.js and phase5-shape.js first');
  if ((await d('api::athlete.athlete').count({ filters: { email: { $endsWith: '@example.invalid' } } })) > 0) return refuse(app, 'the phase 11 volume fixture was already applied');

  const { strapiPresenceStore } = dist('club/presence/strapi-store');
  const { addSubscription, newSubscriptionForm } = dist('club/presence/subscriptions/add');
  const { defaultCover } = dist('club/presence/subscriptions/rules');
  const { recordPayment } = dist('club/presence/payments/record');
  const { attendanceKey } = dist('club/presence/sessions');
  const { todayIso } = dist('club/groups/http');
  const { clubCharges } = dist('club/presence/billing');
  const store = strapiPresenceStore(app);
  const clubList = (await store.priceListRecords()).find((l) => l.id === ids.priceLists.Club);
  const club = clubCharges(clubList, { grup: true, uscat: false }, 'member');
  const today = todayIso();
  const ctx = { store, actor: 'phase11-volume', today, now: () => new Date(), log: (m) => console.error(m), paymentEmails: () => {} };
  const season = ids.seasons['2026-2027'];

  // Athletes and memberships: 130 in 4 groups (33, 33, 32, 32).
  const athletes = [];
  for (let n = 1; n <= ATHLETES; n += 1) {
    const group = GROUPS[(n - 1) % GROUPS.length];
    const name = n === 7 ? '=1+1 Test' : `Sportiv Test ${pad(n)}`;
    const id = (await d('api::athlete.athlete').create({
      data: { name, birthDate: `${2010 + (n % 8)}-0${1 + (n % 9)}-1${n % 9}`, status: 'activ', email: `sportiv${n}@example.invalid`, contactName: `Părinte Test ${n}`, phone: `0700 000 ${pad(n)}`, dataIncomplete: false },
    })).documentId;
    await d('api::group-membership.group-membership').create({ data: { athlete: id, group: ids.groups[group], season, isMain: true, from: '2026-10-01', to: null } });
    athletes.push({ id, n, group });
  }

  // Sessions: every group on 45 consecutive dates, every member present (school rows start as "Fără abonament", the abonamente below cover them).
  const nowIso = new Date().toISOString();
  let rows = 0;
  for (let i = 0; i < DATES; i += 1) {
    for (const group of GROUPS) {
      const school = group === 'Avansați Gold' || group === 'Primii Paşi';
      const sessionId = await store.createSession({
        groupId: ids.groups[group], seasonId: season, date: dateOf(i), startTime: '18:00:00.000', durationMin: 60, source: 'added', eventId: null, occurrenceKey: null,
        outsideSchedule: true, coachIds: [], savedBy: 'phase11-volume', savedAt: nowIso, firstSavedAt: nowIso,
      });
      for (const a of athletes.filter((x) => x.group === group)) {
        await store.createAttendance({
          sessionId, athleteId: a.id, uniqueKey: attendanceKey(sessionId, a.id), grup: true, uscat: false, visitor: false, subscriptionId: null,
          ...(school ? { billing: 'fara_abonament', charges: [], amount: 0, audience: null }
            : group === 'Avansați' ? { billing: 'fara_pret', charges: [], amount: 0, audience: null } : { ...club, audience: 'member' }),
        });
        rows += 1;
      }
    }
  }

  // Abonamente through the add service for the Gold group: paid in full, partly or not at all.
  let subs = 0;
  for (const a of athletes.filter((x) => x.group === 'Avansați Gold')) {
    const form = await newSubscriptionForm(store, a.id, '2026-10-01', today);
    if (form.ok === false) throw new Error(`form refused: ${form.error}`);
    const list = form.data.lists.find((l) => l.items.length > 0);
    const item = list.items[0];
    const payment = a.n % 5 === 0 ? null : { amount: a.n % 2 === 0 ? item.price : 100, method: a.n % 3 === 0 ? 'card' : 'numerar', collectedAtRink: false, sendEmail: false };
    const r = await addSubscription(ctx, a.id, { itemKey: item.itemKey, priceListId: list.priceListId, startsOn: '2026-10-01', cover: defaultCover(form.data.cover, list.priceListId, item.slots), payment });
    if (r.ok === false) throw new Error(`abonament refused: ${r.error}`);
    subs += 1;
  }

  // Payments through the record service: Club months, the membership fee and a few others.
  let pays = 0;
  const pay = async (athleteId, body) => {
    const r = await recordPayment(ctx, { athleteId, sendEmail: false, collectedAtRink: false, note: null, ...body });
    if (r.ok === false) throw new Error(`payment refused: ${r.error}`);
    pays += 1;
  };
  for (const a of athletes) {
    if (a.group === 'Profesioniști') {   // the Avansați group has no price list, so it owes nothing
      // The phase 5 fixture starts attendance billing on 2026-11-01, so only November is owed.
      if (a.n % 3 !== 0) await pay(a.id, { amount: 200, paidOn: today, method: 'transfer', for: { kind: 'club_luna', month: '2026-11' } });
    }
    if (a.n % 4 === 0) await pay(a.id, { amount: 100, paidOn: '2026-10-05', method: 'card', for: { kind: 'cotizatie', seasonId: season } });
    if (a.n % 17 === 0) await pay(a.id, { amount: 25, paidOn: today, method: 'numerar', for: { kind: 'altceva' } });
  }

  ids.volume = { athletes: ATHLETES, attendanceRows: rows, subscriptions: subs, payments: pays };
  fs.writeFileSync(process.env.IDS_FILE, JSON.stringify(ids, null, 2));
  console.log('phase 11 volume fixture ok', JSON.stringify(ids.volume));
  // Everything is committed; app.destroy() would abort a connection still queued by a background job and print a stack trace.
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
