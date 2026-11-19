// Shared helpers for talking to TMDB. Files starting with "_" are not routes on Vercel.
// The key lives in the TMDB_TOKEN environment variable (Vercel > Settings > Environment Variables).
// Use the long "API Read Access Token" from your TMDB settings.

const BASE = 'https://api.themoviedb.org/3';

// Accepts either TMDB credential: the long "API Read Access Token" or the short 32-character "API Key".
function readToken() {
  let t = (process.env.TMDB_TOKEN || '').trim().replace(/^["']|["']$/g, '').replace(/^Bearer\s+/i, '');
  if (!t) return { type: 'missing', value: '' };
  return { type: /^[a-f0-9]{32}$/i.test(t) ? 'key' : 'token', value: t };
}

async function tmdb(path, params = {}) {
  const tok = readToken();
  if (tok.type === 'missing') { const e = new Error('TMDB_TOKEN is not set'); e.code = 'missing_token'; throw e; }
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const headers = { accept: 'application/json' };
  if (tok.type === 'key') url.searchParams.set('api_key', tok.value);
  else headers.Authorization = `Bearer ${tok.value}`;
  const r = await fetch(url, { headers });
  if (!r.ok) { const e = new Error(`TMDB ${r.status} on ${path}`); e.code = r.status === 401 ? 'bad_token' : 'tmdb_error'; e.status = r.status; throw e; }
  return r.json();
}

function sendJson(res, status, body, cacheSeconds = 0) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheSeconds ? `public, s-maxage=${cacheSeconds}, stale-while-revalidate=86400` : 'no-store');
  res.end(JSON.stringify(body));
}

function query(req) {
  return Object.fromEntries(new URL(req.url, 'http://x').searchParams);
}

// The five moods, as TMDB genre ids. The first id is the "core" genre for that mood.
const MOOD_GENRES = {
  laugh: [35],                 // Comedy
  tense: [53, 28, 80, 9648],   // Thriller, Action, Crime, Mystery
  moved: [18, 10749],          // Drama, Romance
  wow:   [878, 12, 14],        // Sci-Fi, Adventure, Fantasy
  scary: [27],                 // Horror
};

const GENRE_NAMES = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary', 18: 'Drama',
  10751: 'Family', 14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music', 9648: 'Mystery',
  10749: 'Romance', 878: 'Science Fiction', 10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
};

module.exports = { tmdb, readToken, sendJson, query, MOOD_GENRES, GENRE_NAMES };
