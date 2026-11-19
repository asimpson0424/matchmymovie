// Tiny client for the Upstash Redis database you connect in Vercel (Storage tab).
// Vercel adds the connection details as environment variables automatically;
// either naming style works.

function dbConf() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

// Runs several Redis commands in one request. Each command is an array, e.g. ['HINCRBY', 'key', 'field', 1].
async function pipeline(cmds) {
  const c = dbConf();
  if (!c) { const e = new Error('Database not connected'); e.code = 'no_db'; throw e; }
  const r = await fetch(c.url + '/pipeline', {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) { const e = new Error('Database error ' + r.status); e.code = 'db_error'; throw e; }
  return (await r.json()).map(x => x.result);
}

// Redis returns hashes as [field, value, field, value...]; turn that into { field: number }
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
