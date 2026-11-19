# MatchMyMovie

Answer a few mood questions and get three movies for tonight, each with a reason it fits.
Live at https://matchmymovie.live

## What's in this folder

| File | What it does |
|---|---|
| `index.html` | The page: look, layout and styles |
| `app.js` | Everything you click: questions, picks, saved list, trailer, share ticket |
| `api/recommend.js` | Turns your answers into a TMDB search and ranks the results |
| `api/search.js` | The "movie you loved" search box |
| `api/trending.js` | The three posters on the home page |
| `api/poster.js` | Lets the share ticket use the real poster |
| `api/_tmdb.js` | Shared settings, including which genres count as which mood |

Your TMDB key is never in these files. The site reads it from Vercel's settings.

## Putting it live

1. **GitHub:** New repository > name it `matchmymovie` > "uploading an existing file" > drag in everything in this folder (including the `api` folder) > Commit.
2. **Vercel:** Add New > Project > Import `matchmymovie`.
3. Before deploying, open **Environment Variables** and add:
   - Name: `TMDB_TOKEN`
   - Value: your TMDB **API Read Access Token** (the long one, from themoviedb.org > Settings > API)
4. Click **Deploy**. In about a minute it's live at `matchmymovie.vercel.app` (or similar).
5. **Your domain:** Vercel project > Settings > Domains > add `matchmymovie.live`. Vercel shows one or two records to copy into the DNS settings where you bought the domain. It can take up to a few hours to start working.

## Changing things later

Edit a file on GitHub (pencil icon) and commit. Vercel redeploys on its own within a minute.

## Rules to stay on TMDB's free plan

- Keep the TMDB credit in the footer (already there).
- No ads, paid features or affiliate links. Making money from the site needs TMDB's commercial license.
