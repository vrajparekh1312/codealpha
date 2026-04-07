// ── STATE ──
let idx = 0, playing = false, shuffle = false, repeat = false;
let simTimer = null, simCur = 0;
let currentFilter = 'all';
const MAX_RECENT = 5;

// ── ELEMENTS ──
const audio        = document.getElementById('audio');
const coverStage   = document.getElementById('coverStage');
const coverImg     = document.getElementById('coverImg');
const songTitle    = document.getElementById('songTitle');
const songArtist   = document.getElementById('songArtist');
const songYear     = document.getElementById('songYear');
const progress     = document.getElementById('progress');
const progressFill = document.getElementById('progressFill');
const curTime      = document.getElementById('curTime');
const durTime      = document.getElementById('durTime');
const volume       = document.getElementById('volume');
const playBtn      = document.getElementById('playBtn');
const iconPlay     = document.getElementById('iconPlay');
const iconPause    = document.getElementById('iconPause');
const playlistEl   = document.getElementById('playlist');
const searchInput  = document.getElementById('searchInput');
const panelCount   = document.getElementById('panelCount');
const trackCounter = document.getElementById('trackCounter');
const errorBox     = document.getElementById('errorBox');
const miniPlayer   = document.getElementById('miniPlayer');
const miniCover    = document.getElementById('miniCover');
const miniTitle    = document.getElementById('miniTitle');
const miniArtist   = document.getElementById('miniArtist');
const miniProgress = document.getElementById('miniProgress');
const miniIconPlay = document.getElementById('miniIconPlay');
const miniIconPause= document.getElementById('miniIconPause');
const recentSection= document.getElementById('recentSection');
const recentChips  = document.getElementById('recentChips');
const kbTooltip    = document.getElementById('kbTooltip');

// ── UTILS ──
function fmtSec(s) {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
}
function durationToSec(str) {
  if (!str) return 0;
  const [m,s] = str.split(':').map(Number);
  return (m||0)*60+(s||0);
}
function showError(msg) {
  errorBox.textContent = msg;
  errorBox.style.display = 'block';
  clearTimeout(errorBox._t);
  errorBox._t = setTimeout(() => errorBox.style.display = 'none', 4000);
}

// ── 1. DYNAMIC BACKGROUND FROM ALBUM COVER ──
const colorCanvas = document.createElement('canvas');
colorCanvas.width = colorCanvas.height = 10;
const colorCtx = colorCanvas.getContext('2d');

function extractColors(imgSrc) {
  const tmpImg = new Image();
  tmpImg.crossOrigin = 'anonymous';
  tmpImg.onload = () => {
    try {
      colorCtx.drawImage(tmpImg, 0, 0, 10, 10);
      const d = colorCtx.getImageData(0, 0, 10, 10).data;
      const r1 = d[0], g1 = d[1], b1 = d[2];
      const r2 = d[d.length-4], g2 = d[d.length-3], b2 = d[d.length-2];
      const lighten = (v) => Math.round(v * 0.25 + 210);
      const c1 = `rgb(${lighten(r1)},${lighten(g1)},${lighten(b1)})`;
      const c2 = `rgb(${lighten(r2)},${lighten(g2)},${lighten(b2)})`;
      document.documentElement.style.setProperty('--dyn1', c1);
      document.documentElement.style.setProperty('--dyn2', c2);
    } catch(e) { /* CORS fail — keep current */ }
  };
  tmpImg.src = imgSrc;
}

// ── AUDIO ERRORS ──
audio.addEventListener('error', () => {
  if (!audio.src || audio.src === window.location.href) return;
  showError('⚠ File not found: ' + decodeURIComponent(audio.src.split('/').pop()));
});

// ── 8. RECENTLY PLAYED ──
function getRecent() {
  try { return JSON.parse(localStorage.getItem('melo_recent') || '[]'); }
  catch { return []; }
}
function addRecent(title) {
  let r = getRecent().filter(t => t !== title);
  r.unshift(title);
  r = r.slice(0, MAX_RECENT);
  localStorage.setItem('melo_recent', JSON.stringify(r));
  renderRecent();
}
function renderRecent() {
  const r = getRecent();
  recentChips.innerHTML = '';
  if (!r.length) return;
  r.forEach(title => {
    const song = songs.find(s => s.title === title);
    if (!song) return;
    const chip = document.createElement('span');
    chip.className = 'recent-chip';
    chip.textContent = title;
    chip.title = title;
    chip.addEventListener('click', () => {
      idx = songs.indexOf(song); load(); startPlay();
    });
    recentChips.appendChild(chip);
  });
}

// ── LOAD ──
function load() {
  const s = songs[idx];
  songTitle.textContent  = s.title;
  songArtist.textContent = s.artist;
  songYear.textContent   = s.year;
  coverImg.style.opacity = '0';
  const img = new Image();
  img.onload = () => {
    coverImg.src = img.src;
    coverImg.style.opacity = '1';
    extractColors(img.src);
  };
  img.onerror = () => { coverImg.src = ''; coverImg.style.opacity = '1'; };
  img.src = s.cover || '';
  miniCover.src          = s.cover || '';
  miniTitle.textContent  = s.title;
  miniArtist.textContent = s.artist;
  progress.value = 0;
  progressFill.style.width = '0%';
  miniProgress.style.width = '0%';
  curTime.textContent = '0:00';
  durTime.textContent = s.duration || '0:00';
  simCur = 0; clearInterval(simTimer);
  if (s.src) { audio.src = s.src; audio.load(); }
  else { audio.removeAttribute('src'); showError('⚠ No audio file for: ' + s.title); }
  updateList();
}

// ── SIMULATE (no real file) ──
function simulate() {
  clearInterval(simTimer);
  const total = durationToSec(songs[idx].duration) * 1000;
  if (!total) return;
  simTimer = setInterval(() => {
    simCur += 500;
    if (simCur >= total) { clearInterval(simTimer); autoNext(); return; }
    const pct = (simCur / total) * 100;
    progress.value = pct;
    progressFill.style.width = pct + '%';
    miniProgress.style.width = pct + '%';
    curTime.textContent = fmtSec(simCur / 1000);
  }, 500);
}

// ── PLAY / PAUSE ──
function startPlay() {
  audio.play().then(() => { playing=true; clearInterval(simTimer); })
    .catch(() => { playing=true; simulate(); });
  setPlayingUI(true);
  addRecent(songs[idx].title);
}
function stopPlay() {
  audio.pause(); clearInterval(simTimer); playing = false;
  setPlayingUI(false);
}
function setPlayingUI(on) {
  iconPlay.style.display   = on ? 'none'  : 'block';
  iconPause.style.display  = on ? 'block' : 'none';
  miniIconPlay.style.display  = on ? 'none'  : 'block';
  miniIconPause.style.display = on ? 'block' : 'none';
  coverStage.classList.toggle('playing', on);
  document.querySelectorAll('.pl-item').forEach(el => {
    el.classList.toggle('is-playing', on && +el.dataset.idx === idx);
  });
}
function autoNext() {
  if (repeat) { load(); startPlay(); return; }
  idx = shuffle ? Math.floor(Math.random()*songs.length) : (idx+1)%songs.length;
  load(); startPlay();
}

// ── 2. RIPPLE on play button ──
playBtn.addEventListener('click', (e) => {
  const r = document.createElement('span');
  r.className = 'ripple';
  const size = playBtn.offsetWidth;
  r.style.width = r.style.height = size + 'px';
  r.style.left = (e.offsetX - size/2) + 'px';
  r.style.top  = (e.offsetY - size/2) + 'px';
  playBtn.appendChild(r);
  setTimeout(() => r.remove(), 600);
  playing ? stopPlay() : (load(), startPlay());
});

// ── CONTROLS ──
document.getElementById('nextBtn').addEventListener('click', () => {
  idx = shuffle ? Math.floor(Math.random()*songs.length) : (idx+1)%songs.length;
  load(); if(playing) startPlay();
});
document.getElementById('prevBtn').addEventListener('click', () => {
  if (simCur>3000||audio.currentTime>3) { simCur=0; audio.currentTime=0; progressFill.style.width='0%'; return; }
  idx=(idx-1+songs.length)%songs.length; load(); if(playing) startPlay();
});
document.getElementById('shuffleBtn').addEventListener('click', function(){ shuffle=!shuffle; this.classList.toggle('active',shuffle); });
document.getElementById('repeatBtn').addEventListener('click', function(){ repeat=!repeat; this.classList.toggle('active',repeat); });

// Mini player controls
document.getElementById('miniPlay').addEventListener('click', () => playing ? stopPlay() : (load(), startPlay()));
document.getElementById('miniNext').addEventListener('click', () => {
  idx = shuffle ? Math.floor(Math.random()*songs.length) : (idx+1)%songs.length;
  load(); if(playing) startPlay();
});
document.getElementById('miniPrev').addEventListener('click', () => {
  idx=(idx-1+songs.length)%songs.length; load(); if(playing) startPlay();
});

// ── PROGRESS ──
progress.addEventListener('input', () => {
  const pct = +progress.value;
  progressFill.style.width = pct+'%';
  miniProgress.style.width = pct+'%';
  simCur = (pct/100)*durationToSec(songs[idx].duration)*1000;
  curTime.textContent = fmtSec(simCur/1000);
  if (!isNaN(audio.duration)) audio.currentTime = (pct/100)*audio.duration;
});
audio.addEventListener('timeupdate', () => {
  if (!audio.duration) return;
  clearInterval(simTimer);
  const pct = (audio.currentTime/audio.duration)*100;
  progress.value = pct;
  progressFill.style.width  = pct+'%';
  miniProgress.style.width  = pct+'%';
  curTime.textContent = fmtSec(audio.currentTime);
  durTime.textContent = fmtSec(audio.duration);
});
audio.addEventListener('ended', autoNext);

// ── VOLUME ──
volume.addEventListener('input', () => {
  audio.volume = +volume.value;
  const p = (+volume.value*100).toFixed(0);
  volume.style.background = `linear-gradient(to right,var(--ink) 0%,var(--ink) ${p}%,var(--border) ${p}%)`;
});
audio.volume = 0.7;

// ── 10. MINI PLAYER (scroll-triggered) ──
window.addEventListener('scroll', () => {
  const playerBottom = document.querySelector('.player-panel').getBoundingClientRect().bottom;
  miniPlayer.style.display = playerBottom < 0 ? 'flex' : 'none';
}, { passive: true });

// ── LIST ──
function updateList() {
  document.querySelectorAll('.pl-item').forEach(el => {
    const i = +el.dataset.idx;
    el.classList.toggle('active', i===idx);
    el.classList.toggle('is-playing', i===idx&&playing);
  });
  const active = playlistEl.querySelector('.pl-item.active');
  if (active) active.scrollIntoView({block:'nearest',behavior:'smooth'});
}

function buildPlaylist() {
  const q = searchInput.value.toLowerCase().trim();
  let list = [...songs];
  if (currentFilter === 'fav')    list = list.filter(s => localStorage.getItem('fav_'+s.title)==='true');
  if (currentFilter === 'recent') list = getRecent().map(t => songs.find(s=>s.title===t)).filter(Boolean);
  if (q) list = list.filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
  playlistEl.innerHTML = '';
  panelCount.textContent = list.length + ' track' + (list.length!==1?'s':'');
  if (!list.length) { playlistEl.innerHTML='<div class="no-results">No tracks found.</div>'; return; }
  list.forEach((song, i) => {
    const ri = songs.indexOf(song);
    const isFav = localStorage.getItem('fav_'+song.title) === 'true';
    const el = document.createElement('div');
    el.className = 'pl-item'+(ri===idx?' active':'')+(ri===idx&&playing?' is-playing':'');
    el.dataset.idx = ri;
    el.innerHTML = `
      <div class="pl-num-wrap">
        <div class="eq-bars"><span></span><span></span><span></span></div>
        <span class="pl-num">${String(i+1).padStart(2,'0')}</span>
      </div>
      <img class="pl-thumb" src="${song.cover}" alt="" loading="lazy">
      <div class="pl-info">
        <div class="pl-name">${song.title}</div>
        <div class="pl-artist">${song.artist}</div>
      </div>
      <div class="pl-right">
        <span class="pl-dur">${song.duration||''}</span>
        <span class="pl-fav" data-idx="${ri}">${isFav?'❤️':'♡'}</span>
      </div>`;
    el.addEventListener('click', e => {
      if (e.target.closest('.pl-fav')) return;
      idx=ri; load(); startPlay();
    });
    el.querySelector('.pl-fav').addEventListener('click', e => {
      e.stopPropagation();
      const key = 'fav_'+song.title;
      const now = localStorage.getItem(key) === 'true';
      localStorage.setItem(key, !now);
      e.target.textContent = !now ? '❤️' : '♡';
    });
    playlistEl.appendChild(el);
  });
  const active = playlistEl.querySelector('.pl-item.active');
  if (active) active.scrollIntoView({block:'nearest',behavior:'smooth'});
}

searchInput.addEventListener('input', buildPlaylist);

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    recentSection.style.display = currentFilter === 'recent' ? 'block' : 'none';
    buildPlaylist();
  });
});

// ── 9. KEYBOARD SHORTCUTS ──
document.addEventListener('keydown', e => {
  if (e.target === searchInput) return;
  switch(e.code) {
    case 'Space':
      e.preventDefault();
      playing ? stopPlay() : (load(), startPlay());
      break;
    case 'ArrowRight':
      e.preventDefault();
      idx = shuffle ? Math.floor(Math.random()*songs.length) : (idx+1)%songs.length;
      load(); if(playing) startPlay();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      idx=(idx-1+songs.length)%songs.length; load(); if(playing) startPlay();
      break;
    case 'ArrowUp':
      e.preventDefault();
      audio.volume = Math.min(1, audio.volume+0.05);
      volume.value = audio.volume;
      volume.dispatchEvent(new Event('input'));
      break;
    case 'ArrowDown':
      e.preventDefault();
      audio.volume = Math.max(0, audio.volume-0.05);
      volume.value = audio.volume;
      volume.dispatchEvent(new Event('input'));
      break;
    case 'KeyS':
      shuffle = !shuffle;
      document.getElementById('shuffleBtn').classList.toggle('active', shuffle);
      break;
    case 'KeyR':
      repeat = !repeat;
      document.getElementById('repeatBtn').classList.toggle('active', repeat);
      break;
  }
});

// Keyboard shortcut toggle button
document.getElementById('kbHintBtn').addEventListener('click', () => {
  kbTooltip.classList.toggle('visible');
});
document.addEventListener('click', e => {
  if (!e.target.closest('#kbHintBtn') && !e.target.closest('#kbTooltip')) {
    kbTooltip.classList.remove('visible');
  }
});

// ── INIT ──
trackCounter.textContent = songs.length + ' tracks';
renderRecent();
buildPlaylist();
load();