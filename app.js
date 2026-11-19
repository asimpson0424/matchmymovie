/* MatchMyMovie front end. Talks to our own /api/* functions, which talk to TMDB. */

/* ---------- Questions ---------- */
const Q = [
 {key:"mood",type:"multi",max:2,q:"What are you in the mood for?",hint:"Pick one, or two to mix them.",opts:[
   ["laugh","Make me laugh","Something funny"],
   ["tense","Edge of my seat","Thrillers, action, suspense"],
   ["moved","A good cry","Heartfelt stuff"],
   ["wow","Blow my mind","Big ideas, spectacle"],
   ["scary","Spook me","Horror, jumps, dread"]]},
 {key:"like",type:"text",q:"Name a movie you loved lately",hint:"Optional. We'll look for picks with the same feel."},
 {key:"brain",q:"How much brainpower do you have left?",opts:[
   [1,"Running on empty","Easy to follow, pure fun"],
   [2,"A normal amount","Engaging, but not homework"],
   [3,"Give me something to chew on","Twisty, layered, makes you think"]]},
 {key:"who",q:"Who's watching?",opts:[
   ["alone","Just me",""],
   ["date","Date night",""],
   ["friends","Friends",""],
   ["family","Family with kids","Kid-friendly picks only"]]},
 {key:"time",q:"How much time do you have?",opts:[
   [105,"Keep it short","Under about 1 hr 45 min"],
   [135,"A normal movie","Up to about 2 hr 15 min"],
   [999,"Got all night","Long is fine"]]},
 {key:"era",q:"New or old?",opts:[
   ["new","Newer","2010 and later"],
   ["classic","Classics","Before 2000"],
   ["any","Doesn't matter",""]]},
 {key:"skip",type:"multi",max:5,optional:true,q:"Anything you'd rather skip?",hint:"Pick any that apply, or none.",opts:[
   ["subs","Subtitles",""],
   ["anim","Animation",""],
   ["dark","Anything too dark or violent",""],
   ["slow","Slow burns","Movies that take a while to get going"]]}
];
const SHORT = ["mood","like","who","time"];
const LONG  = ["mood","like","brain","who","time","era","skip"];

const IMG = "https://image.tmdb.org/t/p/";
const MOOD_GENRES = {laugh:[35], tense:[53,28,80,9648], moved:[18,10749], wow:[878,12,14], scary:[27]};
const moodWords = {laugh:"to laugh",tense:"to be on the edge of your seat",moved:"something that hits you",wow:"to be blown away",scary:"to be scared"};
const brainWords = {1:"easy to follow",2:"engaging without being homework",3:"layered enough to chew on"};
const whoWords = {alone:"great on your own",date:"a good date-night pick",friends:"fun with a group",family:"rated for the whole family"};
const MOODCOL = {laugh:"var(--laugh)",tense:"var(--tense)",moved:"var(--moved)",wow:"var(--wow)",scary:"var(--scary)"};
const MOODHEX = {laugh:"#FFB547",tense:"#8EC5FF",moved:"#FFB3C7",wow:"#B9A7FF",scary:"#7ED9B4"};
const SV = (d,w=30) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="#1F2350" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const MOODICON = {
  laugh:'<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2.5 4 2.5 4-2.5 4-2.5"/><path d="M9 9.5h.01M15 9.5h.01"/>',
  tense:'<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  moved:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  wow:'<path d="M12 3l2.2 5.6L20 9.3l-4.5 3.9 1.4 5.8L12 16l-4.9 3 1.4-5.8L4 9.3l5.8-.7z"/>',
  scary:'<path d="M5 21V10a7 7 0 0 1 14 0v11l-2.5-2-2.3 2-2.2-2-2.2 2-2.3-2z"/><path d="M9.5 10h.01M14.5 10h.01"/>'
};
const HEART = '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>';

let A = {}, QS = [], step = 0, sel = [], editing = false;
let pool = [], shown = [], hidden = new Set(), round = 0, loading = false;
const app = document.getElementById('app');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtLong = n => !n ? '' : (n%60 ? `${Math.floor(n/60)} hr ${n%60} min` : `${Math.floor(n/60)} hr`);
const cap = s => s ? s[0].toUpperCase()+s.slice(1) : s;
const andJoin = a => a.length<=1 ? a.join("") : a.slice(0,-1).join(", ") + " and " + a[a.length-1];
const moodOf = m => (m.moodHits && m.moodHits[0]) || Object.keys(MOOD_GENRES).find(k => MOOD_GENRES[k].some(g => (m.genreIds||[]).includes(g))) || 'laugh';
const byId = id => pool.find(m => m.id === id) || LIST.find(m => m.id === id);

/* ---------- Home ---------- */
let TRENDING = null;
function mini(m, cls){
  const art = m.poster ? `<img src="${IMG}w342${m.poster}" alt="" loading="lazy">` : '';
  return `<div class="mini ${cls}"><div class="tile" title="${esc(m.title)}" style="background:${MOODHEX[['wow','laugh','moved'][cls.slice(-1)-1]]}">${art}<span>${esc(m.title)}</span></div>
    <div class="row2"><span>${esc(m.year)}</span>${m.rating?`<span class="score">★ ${m.rating.toFixed(1)}</span>`:''}</div></div>`;
}
function fanHTML(){
  const ms = (TRENDING && TRENDING.length===3) ? TRENDING
    : [{title:"Arrival",year:"2016"},{title:"Paddington 2",year:"2017"},{title:"Knives Out",year:"2019"}];
  return `${mini(ms[0],'m1')}${mini(ms[1],'m2')}${mini(ms[2],'m3')}`;
}
async function loadTrending(){
  if (TRENDING) return;
  try { const r = await fetch('/api/trending'); const d = await r.json(); TRENDING = d.movies || [];
    const fan = document.querySelector('.fan'); if (fan && TRENDING.length===3) fan.innerHTML = fanHTML(); } catch(e){}
}
function start(){
  document.body.classList.add('wide');
  A = {}; step = 0; hidden = new Set(); editing = false;
  document.getElementById('restart').style.display='none';
  const moodQ = Q.find(q=>q.key==='mood');
  app.innerHTML = `
    <div class="home">
      <div class="home-hero">
        <div class="home-copy">
          <h1>Movie night, sorted.</h1>
          <p class="lede">Tell us how you're feeling and we'll hand you three movies to pick from, each with a reason it fits tonight.</p>
          <div class="home-btns">
            <button class="btn" onclick="begin('short')">Quick pick, 4 questions</button>
            <button class="btn white" onclick="begin('long')">In-depth, 7 questions</button>
          </div>
          <button class="lucky" onclick="surprise()">${SV('<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" fill="#1F2350"/><circle cx="12" cy="12" r="1.2" fill="#1F2350"/><circle cx="15.5" cy="15.5" r="1.2" fill="#1F2350"/>',22)}Feeling lucky? Just pick for me</button>
        </div>
        <div class="fan" aria-hidden="true">${fanHTML()}</div>
      </div>
      <section class="panel">
        <h3>Or start with a mood</h3>
        <p>Tap one and we'll take it from there.</p>
        <div class="moods">${moodQ.opts.map(o=>`<button class="moodbtn" style="background:${MOODCOL[o[0]]}" onclick="begin('short','${o[0]}')">${SV(MOODICON[o[0]],24)}${o[1]}</button>`).join('')}</div>
      </section>
    </div>`;
  loadTrending();
}
function surprise(){
  const moods = Object.keys(MOOD_GENRES);
  A = {mood:[moods[Math.floor(Math.random()*moods.length)]], surprise:true};
  QS = []; hidden = new Set(); editing = false; round = 0;
  results();
}
function begin(mode, mood){
  QS = (mode==='short' ? SHORT : LONG).map(k=>Q.find(q=>q.key===k));
  A = {}; step = 0; hidden = new Set(); editing = false; round = 0;
  if (mood){ A.mood = [mood]; step = 1; }
  ask();
}

/* ---------- Questions ---------- */
function ask(){
  document.body.classList.remove('wide');
  document.getElementById('restart').style.display='inline';
  const q = QS[step];
  let body = "";
  if (q.type==="text"){
    body = `
      <form class="likeform" onsubmit="event.preventDefault();submitLike()" autocomplete="off">
        <label for="like" class="hint" style="display:block;margin-bottom:10px">${q.hint}</label>
        <input id="like" class="textin" role="combobox" aria-expanded="false" aria-controls="sugg" aria-autocomplete="list" placeholder="Start typing a title" value="${A.like?esc(A.like.title):''}" oninput="suggest(this.value)" onkeydown="suggestKeys(event)">
        <ul id="sugg" class="sugg" role="listbox" hidden></ul>
        <div id="likemsg" class="likemsg" role="status"></div>
        <div class="row"><button class="btn" type="submit">Use this movie</button><button class="linkbtn" type="button" onclick="A.like=null;next()">Skip</button></div>
      </form>`;
  } else if (q.type==="multi"){
    sel = Array.isArray(A[q.key]) ? [...A[q.key]] : [];
    const isMood = q.key==='mood';
    body = `<div class="opts${isMood?' tiles':''}">${q.opts.map((o,i)=>`
      <button class="opt${sel.includes(o[0])?' on':''}" aria-pressed="${sel.includes(o[0])}" onclick="toggle(${i})" ${isMood?`style="background:${MOODCOL[o[0]]}"`:''}>
        ${isMood?SV(MOODICON[o[0]]):''}<span>${o[1]}${o[2]?`<small>${o[2]}</small>`:''}</span></button>`).join('')}</div>
      <div class="row"><button class="btn${isMood?' full':''}" id="cont" onclick="nextMulti()" ${(!q.optional && !sel.length)?'disabled':''}>${q.optional && !sel.length ? 'None of these' : (editing?'Update my picks':'Continue')}</button></div>`;
  } else {
    body = `<div class="opts">${q.opts.map((o,i)=>`
      <button class="opt${A[q.key]===o[0]?' on':''}" onclick="pick(${i})">${o[1]}${o[2]?`<small>${o[2]}</small>`:''}</button>`).join('')}</div>`;
  }
  const canBack = editing || step>0;
  app.innerHTML = `
    <div class="qtop">
      ${canBack?`<button class="round" onclick="back()" aria-label="${editing?'Back to my picks':'Back'}">${SV('<path d="M15 18l-6-6 6-6"/>',20)}</button>`:'<span style="width:44px"></span>'}
      ${editing?'<span style="font-weight:700">Change your answer</span>':`<div class="dots" aria-label="Question ${step+1} of ${QS.length}">${QS.map((_,i)=>`<span class="${i<step?'done':(i===step?'now':'')}"></span>`).join('')}</div>`}
      <span class="stepn">${editing?'':`${step+1} of ${QS.length}`}</span>
    </div>
    <h2>${q.q}</h2>${q.hint && q.type!=="text"?`<p class="hint">${q.hint}</p>`:''}
    ${body}`;
  if (q.type==="text") document.getElementById('like').focus();
}
function next(){ if (editing){ editing=false; round=0; return results(); } step++; step < QS.length ? ask() : results(); }
function pick(i){ A[QS[step].key] = QS[step].opts[i][0]; next(); }
function back(){ if (editing){ editing=false; return render(); } step--; ask(); }
function toggle(i){
  const q = QS[step], v = q.opts[i][0];
  if (sel.includes(v)) sel = sel.filter(x=>x!==v);
  else { if (sel.length>=q.max) sel.shift(); sel.push(v); }
  A[q.key] = [...sel];
  ask();
}
function nextMulti(){ A[QS[step].key] = [...sel]; next(); }

/* "Movie you loved" search box */
let suggTimer = null, suggList = [], suggIdx = -1;
function suggest(v){
  clearTimeout(suggTimer);
  document.getElementById('likemsg').textContent = '';
  if (v.trim().length < 2) return showSugg([]);
  suggTimer = setTimeout(async ()=>{
    try { const r = await fetch('/api/search?q='+encodeURIComponent(v.trim())); const d = await r.json(); showSugg(d.results||[]); }
    catch(e){ showSugg([]); }
  }, 220);
}
function showSugg(list){
  suggList = list; suggIdx = -1;
  const ul = document.getElementById('sugg'), inp = document.getElementById('like'); if (!ul) return;
  ul.hidden = !list.length; inp.setAttribute('aria-expanded', String(!!list.length));
  ul.innerHTML = list.map((m,i)=>`<li role="option" id="sg${i}" onmousedown="event.preventDefault();chooseSugg(${i})">${esc(m.title)} <span>${esc(m.year)}</span></li>`).join('');
}
function suggestKeys(e){
  if (!suggList.length) return;
  if (e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); suggIdx = (suggIdx + (e.key==='ArrowDown'?1:-1) + suggList.length) % suggList.length;
    document.querySelectorAll('#sugg li').forEach((li,i)=>li.classList.toggle('on', i===suggIdx));
    document.getElementById('like').setAttribute('aria-activedescendant','sg'+suggIdx); }
  if (e.key==='Enter' && suggIdx>=0){ e.preventDefault(); chooseSugg(suggIdx); }
  if (e.key==='Escape') showSugg([]);
}
function chooseSugg(i){ const m = suggList[i]; A.like = {id:m.id, title:m.title}; showSugg([]); document.getElementById('like').value = m.title; next(); }
function submitLike(){
  const val = document.getElementById('like').value.trim();
  if (!val){ A.like=null; return next(); }
  if (A.like && A.like.title.toLowerCase()===val.toLowerCase()) return next();
  const m = suggList.find(s=>s.title.toLowerCase()===val.toLowerCase()) || suggList[0];
  if (m){ A.like = {id:m.id, title:m.title}; return next(); }
  document.getElementById('likemsg').textContent = `We couldn't find "${val}". Pick one of the suggestions as you type, or skip this question.`;
}

/* ---------- Results ---------- */
function params(){
  const p = new URLSearchParams();
  if (A.mood) p.set('mood', A.mood.join(','));
  if (A.brain) p.set('brain', A.brain);
  if (A.who) p.set('who', A.who);
  if (A.time) p.set('time', A.time);
  if (A.era) p.set('era', A.era);
  if (A.skip && A.skip.length) p.set('skip', A.skip.join(','));
  if (A.like) p.set('like', A.like.id);
  if (A.surprise) p.set('surprise', '1');
  p.set('round', round);
  return p.toString();
}
async function results(){
  document.body.classList.remove('wide');
  document.getElementById('restart').style.display='inline';
  loading = true;
  app.innerHTML = `<div class="loadwrap" role="status"><div class="reel" aria-hidden="true"></div><h2>Finding your matches…</h2><p class="hint">Checking thousands of movies against your answers.</p></div>`;
  try {
    const r = await fetch('/api/recommend?' + params());
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'error');
    pool = (d.movies || []).filter(m => !hidden.has(m.id));
  } catch(e){
    loading = false;
    app.innerHTML = `<div class="results-head"><h2>We couldn't reach the movie database</h2><p>Check your connection and try again.</p></div>
      <div class="footer-actions"><button class="btn" onclick="results()">Try again</button><button class="btn white" onclick="start()">Start over</button></div>`;
    return;
  }
  loading = false;
  shown = pool.slice(0,3);
  render();
}
function nextFromPool(){ const used = new Set(shown.map(m=>m.id)); return pool.find(m=>!hidden.has(m.id) && !used.has(m.id)); }
function swap(i){
  hidden.add(shown[i].id);
  const n = nextFromPool();
  if (n) { shown[i] = n; render(false); }
  else { shown.splice(i,1); if (!shown.length){ round++; results(); } else render(false); }
}
function reshuffle(){
  shown.forEach(m=>hidden.add(m.id));
  const fresh = pool.filter(m=>!hidden.has(m.id)).slice(0,3);
  if (fresh.length===3){ shown = fresh; render(); window.scrollTo({top:0,behavior:'smooth'}); }
  else { round++; results(); }
}

function reason(m){
  const hook = m.tagline || (m.overview||'').split(/(?<=[.!?])\s/)[0] || '';
  const hookTxt = hook ? ` <span class="hook">${esc(hook.length>170 ? hook.slice(0,167)+'…' : hook)}</span>` : '';
  if (A.surprise) return `${esc(andJoin(m.genres.slice(0,2)))}, picked at random.${hookTxt}`;
  const moods = (m.moodHits||[]).filter(x=>(A.mood||[]).includes(x));
  const fits = [];
  if (A.brain && m.brainEst===A.brain) fits.push(brainWords[A.brain]);
  if (A.who==='family' || (A.who && whoFits(m))) fits.push(whoWords[A.who]);
  if (m.runtime && A.time && A.time<999 && m.runtime<=A.time) fits.push(`a fit for your time at ${fmtLong(m.runtime)}`);
  let txt = `You wanted ${andJoin(moods.map(x=>moodWords[x]))}${fits.length?`, and this one is ${andJoin(fits)}`:''}.`;
  if (A.like && m.fromLike) txt += ` People who loved ${esc(A.like.title)} love this one too.`;
  return txt + hookTxt;
}
function whoFits(m){
  const g = m.genreIds||[];
  if (A.who==='date') return g.some(id=>[10749,35,18].includes(id));
  if (A.who==='friends') return g.some(id=>[35,28,27,53].includes(id));
  return A.who==='alone';
}

function answerChips(){
  if (A.surprise) return `<div class="answers"><button class="chip-edit" onclick="begin('short')">Answer a few questions instead</button></div>`;
  const out = [];
  QS.forEach((q,i)=>{
    const v = A[q.key]; let label = "";
    if (q.key==="mood") label = (v||[]).map(x=>q.opts.find(o=>o[0]===x)[1]).join(" + ");
    else if (q.key==="like") label = v ? `Like ${v.title}` : "+ Add a movie you loved";
    else if (q.key==="skip") label = (v&&v.length) ? "Skip: " + v.map(x=>q.opts.find(o=>o[0]===x)[1].toLowerCase()).join(", ") : "Nothing to skip";
    else { const o = q.opts.find(o=>o[0]===v); label = o ? o[1] : ""; }
    if (label) out.push(`<button class="chip-edit" onclick="edit(${i})" title="Change this answer">${esc(label)}</button>`);
  });
  return `<div class="answers">${out.join('')}</div>`;
}
function edit(i){ editing = true; step = i; hidden = new Set(); ask(); }

function render(animate=true){
  document.body.classList.remove('wide');
  if (!shown.length){
    app.innerHTML = `<div class="results-head"><h2>Nothing matched all of that</h2>
      <p>Tap an answer below to loosen it, like a longer running time, either era or fewer things to skip.</p></div>
      ${answerChips()}
      <div class="footer-actions"><button class="btn" onclick="start()">Start over</button></div>`;
    return;
  }
  app.innerHTML = `
    <div class="results-head"><h2>${A.surprise?'Your lucky lineup':"Here's your lineup"}</h2>
      <p>${A.surprise?'Three picks at random. Not feeling them? Roll again.':'Tap an answer to change it.'}</p></div>
    ${answerChips()}
    <div id="cards" class="picks${animate?' reveal':''}">${shown.map((m,i)=>card(m,i)).join('')}</div>
    <div class="footer-actions">
      <button class="btn white" onclick="${A.surprise?'surprise()':'reshuffle()'}">Show me three more</button>
      <button class="btn white" onclick="start()">Start over</button>
    </div>`;
  if (animate){ const c = document.getElementById('cards'); setTimeout(()=>c && c.classList.remove('reveal'), 1200); }
}

function streamLine(m){
  if (m.stream && m.stream.length) return `<div class="stream">${m.stream.map(p=>`<img src="${IMG}w92${p.logo}" alt="" width="26" height="26">`).join('')}<span>On ${esc(andJoin(m.stream.map(p=>p.name)))}</span></div>`;
  if (m.rentBuy) return `<div class="stream"><span>Not on a subscription right now. Rent or buy it.</span></div>`;
  return '';
}
function card(m, i, o={}){
  const saved = LIST.some(x=>x.id===m.id);
  const mood = moodOf(m);
  const heart = o.listed
    ? `<button class="pill" onclick="toggleSave(${m.id});showList()">Remove</button>`
    : `<button class="heart${saved?' saved':''}" data-save="${m.id}" aria-pressed="${saved}" aria-label="${saved?'Saved to my list':'Save for later'}" onclick="toggleSave(${m.id})">${SV(HEART,20)}</button>`;
  const facts = [m.year, fmtLong(m.runtime), m.cert].filter(Boolean).map(esc).join(', ');
  const imdb = m.imdbId ? `https://www.imdb.com/title/${m.imdbId}/` : `https://www.themoviedb.org/movie/${m.id}`;
  return `<article class="pick" style="--i:${i}">
    <div class="pick-top">
      <div class="poster" style="background:${MOODCOL[mood]}">${m.poster?`<img src="${IMG}w342${m.poster}" alt="Poster for ${esc(m.title)}" loading="lazy">`:esc(m.title)}</div>
      <div style="flex:1;min-width:0">
        <h3>${esc(m.title)}</h3>
        <div class="facts">
          ${m.rating?`<a class="score" href="${imdb}" target="_blank" rel="noopener" title="TMDB user score. Opens the movie's page">★ ${m.rating.toFixed(1)}</a>`:''}
          <span>${facts}</span>
        </div>
        <p class="why">${o.why || reason(m)}</p>
        ${streamLine(m)}
      </div>
    </div>
    <div class="pick-actions">
      ${m.trailerKey
        ? `<button class="pill" onclick="openTrailer('${esc(m.trailerKey)}','${esc(m.title).replace(/'/g,"&#39;")}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="#1F2350" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>Trailer</button>`
        : `<a class="pill" href="https://www.youtube.com/results?search_query=${encodeURIComponent(m.title+' '+m.year+' trailer')}" target="_blank" rel="noopener">Trailer</a>`}
      <a class="pill" href="${esc(m.watchLink)}" target="_blank" rel="noopener">Where to watch</a>
      <span class="sp"></span>${heart}
    </div>
    <button class="btn full pickbtn" onclick="chooseMovie(${m.id})">${SV('<path d="M3 9a2 2 0 0 0 0 4v5a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-5a2 2 0 0 0 0-4V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z"/><path d="M14 5v14" stroke-dasharray="2 2.5"/>',20)}We're watching this one</button>
    ${o.listed?'':`<div class="swaps"><span>Not this one?</span>
      <button onclick="swap(${i})">Seen it</button><button onclick="swap(${i})">Can't stream it</button><button onclick="swap(${i})">Not tonight</button></div>`}
  </article>`;
}

/* ---------- Trailer ---------- */
function openTrailer(key, title){
  const ov = document.getElementById('share');
  ov.innerHTML = `<div class="share-panel wide-panel" role="dialog" aria-modal="true" aria-label="Trailer for ${title}">
    <button class="round share-x" onclick="closeShare()" aria-label="Close">${SV('<path d="M6 6l12 12M18 6L6 18"/>',20)}</button>
    <h2 style="font-size:28px;padding-right:50px">${title}</h2>
    <div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(key)}?autoplay=1&rel=0" title="Trailer for ${title}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>
  </div>`;
  ov.hidden = false; document.body.style.overflow='hidden';
  ov.querySelector('.share-x').focus();
}

/* ---------- Saved list (this browser only) ---------- */
let LIST = [];
try { LIST = JSON.parse(localStorage.getItem('mmm_list')||'[]'); if (!Array.isArray(LIST)) LIST = []; } catch(e){ LIST = []; }
function saveList(){ try { localStorage.setItem('mmm_list', JSON.stringify(LIST)); } catch(e){} updateCount(); }
function updateCount(){ document.getElementById('listcount').textContent = LIST.length; }
function toggleSave(id){
  const m = byId(id); if (!m) return;
  LIST = LIST.some(x=>x.id===id) ? LIST.filter(x=>x.id!==id) : [...LIST, m];
  saveList();
  document.querySelectorAll(`[data-save="${id}"]`).forEach(b=>{
    const on = LIST.some(x=>x.id===id); b.classList.toggle('saved', on); b.setAttribute('aria-pressed', on);
    b.setAttribute('aria-label', on ? 'Saved to my list' : 'Save for later');
  });
}
function showList(){
  document.body.classList.remove('wide');
  document.getElementById('restart').style.display='inline';
  app.innerHTML = `<div class="results-head"><h2>My list</h2>
    <p>${LIST.length ? 'Movies you saved for another night. This list lives in this browser.' : 'Nothing saved yet. Tap the heart on any pick and it shows up here.'}</p></div>
    <div class="picks" style="margin-top:22px">${LIST.map((m,i)=>card(m,i,{why:esc(m.tagline || (m.overview||'').split(/(?<=[.!?])\s/)[0] || ''), listed:true})).join('')}</div>
    <div class="footer-actions"><button class="btn" onclick="start()">Find a movie</button></div>`;
}

/* ---------- Share your ticket ---------- */
const SEAT = {alone:"Prime spot", date:"Side by side", friends:"First come", family:"Whole couch"};
const ADMIT2 = {alone:["Admit","one"], date:["Admit","two"], friends:["Admit","the crew"], family:["Admit","the family"]};
let shareBlob = null, shareMovie = null;

function rr(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function wrap(ctx,text,maxW){ const words=text.split(' '), lines=[]; let line='';
  words.forEach(w=>{ const t=line?line+' '+w:w; if(ctx.measureText(t).width>maxW && line){ lines.push(line); line=w; } else line=t; });
  if(line) lines.push(line); return lines; }
function ticketPath(ctx,x,y,w,h,r,ny,nr){
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,ny-nr); ctx.arc(x+w,ny,nr,-Math.PI/2,Math.PI/2,true);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,ny+nr); ctx.arc(x,ny,nr,Math.PI/2,-Math.PI/2,true);
  ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
}
function loadImg(src){ return new Promise(res=>{ const im = new Image(); im.onload=()=>res(im); im.onerror=()=>res(null); im.src=src; setTimeout(()=>res(null),6000); }); }

async function drawTicket(m){
  try { await Promise.all([document.fonts.load('800 80px "Bricolage Grotesque"'), document.fonts.load('600 40px "Figtree"'), document.fonts.load('700 40px "Figtree"')]); } catch(e){}
  const poster = m.poster ? await loadImg('/api/poster?path='+encodeURIComponent(m.poster)) : null;
  const W=1080, H=1920, c=document.createElement('canvas'); c.width=W; c.height=H;
  const x=c.getContext('2d'), ink='#1F2350', cream='#FFE9A8', coral='#FF6A4D', D='"Bricolage Grotesque", sans-serif', B='"Figtree", sans-serif';
  const bg = MOODHEX[moodOf(m)];
  const who = A.who || 'alone';
  x.fillStyle=bg; x.fillRect(0,0,W,H);
  let seed=[...m.title].reduce((a,ch)=>a*31+ch.charCodeAt(0),7)>>>0; const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  for(let i=0;i<70;i++){ const px=rnd()*W, py=rnd()*H, s=6+rnd()*10; x.globalAlpha=0.16+rnd()*0.14;
    if(rnd()<0.75){ x.fillStyle=rnd()<0.5?ink:'#FFFFFF'; x.beginPath(); x.arc(px,py,s/2,0,Math.PI*2); x.fill(); }
    else { x.fillStyle='#FFFFFF'; x.save(); x.translate(px,py); x.rotate(rnd()*Math.PI); x.beginPath();
      for(let k=0;k<10;k++){ const r2=k%2?s*0.9:s*2.2, a=k*Math.PI/5; x.lineTo(Math.cos(a)*r2,Math.sin(a)*r2);} x.closePath(); x.fill(); x.restore(); } }
  x.globalAlpha=1;
  // brand + date chip
  x.fillStyle=coral; rr(x,80,96,76,76,22); x.fill(); x.lineWidth=6; x.strokeStyle=ink; x.stroke();
  x.save(); x.translate(118,136); x.strokeStyle=ink; x.lineWidth=4.5; x.lineCap='round'; x.lineJoin='round';
  x.beginPath(); x.moveTo(-15,-6); x.lineTo(-11,22); x.lineTo(11,22); x.lineTo(15,-6); x.closePath(); x.stroke();
  x.beginPath(); x.moveTo(-4,-6); x.lineTo(-3,22); x.moveTo(4,-6); x.lineTo(3,22); x.stroke();
  x.fillStyle=cream; [[-9,-12,8],[0,-17,9],[9,-12,8]].forEach(([a,b2,r0])=>{ x.beginPath(); x.arc(a,b2,r0,0,Math.PI*2); x.fill(); x.stroke(); }); x.restore();
  x.fillStyle=ink; x.textBaseline='middle'; x.font=`800 44px ${D}`; x.fillText("MatchMyMovie",176,136);
  const dateStr = new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  x.font=`700 34px ${B}`; const dw=x.measureText(dateStr).width+48;
  x.fillStyle='#FFFFFF'; rr(x,W-80-dw,104,dw,64,32); x.fill(); x.lineWidth=5; x.stroke(); x.fillStyle=ink; x.fillText(dateStr,W-80-dw+24,137);
  x.textBaseline='alphabetic'; let hs=96; x.font=`800 ${hs}px ${D}`; while(x.measureText("Tonight we're watching").width>W-160 && hs>60){ hs-=4; x.font=`800 ${hs}px ${D}`; } x.fillText("Tonight we're watching", 80, 330);
  // layout
  const tx=80, ty=400, tw=920, nr=42, px=tx+44, py=ty+44, pw=tw-88;
  const hookSrc = m.tagline || (m.overview||'').split(/(?<=[.!?])\s/)[0] || '';
  x.font=`500 42px ${B}`; const hook = hookSrc ? wrap(x,hookSrc,pw).slice(0,3) : [];
  if (hook.length===3 && wrap(x,hookSrc,pw).length>3) hook[2] = hook[2].replace(/\s*\S*$/,'') + '…';
  const ph = hook.length<=2 ? 660 : 600;
  const metaY = py+ph+86, hookY = metaY+78, hookEnd = hookY+Math.max(hook.length-1,0)*58;
  const notchY = hookEnd+86, th = (notchY-ty)+330;
  x.fillStyle=ink; x.save(); x.translate(20,22); ticketPath(x,tx,ty,tw,th,52,notchY,nr); x.fill(); x.restore();
  x.fillStyle=bg; [tx,tx+tw].forEach(cx0=>{ x.beginPath(); x.arc(cx0,notchY,nr+2,0,Math.PI*2); x.fill(); });
  x.fillStyle='#FFFFFF'; ticketPath(x,tx,ty,tw,th,52,notchY,nr); x.fill(); x.lineWidth=8; x.strokeStyle=ink; x.stroke();
  // feature tile: the real poster when we have it, else a starry navy panel
  x.save(); rr(x,px,py,pw,ph,34); x.clip(); x.fillStyle=ink; x.fillRect(px,py,pw,ph);
  if (poster){
    const s = Math.max(pw/poster.width, ph/poster.height), iw=poster.width*s, ih=poster.height*s;
    x.drawImage(poster, px+(pw-iw)/2, py+(ph-ih)*0.25, iw, ih);
    const gr=x.createLinearGradient(0,py+ph*0.35,0,py+ph); gr.addColorStop(0,'rgba(31,35,80,0)'); gr.addColorStop(1,'rgba(31,35,80,0.95)');
    x.fillStyle=gr; x.fillRect(px,py,pw,ph);
  } else {
    const g=x.createRadialGradient(px+pw*0.25,py-40,20,px+pw*0.25,py-40,ph*1.05); g.addColorStop(0,bg); g.addColorStop(1,'rgba(31,35,80,0)');
    x.globalAlpha=0.55; x.fillStyle=g; x.fillRect(px,py,pw,ph); x.globalAlpha=1;
  }
  x.restore();
  let fs=128; x.font=`800 ${fs}px ${D}`; let tl=wrap(x,m.title,pw-90);
  while((tl.length>3 || tl.some(l=>x.measureText(l).width>pw-90)) && fs>58){ fs-=6; x.font=`800 ${fs}px ${D}`; tl=wrap(x,m.title,pw-90); }
  x.fillStyle=cream; x.shadowColor='rgba(0,0,0,.35)'; x.shadowBlur=18; tl.forEach((l,i)=>x.fillText(l, px+46, py+ph-50-(tl.length-1-i)*fs*0.96)); x.shadowBlur=0;
  x.lineWidth=6; x.strokeStyle=ink; rr(x,px,py,pw,ph,34); x.stroke();
  // sticker
  const [a1,a2]=ADMIT2[who]||ADMIT2.alone; x.save(); x.translate(px+pw-120, py+120); x.rotate(-0.22);
  x.fillStyle=ink; x.beginPath(); x.arc(8,10,104,0,Math.PI*2); x.fill();
  x.fillStyle=coral; x.beginPath(); x.arc(0,0,104,0,Math.PI*2); x.fill(); x.lineWidth=6; x.strokeStyle=ink; x.stroke();
  x.setLineDash([10,9]); x.lineWidth=3; x.beginPath(); x.arc(0,0,86,0,Math.PI*2); x.stroke(); x.setLineDash([]);
  x.fillStyle=ink; x.textAlign='center'; x.font=`700 30px ${B}`; x.fillText(a1,0,-14);
  let sf=54; x.font=`800 ${sf}px ${D}`; while(x.measureText(a2).width>148 && sf>28){ sf-=2; x.font=`800 ${sf}px ${D}`; } x.fillText(a2,0,30+sf*0.15); x.textAlign='left'; x.restore();
  // meta + pitch
  let mx=px; x.font=`700 42px ${B}`;
  if(m.rating){ const lab=`★ ${m.rating.toFixed(1)}`; const lw=x.measureText(lab).width; x.fillStyle='#F5C518'; rr(x,mx,metaY-46,lw+34,62,14); x.fill(); x.lineWidth=4; x.strokeStyle=ink; x.stroke(); x.fillStyle=ink; x.fillText(lab,mx+17,metaY); mx+=lw+64; }
  x.fillStyle=ink; x.font=`600 40px ${B}`; x.fillText([m.year, (m.genres||[]).slice(0,2).join(', ')].filter(Boolean).join('   '), mx, metaY);
  x.font=`500 42px ${B}`; hook.forEach((l,i)=>x.fillText(l,px,hookY+i*58));
  // perforation + stub
  x.setLineDash([20,16]); x.lineWidth=5; x.strokeStyle='#CFC6E8'; x.beginPath(); x.moveTo(tx+nr+16,notchY); x.lineTo(tx+tw-nr-16,notchY); x.stroke(); x.setLineDash([]);
  const fy=notchY+82, cols=[["Showtime","Tonight"],["Runtime",fmtLong(m.runtime)||"Feature length"],["Seat",SEAT[who]||"Prime spot"]];
  cols.forEach(([lab,val],i)=>{ const fx=px+i*(pw/3); x.fillStyle='#5C5F86'; x.font=`700 28px ${B}`; x.fillText(lab,fx,fy); x.fillStyle=ink; let vf=44; x.font=`800 ${vf}px ${D}`; while(x.measureText(val).width>pw/3-24 && vf>30){ vf-=2; x.font=`800 ${vf}px ${D}`; } x.fillText(val,fx,fy+54); });
  const by=fy+100, bh=86; let bx=px; seed=[...m.title].reduce((a,ch)=>a*17+ch.charCodeAt(0),3)>>>0; x.fillStyle=ink;
  while(bx<px+pw-6){ const bw=[3,5,8][Math.floor(rnd()*3)]; x.fillRect(bx,by,bw,bh); bx+=bw+[4,6,9][Math.floor(rnd()*3)]; }
  x.fillStyle=ink; x.font=`700 38px ${B}`; x.textAlign='center'; x.fillText("Find your match at matchmymovie.live", W/2, Math.min(H-60, ty+th+130)); x.textAlign='left';
  let out = null;
  try { out = await new Promise(res=>c.toBlob(b=>res({blob:b, url:c.toDataURL('image/png')}),'image/png')); } catch(e){ out = null; }
  return out;
}

async function chooseMovie(id){
  const m = byId(id); if(!m) return;
  shareMovie = m;
  const ov = document.getElementById('share');
  ov.innerHTML = `<div class="share-panel" role="dialog" aria-modal="true" aria-labelledby="share-h">
      <button class="round share-x" onclick="closeShare()" aria-label="Close">${SV('<path d="M6 6l12 12M18 6L6 18"/>',20)}</button>
      <h2 id="share-h">Enjoy the movie!</h2>
      <p class="hint">Here's your ticket for tonight. Send it to whoever's watching with you.</p>
      <div class="share-img"><span>Printing your ticket…</span></div>
      <div class="share-btns">
        <button class="btn" id="sharebtn" onclick="doShare()">${SV('<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 3v12"/><path d="M7 8l5-5 5 5"/>',20)}Share ticket</button>
        <button class="btn white" onclick="copyCaption()">Copy text</button>
      </div>
      <p class="share-msg" id="sharemsg" role="status"></p>
    </div>`;
  ov.hidden = false; document.body.style.overflow='hidden';
  document.getElementById('sharebtn').focus();
  const out = await drawTicket(m);
  if (!out){ ov.querySelector('.share-img').innerHTML = '<span>We couldn\'t draw the ticket this time. "Copy text" still works.</span>'; return; }
  shareBlob = out.blob;
  ov.querySelector('.share-img').innerHTML = `<img src="${out.url}" alt="Ticket image: tonight we're watching ${esc(m.title)}">`;
}
function closeShare(){ const ov=document.getElementById('share'); ov.hidden=true; ov.innerHTML=''; document.body.style.overflow=''; }
function shareText(){ return `Tonight we're watching ${shareMovie.title} (${shareMovie.year}). Matched with MatchMyMovie: https://matchmymovie.live`; }
async function doShare(){
  const msg = document.getElementById('sharemsg');
  try {
    const file = new File([shareBlob], `matchmymovie-${shareMovie.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.png`, {type:'image/png'});
    if (navigator.canShare && navigator.canShare({files:[file]})) { await navigator.share({files:[file], text:shareText()}); return; }
    // Desktop fallback: download the image
    const a = document.createElement('a'); a.href = URL.createObjectURL(shareBlob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    msg.textContent = 'Saved the ticket image. Post it anywhere you like.';
  } catch(e){
    if (e && e.name==='AbortError') return;
    msg.textContent = "Couldn't open sharing. Press and hold the ticket (or right-click it) to save the image.";
  }
}
async function copyCaption(){
  const msg = document.getElementById('sharemsg');
  try { await navigator.clipboard.writeText(shareText()); msg.textContent = 'Copied. Paste it into a text or caption.'; }
  catch(e){ msg.textContent = `Couldn't copy here. The text is: "${shareText()}"`; }
}
document.addEventListener('keydown', e => { if (e.key==='Escape' && !document.getElementById('share').hidden) closeShare(); });

updateCount();
start();
