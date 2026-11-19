// Connects to the Redis database you added in Vercel (Storage tab). Works with either kind:
//  - Upstash (Vercel adds KV_REST_API_URL + KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL + _TOKEN)
//  - Redis / Redis Cloud (Vercel adds REDIS_URL)

let tcpClient = null;

function dbConf() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return { kind: 'rest', url: url.replace(/\/$/, ''), token };
  const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
  if (redisUrl) return { kind: 'tcp', url: redisUrl };
  return null;
}

function getTcp(url) {
  if (!tcpClient) {
    const Redis = require('ioredis');
    tcpClient = new Redis(url, { maxRetriesPerRequest: 2, connectTimeout: 5000, enableReadyCheck: false });
    tcpClient.on('error', e => console.error('redis', e.message));
  }
  return tcpClient;
}

// Runs several Redis commands at once. Each command is an array, e.g. ['HINCRBY', 'key', 'field', 1].
// Returns the raw replies in order (hashes come back as [field, value, field, value...]).
async function pipeline(cmds) {
  const c = dbConf();
  if (!c) { const e = new Error('Database not connected'); e.code = 'no_db'; throw e; }
  if (c.kind === 'rest') {
    const r = await fetch(c.url + '/pipeline', {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds),
    });
    if (!r.ok) { const e = new Error('Database error ' + r.status); e.code = 'db_error'; throw e; }
    return (await r.json()).map(x => x.result);
  }
  const client = getTcp(c.url);
  const p = client.pipeline();
  cmds.forEach(([cmd, ...args]) => p.call(cmd, ...args.map(String)));
  const res = await p.exec();
  return res.map(([err, val]) => { if (err) throw err; return val; });
}

// Turn [field, value, field, value...] into { field: number }
function toObj(arr) {
  const o = {};
  for (let i = 0; i < (arr || []).length; i += 2) o[arr[i]] = Number(arr[i + 1]) || 0;
  return o;
}

// Today's date in New York, as YYYY-MM-DD
function today(offsetDays = 0) {
  const d = new Date(Date.now() - offsetDays * 86400000);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

module.exports = { dbConf, pipeline, toObj, today };
