// GET /api/stats  (header x-stats-key: your STATS_PASSWORD)  ->  all the numbers for the /stats page
const crypto = require('crypto');
const { pipeline, toObj, today, dbConf } = require('./_db.js');

const MOODS = ['laugh', 'tense', 'moved', 'wow', 'scary'];
const DAYS = 30;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.end(JSON.stringify(body));
}
function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
const pairs = arr => { const out = []; for (let i = 0; i < (arr || []).length; i += 2) out.push({ title: arr[i], n: Number(arr[i + 1]) }); return out; };

module.exports = async function handler(req, res) {
  const pass = process.env.STATS_PASSWORD;
  if (!pass) return send(res, 503, { error: 'setup', message: 'Add a STATS_PASSWORD environment variable in Vercel, then redeploy.' });
  if (!same(req.headers['x-stats-key'] || '', pass)) {
    await new Promise(r => setTimeout(r, 600)); // slow down guessing
    return send(res, 401, { error: 'password', message: 'Wrong password.' });
  }
  if (!dbConf()) return send(res, 503, { error: 'setup', message: 'Connect the Upstash Redis database in Vercel (Storage tab), then redeploy.' });

  try {
    const dayKeys = Array.from({ length: DAYS }, (_, i) => today(DAYS - 1 - i));
    const cmds = [
      ['HGETALL', 'mmm:total'], ['HGETALL', 'mmm:start'], ['HGETALL', 'mmm:q:short'], ['HGETALL', 'mmm:q:long'],
      ...MOODS.map(m => ['HGETALL', `mmm:mood:${m}`]),
      ...dayKeys.map(d => ['HGETALL', `mmm:day:${d}`]),
      ['ZREVRANGE', 'mmm:z:picked', 0, 9, 'WITHSCORES'],
      ['ZREVRANGE', 'mmm:z:seen', 0, 9, 'WITHSCORES'],
      ['ZREVRANGE', 'mmm:z:not', 0, 9, 'WITHSCORES'],
      ['ZREVRANGE', 'mmm:z:stream', 0, 9, 'WITHSCORES'],
    ];
    const r = await pipeline(cmds);
    let i = 0;
    const total = toObj(r[i++]), start = toObj(r[i++]), qShort = toObj(r[i++]), qLong = toObj(r[i++]);
    const moods = {}; MOODS.forEach(m => { moods[m] = toObj(r[i++]); });
    const days = dayKeys.map(d => ({ day: d, ...toObj(r[i++]) }));
    const top = { picked: pairs(r[i++]), seen: pairs(r[i++]), not: pairs(r[i++]), stream: pairs(r[i++]) };
    send(res, 200, { total, start, q: { short: qShort, long: qLong }, moods, days, top, generated: new Date().toISOString() });
  } catch (e) {
    console.error('stats', e.message);
    send(res, 500, { error: 'db', message: 'Could not read the database right now.' });
  }
};
