// Shared helpers for talking to TMDB. Files starting with "_" are not routes on Vercel.
// The key lives in the TMDB_TOKEN environment variable (Vercel > Settings > Environment Variables).
// Use the long "API Read Access Token" from your TMDB settings.

const BASE = 'https://api.themoviedb.org/3';

export async function tmdb(path, params = {}) {
  const token = process.env.TMDB_TOKEN;
  if (!token) throw new Error('TMDB_TOKEN is not set');
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, accept: 'application/json' } });
  if (!r.ok) throw new Error(`TMDB ${r.status} on ${path}`);
  return r.json();
}

export function sendJson(res, status, body, cacheSeconds = 0) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheSeconds ? `public, s-maxage=${cacheSeconds}, stale-while-revalidate=86400` : 'no-store');
  res.end(JSON.stringify(body));
}

export function query(req) {
  return Object.fromEntries(new URL(req.url, 'http://x').searchParams);
}

// The five moods, as TMDB genre ids. The first id is the "core" genre for that mood.
export const MOOD_GENRES = {
  laugh: [35],                 // Comedy
  tense: [53, 28, 80, 9648],   // Thriller, Action, Crime, Mystery
  moved: [18, 10749],          // Drama, Romance
  wow:   [878, 12, 14],        // Sci-Fi, Adventure, Fantasy
  scary: [27],                 // Horror
};

export const GENRE_NAMES = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary', 18: 'Drama',
  10751: 'Family', 14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music', 9648: 'Mystery',
  10749: 'Romance', 878: 'Science Fiction', 10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
};
