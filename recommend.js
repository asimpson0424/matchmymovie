// GET /api/recommend?mood=laugh,scary&brain=2&who=date&time=135&era=any&skip=subs,anim&like=12345&round=0
// Returns a ranked pool of ~15 movies with posters, trailer, streaming services and a few hints for the "why" text.
const { tmdb, sendJson, query, MOOD_GENRES } = require('./_tmdb.js');

const MOODS = Object.keys(MOOD_GENRES);
const LIGHT = [35, 28, 12, 10751, 16];       // genres that usually mean "easy to follow"
const HEAVY = [18, 9648, 878, 36, 10752, 80]; // genres that usually ask more attention
const SLOW  = [18, 36, 10752];
const PACY  = [28, 35, 27, 53, 12];

module.exports = async function handler(req, res) {
  try {
    const q = query(req);
    const surprise = q.surprise === '1';
    let moods = (q.mood || '').split(',').filter(m => MOODS.includes(m)).slice(0, 2);
    if (!moods.length) moods = [MOODS[Math.floor(Math.random() * MOODS.length)]];
    const brain = [1, 2, 3].includes(+q.brain) ? +q.brain : null;
    const who = ['alone', 'date', 'friends', 'family'].includes(q.who) ? q.who : null;
    const time = [105, 135].includes(+q.time) ? +q.time : null;
    const era = q.era;
    const skip = (q.skip || '').split(',');
    const likeId = /^\d{1,9}$/.test(q.like || '') ? q.like : null;
    const round = Math.min(Math.max(parseInt(q.round || '0', 10) || 0, 0), 8);

    // Filters TMDB applies for us
    const base = {
      include_adult: false, include_video: false, language: 'en-US',
      'vote_count.gte': 300, 'vote_average.gte': 6.3, 'with_runtime.gte': 75,
      without_genres: [99, 10770, ...(skip.includes('anim') ? [16] : []), ...(skip.includes('dark') ? [27, 10752] : [])].join(','),
    };
    if (time) base['with_runtime.lte'] = time;
    if (era === 'new') base['primary_release_date.gte'] = '2010-01-01';
    if (era === 'classic') base['primary_release_date.lte'] = '1999-12-31';
    if (skip.includes('subs')) base.with_original_language = 'en';
    if (who === 'family') { base.certification_country = 'US'; base['certification.lte'] = 'PG'; }
    else if (skip.includes('dark')) { base.certification_country = 'US'; base['certification.lte'] = 'PG-13'; }

    // Pull candidates: genre-AND for two moods (e.g. horror-comedy), plus a broader OR search
    const pageA = 1 + round * 2 + (surprise ? Math.floor(Math.random() * 6) : 0);
    const orGenres = [...new Set(moods.flatMap(m => MOOD_GENRES[m]))].join('|');
    const calls = [
      tmdb('/discover/movie', { ...base, with_genres: orGenres, sort_by: 'vote_count.desc', page: pageA }),
      tmdb('/discover/movie', { ...base, with_genres: orGenres, sort_by: 'vote_count.desc', page: pageA + 1 }),
      tmdb('/discover/movie', { ...base, with_genres: orGenres, sort_by: 'vote_average.desc', 'vote_count.gte': 1500, page: 1 + round }),
    ];
    if (moods.length === 2) {
      calls.push(tmdb('/discover/movie', { ...base, with_genres: moods.map(m => MOOD_GENRES[m][0]).join(','), sort_by: 'vote_count.desc', page: 1 + round }));
    }
    let likeRecs = new Set(), likeGenres = [];
    if (likeId) {
      calls.push(tmdb(`/movie/${likeId}/recommendations`, { page: 1 }).then(r => { r.results.forEach(m => likeRecs.add(m.id)); return { results: [] }; }).catch(() => ({ results: [] })));
      calls.push(tmdb(`/movie/${likeId}`).then(m => { likeGenres = (m.genres || []).map(g => g.id); return { results: [] }; }).catch(() => ({ results: [] })));
    }
    let firstErr = null;
    const pages = await Promise.all(calls.map(p => p.catch(e => { firstErr = firstErr || e; return { results: [] }; })));
    if (firstErr && pages.every(p => !(p.results || []).length)) throw firstErr;
    const seen = new Map();
    pages.forEach(p => (p.results || []).forEach(m => { if (!seen.has(m.id) && String(m.id) !== likeId) seen.set(m.id, m); }));

    // Score each candidate against the answers
    const scored = [...seen.values()].map(m => {
      const g = m.genre_ids || [];
      const hits = moods.filter(md => MOOD_GENRES[md].some(id => g.includes(id)));
      if (!hits.length) return null;
      let s = hits.length * 8;
      if (moods.length === 2 && hits.length === 2) s += 8;
      if (hits.some(md => g.includes(MOOD_GENRES[md][0]))) s += 3;
      const brainEst = Math.max(1, Math.min(3, 2 + (HEAVY.some(id => g.includes(id)) ? 0.6 : 0) - (LIGHT.some(id => g.includes(id)) ? 0.6 : 0) + (m.vote_average >= 7.8 ? 0.4 : 0)));
      if (brain) s -= Math.abs(brainEst - brain) * 3;
      if (who === 'date' && g.some(id => [10749, 35, 18].includes(id))) s += 2;
      if (who === 'friends' && g.some(id => [35, 28, 27, 53].includes(id))) s += 2;
      if (skip.includes('slow') && g.some(id => SLOW.includes(id)) && !g.some(id => PACY.includes(id))) s -= 5;
      const fromLike = likeRecs.has(m.id);
      if (fromLike) s += 9;
      if (likeGenres.length) s += g.filter(id => likeGenres.includes(id)).length * 1.5;
      s += (m.vote_average - 7) * 3 + Math.log10(Math.max(m.vote_count, 1)) * 0.8;
      s += Math.random() * (surprise ? 8 : 3);
      return { m, s, hits, brainEst: Math.round(brainEst), fromLike };
    }).filter(Boolean).sort((a, b) => b.s - a.s).slice(0, 15);

    // Fetch details for the finalists: runtime, trailer, streaming services, rating certificate
    const details = await Promise.all(scored.map(x =>
      tmdb(`/movie/${x.m.id}`, { append_to_response: 'videos,watch/providers,release_dates' }).catch(() => null)));

    const movies = scored.map((x, i) => {
      const d = details[i]; if (!d) return null;
      const vids = (d.videos?.results || []).filter(v => v.site === 'YouTube');
      const trailer = vids.find(v => v.type === 'Trailer' && v.official) || vids.find(v => v.type === 'Trailer') || vids[0];
      const us = d['watch/providers']?.results?.US || {};
      const cert = (d.release_dates?.results || []).find(r => r.iso_3166_1 === 'US')?.release_dates?.find(r => r.certification)?.certification || '';
      return {
        id: d.id, title: d.title, year: (d.release_date || '').slice(0, 4), runtime: d.runtime || null,
        rating: Math.round((d.vote_average || 0) * 10) / 10, votes: d.vote_count, cert,
        genres: (d.genres || []).map(g => g.name), genreIds: (d.genres || []).map(g => g.id),
        tagline: d.tagline || '', overview: d.overview || '',
        poster: d.poster_path || null, backdrop: d.backdrop_path || null, imdbId: d.imdb_id || null,
        trailerKey: trailer?.key || null,
        stream: (us.flatrate || []).slice(0, 3).map(p => ({ name: p.provider_name, logo: p.logo_path })),
        rentBuy: !!((us.rent || []).length || (us.buy || []).length),
        watchLink: us.link || `https://www.themoviedb.org/movie/${d.id}/watch?locale=US`,
        moodHits: x.hits, brainEst: x.brainEst, fromLike: x.fromLike, original: d.original_language,
      };
    }).filter(Boolean);

    sendJson(res, 200, { movies }, surprise ? 0 : 1800);
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { error: 'Could not reach the movie database. Try again in a moment.', code: e.code || 'error' });
  }
}
