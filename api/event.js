// POST /api/event  ->  records one anonymous tap (no names, accounts or IP addresses are stored).
const { pipeline, today, dbConf } = require('./_db.js');

const EVENTS = ['start', 'q', 'search', 'empty', 'pick', 'pick_list', 'swap', 'more', 'save', 'trailer', 'share', 'shared'];
const MOODS = ['laugh', 'tense', 'moved', 'wow', 'scary'];
const REASONS = ['seen', 'stream', 'not'];
const STARTS = ['short', 'long', 'mood', 'lucky'];
const QKEYS = ['mood', 'like', 'brain', 'who', 'time', 'era', 'skip'];
const DAY_TTL = 60 * 60 * 24 * 400; // keep daily counts a bit over a year

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > 4000) throw new Error('too big'); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

const int = (v, max) => Math.max(0, Math.min(max, parseInt(v, 10) || 0));
const cleanTitle = t => String(t || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 120);

module.exports = async function handler(req, res) {
  const done = () => { res.statusCode = 204; res.setHeader('Cache-Control', 'no-store'); res.end(); };
  if (req.method !== 'POST' || !dbConf()) return done();
  try {
    const b = await readBody(req);
    const e = String(b.e || '');
    if (!EVENTS.includes(e)) return done();
    const moods = Array.isArray(b.mood) ? b.mood.filter(m => MOODS.includes(m)).slice(0, 2) : [];
    const title = cleanTitle(b.title);
    const day = `mmm:day:${today()}`;
    const cmds = [['HINCRBY', 'mmm:total', e, 1], ['HINCRBY', day, e, 1], ['EXPIRE', day, DAY_TTL]];

    if (e === 'start' && STARTS.includes(b.mode)) cmds.push(['HINCRBY', 'mmm:start', b.mode, 1]);
    if (e === 'q' && ['short', 'long'].includes(b.mode) && QKEYS.includes(b.key)) cmds.push(['HINCRBY', `mmm:q:${b.mode}`, b.key, 1]);
    if (['search', 'pick', 'swap', 'more', 'empty'].includes(e)) moods.forEach(m => cmds.push(['HINCRBY', `mmm:mood:${m}`, e, 1]));
    if (e === 'search' && b.like) cmds.push(['HINCRBY', 'mmm:total', 'search_like', 1]);

    if (e === 'swap' && REASONS.includes(b.reason)) {
      cmds.push(['HINCRBY', 'mmm:total', `swap_${b.reason}`, 1]);
      moods.forEach(m => cmds.push(['HINCRBY', `mmm:mood:${m}`, `swap_${b.reason}`, 1]));
      if (title) cmds.push(['ZINCRBY', `mmm:z:${b.reason}`, 1, title]);
    }
    if (e === 'pick') {
      if (title) cmds.push(['ZINCRBY', 'mmm:z:picked', 1, title]);
      if (b.first) {
        cmds.push(['HINCRBY', 'mmm:total', 'matched', 1], ['HINCRBY', day, 'matched', 1],
                  ['HINCRBY', 'mmm:total', 'swaps_before_pick', int(b.swaps, 50)],
                  ['HINCRBY', 'mmm:total', 'sets_before_pick', int(b.sets, 20)]);
        if (int(b.sets, 20) <= 1 && int(b.swaps, 50) === 0) cmds.push(['HINCRBY', 'mmm:total', 'first_three', 1]);
        moods.forEach(m => cmds.push(['HINCRBY', `mmm:mood:${m}`, 'matched', 1]));
        if (b.like) cmds.push(['HINCRBY', 'mmm:total', 'matched_like', 1]);
      }
    }
    await pipeline(cmds);
  } catch (err) {
    console.error('event', err.message);
  }
  done();
};
