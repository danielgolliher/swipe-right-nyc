// Anonymous tally for swiperight.nyc. The site posts each finished deck (all 50 verdicts) with a random
// browser id; this stores one row per browser and serves aggregates for a future visualization.
//   POST /submit  body {"cid": "...", "code": "<17 chars>", "test": 0|1}   -> 204
//   GET  /stats   aggregate JSON (test rows excluded), cached for 60 s
const ORIGINS = ['https://swiperight.nyc', 'https://www.swiperight.nyc', 'https://danielgolliher.github.io'];
const DEV = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const BY = [null, 'nope', 'like', 'super'];
// Same thresholds as the site's TIERS.
const TIERS = [[100, 'Perfect match'], [85, 'Practically on staff'], [70, 'Pragmatic reformer'], [50, 'Open-minded New Yorker'], [30, 'Friendly skeptic'], [1, 'Loyal opposition'], [0, 'Swiped left on everything']];
const AREAS = [['homes', 1, 8], ['schools', 9, 21], ['childcare', 22, 25], ['streets', 26, 34], ['work', 35, 37], ['services', 38, 44], ['government', 45, 50]];

// A complete deck only: 50 verdicts, none blank, zero padding bits.
function decode(code) {
  if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{17}$/.test(code)) return null;
  let bits = '';
  for (const ch of code) bits += B64.indexOf(ch).toString(2).padStart(6, '0');
  if (bits.slice(100) !== '00') return null;
  const v = [];
  for (let i = 0; i < 100; i += 2) { const x = parseInt(bits.slice(i, i + 2), 2); if (!x) return null; v.push(x); }
  return v;
}
function tierOf(pct) { return TIERS.find((t) => pct >= t[0])[1]; }
function cors(origin) {
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
}
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });

async function submit(request, env) {
  const origin = request.headers.get('Origin') || '';
  const dev = DEV.test(origin);
  if (!ORIGINS.includes(origin) && !dev) return new Response('Forbidden', { status: 403 });
  const h = cors(origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: h });
  if (env.IP_LIMIT) {
    const { success } = await env.IP_LIMIT.limit({ key: request.headers.get('CF-Connecting-IP') || 'none' });
    if (!success) return new Response('Too many requests', { status: 429, headers: h });
  }
  const text = await request.text();
  if (text.length > 300) return new Response('Too large', { status: 413, headers: h });
  let body; try { body = JSON.parse(text); } catch { return new Response('Bad JSON', { status: 400, headers: h }); }
  const cid = body && body.cid, v = decode(body && body.code);
  if (typeof cid !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(cid) || !v) return new Response('Invalid', { status: 400, headers: h });
  const likes = v.filter((x) => x === 2).length, supers = v.filter((x) => x === 3).length, nopes = v.filter((x) => x === 1).length;
  const pct = Math.round((likes + supers) / 50 * 100), now = new Date().toISOString(), test = dev || body.test === 1 ? 1 : 0;
  await env.DB.prepare(
    `INSERT INTO results (cid, code, pct, likes, supers, nopes, is_test, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
     ON CONFLICT(cid) DO UPDATE SET code = excluded.code, pct = excluded.pct, likes = excluded.likes, supers = excluded.supers,
       nopes = excluded.nopes, is_test = MAX(results.is_test, excluded.is_test), submits = results.submits + 1, updated_at = excluded.updated_at`
  ).bind(cid, body.code, pct, likes, supers, nopes, test, now).run();
  return new Response(null, { status: 204, headers: h });
}

async function stats(request, env, ctx) {
  const cache = caches.default, key = new Request(new URL('/stats', request.url).toString());
  const hit = await cache.match(key); if (hit) return hit;
  const { results } = await env.DB.prepare('SELECT code, pct, updated_at FROM results WHERE is_test = 0').all();
  const ideas = Array.from({ length: 50 }, (_, i) => ({ n: i + 1, like: 0, super: 0, nope: 0 }));
  const hist = Array(11).fill(0), tiers = Object.fromEntries(TIERS.map((t) => [t[1], 0]));
  let sum = 0, last = null;
  for (const r of results) {
    const v = decode(r.code); if (!v) continue;
    v.forEach((x, i) => { ideas[i][BY[x]]++; });
    hist[Math.min(10, Math.floor(r.pct / 10))]++; tiers[tierOf(r.pct)]++; sum += r.pct;
    if (!last || r.updated_at > last) last = r.updated_at;
  }
  const n = results.length;
  const areas = AREAS.map(([a, from, to]) => {
    let agree = 0, all = 0;
    for (let i = from - 1; i < to; i++) { agree += ideas[i].like + ideas[i].super; all += ideas[i].like + ideas[i].super + ideas[i].nope; }
    return { area: a, pct: all ? Math.round(agree / all * 100) : null };
  });
  const res = json({ respondents: n, avgPct: n ? Math.round(sum / n * 10) / 10 : null, pctHistogram: hist.map((c, i) => ({ from: i * 10, to: i === 10 ? 100 : i * 10 + 9, count: c })), tiers, areas, ideas, updatedAt: last },
    200, { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/submit') return submit(request, env);
    if (pathname === '/stats' && request.method === 'GET') return stats(request, env, ctx);
    return new Response('swiperight.nyc tally', { headers: { 'Content-Type': 'text/plain' } });
  }
};
