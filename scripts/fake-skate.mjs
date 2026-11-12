// Fake skate-results for the phase 7-3 boot check and click-through (synthetic data only, never the real service).
// Usage: node scripts/fake-skate.mjs [port]      (default 18894, bound to 127.0.0.1)
//        FAKE_SKATE_DOWN=1 node scripts/fake-skate.mjs   every request answers 503
// Shapes follow skate-results app/schemas.py. As the real service does, `segments=none` omits the per-row segments,
// `segments=summary` (the default) carries them, any other value is a 422.
import http from 'node:http';

const PORT = Number(process.argv[2] || 18894);
const DOWN = process.env.FAKE_SKATE_DOWN === '1';
const OWN_SLUG = 'ioana-marin-test';
const EMPTY_SLUG = 'sara-dinu-test';

const CATEGORIES = [
  [Date.UTC(2024, 8, 1), 'Basic Novice Girls'],
  [Date.UTC(2025, 8, 1), 'Intermediate Novice Girls'],
  [Date.UTC(2026, 8, 1), 'Advanced Novice Girls'],
];
const CITIES = ['Brașov', 'Cluj-Napoca', 'București', 'Sibiu', 'Galați', 'Otopeni', 'Brașov', 'Iași'];
const day = (ms) => new Date(ms).toISOString().slice(0, 10);

// 41 results over the three seasons 2024-2025, 2025-2026 and 2026-2027: 14, 14 and 13, one event each, newest event first.
const results = [];
for (let i = 0; i < 41; i++) {
  const band = i < 14 ? 0 : i < 28 ? 1 : 2;
  const date = CATEGORIES[band][0] + (i % 14) * 20 * 86_400_000 + (band === 2 ? 0 : 0);
  const city = CITIES[i % CITIES.length];
  results.push({
    result_id: 1001 + i,
    placement: i % 9 === 0 ? null : 1 + (i % 7),
    event_id: 501 + i,
    event_slug: `synthetic-event-${501 + i}`,
    event_name: city === 'Brașov' ? `Cupa Brașov ${i + 1}` : `Trofeul Sintetic ${i + 1}`,
    event_date: day(date),
    event_location: city,
    category: CATEGORIES[band][1],
    total_score: 20 + ((i * 7) % 41) + i / 100,
    short_score: 8 + (i % 5),
    free_score: 12 + (i % 11),
    club: 'Club Sintetic',
  });
}
const segmentsOf = (r) => [
  { segment: 'Short Program', is_short: true, placement: r.placement, tss: r.short_score, tes: r.short_score - 3, pcs: 3, deductions: 0, components: null },
  { segment: 'Free Skating', is_short: false, placement: r.placement, tss: r.free_score, tes: r.free_score - 4, pcs: 4, deductions: 0, components: null },
];

// One result of another skater, so the click-through has a real foreign id to ask for.
const FOREIGN_ID = 5000;

const json = (res, status, body) => {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) });
  res.end(text);
};

function segmentsParam(url, res) {
  const v = url.searchParams.get('segments') ?? 'summary';
  if (v !== 'summary' && v !== 'none') {
    json(res, 422, { detail: 'segments must be summary or none' });
    return null;
  }
  return v;
}

const server = http.createServer((req, res) => {
  if (DOWN) return json(res, 503, { detail: 'down' });
  const url = new URL(req.url, 'http://x');
  const path = url.pathname;
  let m;
  if (req.method !== 'GET') return json(res, 405, { detail: 'method not allowed' });
  if (path === '/health') return json(res, 200, { ok: true });

  if ((m = path.match(/^\/skaters\/([^/]+)\/results$/))) {
    const mode = segmentsParam(url, res);
    if (mode === null) return;
    if (m[1] === EMPTY_SLUG) return json(res, 200, []);
    if (m[1] !== OWN_SLUG) return json(res, 404, { detail: 'skater not found' });
    return json(res, 200, results.map((r) => ({ ...r, segments: mode === 'none' ? [] : segmentsOf(r) })));
  }

  if ((m = path.match(/^\/results\/(\d+)\/protocol$/))) {
    const id = Number(m[1]);
    const r = results.find((x) => x.result_id === id);
    if (!r && id !== FOREIGN_ID) return json(res, 404, { detail: 'result not found' });
    const base = r ?? { result_id: FOREIGN_ID, placement: 1, short_score: 40, free_score: 70, category: 'Foreign Category', event_name: 'Foreign Event' };
    return json(res, 200, {
      result_id: base.result_id, skater_slug: r ? OWN_SLUG : 'other-skater-test', skater_name: r ? 'Ioana Marin' : 'Other Skater', event_slug: null,
      event_name: base.event_name, category: base.category,
      segments: segmentsOf(base).map((s) => ({
        ...s, components: [{ name: 'Skating Skills', factor: 1.6, judges: [6, 6.25, 6], score: 6.1 }],
        elements: [
          { order: 1, name: '2A', base_value: 3.3, goe: 0.4, judges: [1, 0, 1], score: 3.7, info: null, bonus: null },
          { order: 2, name: 'CCoSp3', base_value: 3.0, goe: 0.2, judges: [0, 1, 0], score: 3.2, info: null, bonus: null },
        ],
      })),
    });
  }

  if ((m = path.match(/^\/events\/(\d+)\/results$/))) {
    const mode = segmentsParam(url, res);
    if (mode === null) return;
    const id = Number(m[1]);
    const r = results.find((x) => x.event_id === id);
    if (!r) return json(res, 404, { detail: 'event not found' });
    // Ten skaters in the athlete's own category (the athlete among them), five in another one, all synthetic names.
    const rows = [];
    for (let k = 0; k < 15; k++) {
      rows.push({
        result_id: k === 0 ? r.result_id : 7000 + id * 20 + k, placement: k < 10 ? k + 1 : k - 9, skater_id: k === 0 ? 1 : 100 + k, skater_slug: k === 0 ? OWN_SLUG : `synthetic-skater-${k}`,
        skater_name: k === 0 ? 'Ioana Marin' : `Skater Sintetic ${k}`, nation: 'ROU', club: 'Club Sintetic', category: k < 10 ? r.category : 'Other Category',
        total_score: 50 - k, short_score: 20, free_score: 30 - k, segments: mode === 'none' ? [] : segmentsOf(r),
      });
    }
    return json(res, 200, rows);
  }

  if (path === '/events') {
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50) || 50, 200);
    return json(res, 200, results.filter((r) => r.event_name.toLowerCase().includes(q)).slice(0, limit).map((r) => ({
      id: r.event_id, slug: r.event_slug, source_url: `https://example.invalid/results/${r.event_id}`, source_urls: [`https://example.invalid/results/${r.event_id}`],
      name: r.event_name, host: 'example.invalid', event_date: r.event_date, location: r.event_location, season: null, skaters_count: 15, results_count: 15,
    })));
  }

  return json(res, 404, { detail: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => console.log(`fake skate-results on 127.0.0.1:${PORT}${DOWN ? ' (down: 503)' : ''}`));
