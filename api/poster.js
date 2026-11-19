// GET /api/poster?path=/abc123.jpg
// Passes a TMDB poster through our own domain, so the share-ticket drawing can use it.
// (Browsers won't let a page turn an image from another site into a downloadable picture.)

module.exports = async function handler(req, res) {
  const path = new URL(req.url, 'http://x').searchParams.get('path') || '';
  if (!/^\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(path)) {
    res.statusCode = 400; return res.end('Bad poster path');
  }
  try {
    const r = await fetch(`https://image.tmdb.org/t/p/w500${path}`);
    if (!r.ok) { res.statusCode = 404; return res.end('Not found'); }
    const buf = Buffer.from(await r.arrayBuffer());
    res.statusCode = 200;
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=604800, immutable');
    res.end(buf);
  } catch (e) {
    res.statusCode = 502; res.end('Poster unavailable');
  }
}
