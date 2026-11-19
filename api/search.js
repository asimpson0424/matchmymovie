// GET /api/search?q=knives  ->  up to 6 matching movies for the "movie you loved" box
const { tmdb, sendJson, query } = require('./_tmdb.js');

module.exports = async function handler(req, res) {
  const q = (query(req).q || '').trim().slice(0, 80);
  if (q.length < 2) return sendJson(res, 200, { results: [] });
  try {
    const r = await tmdb('/search/movie', { query: q, include_adult: false, language: 'en-US', page: 1 });
    const results = (r.results || [])
      .filter(m => m.vote_count > 20)
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 6)
      .map(m => ({ id: m.id, title: m.title, year: (m.release_date || '').slice(0, 4) }));
    sendJson(res, 200, { results }, 86400);
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { results: [], error: 'Search is unavailable right now.' });
  }
}
