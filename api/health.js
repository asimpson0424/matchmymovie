// GET /api/health  ->  a plain-English check that the TMDB key is set up. Never shows the key itself.
const { readToken, tmdb } = require('./_tmdb.js');
const { dbConf, pipeline } = require('./_db.js');

module.exports = async function handler(req, res) {
  const tok = readToken();
  const out = { ok: false, key_found: tok.type !== 'missing', key_type: tok.type === 'key' ? 'API Key (short)' : tok.type === 'token' ? 'Read Access Token (long)' : 'none' };
  if (tok.type === 'missing') {
    out.message = 'No TMDB_TOKEN found. In Vercel: Settings > Environment Variables > add TMDB_TOKEN, then Deployments > ... > Redeploy.';
  } else {
    try { await tmdb('/configuration'); out.ok = true; out.message = 'All good: the site can reach TMDB.'; }
    catch (e) {
      out.tmdb_status = e.status || null;
      out.message = e.code === 'bad_token'
        ? 'TMDB rejected the key. Re-copy it from themoviedb.org > Settings > API (no spaces), update TMDB_TOKEN in Vercel, then Redeploy.'
        : 'Could not reach TMDB right now (' + (e.status || e.message) + '). Try again in a minute.';
    }
  }
  const db = dbConf();
  if (!db) out.stats_database = 'not connected. In Vercel: Storage > your Redis database > Connect Project > matchmymovie, then Redeploy.';
  else {
    try { await pipeline([['PING']]); out.stats_database = `connected (${db.kind === 'rest' ? 'Upstash' : 'Redis'})`; }
    catch (e) { out.stats_database = `found the database settings but could not connect (${e.message})`; }
  }
  out.stats_password = process.env.STATS_PASSWORD ? 'set' : 'not set (add STATS_PASSWORD)';
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(out, null, 2));
}
