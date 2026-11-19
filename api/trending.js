// GET /api/trending  ->  three popular movies this week, for the fanned cards on the home page
const { tmdb, sendJson } = require('./_tmdb.js');

module.exports = async function handler(req, res) {
  try {
    const r = await tmdb('/trending/movie/week', { language: 'en-US' });
    const movies = (r.results || [])
      .filter(m => m.poster_path && m.vote_count > 50)
      .slice(0, 3)
      .map(m => ({ id: m.id, title: m.title, year: (m.release_date || '').slice(0, 4), rating: Math.round(m.vote_average * 10) / 10, poster: m.poster_path }));
    sendJson(res, 200, { movies }, 21600);
  } catch (e) {
    console.error(e);
    sendJson(res, 200, { movies: [] });
  }
}
