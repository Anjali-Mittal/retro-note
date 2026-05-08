// retro.js — app entry point
// Owns global state (S), the router, and all page renderers.
// Pure logic lives in the sibling modules imported below.

import { CLIP_DURATION, trimAudioTo30s, getAudioDuration, readFileAsBase64 } from './audio.js';
import { encodeLetterToHash, decodeLetterFromHash }                           from './encoding.js';
import { saveSession, loadSession, clearSession }                             from './session.js';
import { buildCollageHTML, bindCollageEvents }                                from './collage.js';
import { esc, fmtTime, toast }                                                from './utils.js';

/* ═══════════════════════════════════════════════════
   GLOBAL STATE
   ═══════════════════════════════════════════════════ */
const S: {
  photos: string[];
  songSrc: string | null;
  songName: string | null;
  songAlbumArt: string | null;
  recipient: string;
  note: string;
  composeIsPlaying: boolean;
  composeAudio: HTMLAudioElement | null;
  trimStart: number;
  songDuration: number;
  clipDuration: number;
} = {
  // compose form
  photos:           [],
  songSrc:          null,  // full original audio data URI (pre-trim)
  songName:         null,
  songAlbumArt:     null,
  recipient:        '',
  note:             '',
  // compose player
  composeIsPlaying: false,
  composeAudio:     null,
  // trim
  trimStart:        0,     // seconds — where the clip starts
  songDuration:     0,     // total duration of the loaded song
  clipDuration:     30,    // seconds — how long the clip should be (max 30s)
};

/* ═══════════════════════════════════════════════════
   ROUTER
   ═══════════════════════════════════════════════════ */
export function initRetroNote() {
  loadSession(S);
  window.addEventListener('popstate', route);
  route();
}

function navigate(path: string) {
  window.history.pushState({}, '', path);
  route();
}

function route() {
  document.getElementById('pm-overlay')?.remove();

  const root = document.getElementById('rn-app');
  if (!root) return;
  const p    = window.location.pathname;

  if      (p === '/')                        renderLanding(root);
  else if (p === '/compose')                 renderCompose(root);
  else if (p === '/letter' || p === '/letter/') renderLetterPage(root);
  else root.innerHTML = notFoundHTML();
}

/* ═══════════════════════════════════════════════════
   LANDING PAGE
   ═══════════════════════════════════════════════════ */
function renderLanding(root: HTMLElement) {
  stopAllAudio();
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;flex-direction:column;justify-content:space-between;align-items:center;padding:3rem 2rem;">
      <p id="lnd-date" style="font-size:.75rem;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);margin:0;"></p>
      <div style="display:flex;flex-direction:column;align-items:center;gap:2rem;">
        <div id="lnd-vinyl" class="landing-vinyl-wrap" style="width:260px;height:260px;" role="button" aria-label="Spin the vinyl">
          <div class="landing-disc"></div>
          <div class="landing-label"><span><strong>retro</strong>note</span></div>
          <div class="landing-tonearm-wrap" aria-hidden="true"><div class="landing-tonearm"></div></div>
        </div>
        <div style="text-align:center;">
          <h1 style="font-size:clamp(2.5rem,8vw,4rem);font-weight:400;margin:0 0 .5rem;color:var(--ink);">retro note</h1>
          <p style="font-family:'IM Fell English',Georgia,serif;font-size:1.25rem;font-style:italic;color:var(--muted);margin:0;">send love, wrapped in vinyl</p>
        </div>
      </div>
      <button id="lnd-compose" class="btn btn-primary" style="font-size:1rem;padding:.875rem 2.5rem;">compose a letter</button>
    </div>
  `;

  const dateEl = document.getElementById('lnd-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  
  const vinylEl = document.getElementById('lnd-vinyl');
  if (vinylEl) vinylEl.addEventListener('click', function () { this.classList.toggle('playing'); });
  
  const composeBtn = document.getElementById('lnd-compose');
  if (composeBtn) composeBtn.addEventListener('click', () => navigate('/compose'));
}

/* ═══════════════════════════════════════════════════
   COMPOSE PAGE
   ═══════════════════════════════════════════════════ */
function renderCompose(root: HTMLElement) {
  stopAllAudio();
  root.innerHTML = composeHTML();

  // Restore saved values
  const noteEl = document.getElementById('c-note') as HTMLTextAreaElement | null;
  if (noteEl) noteEl.value = S.note;
  const recipientEl = document.getElementById('c-recipient') as HTMLInputElement | null;
  if (recipientEl) recipientEl.value = S.recipient;

  bindComposeEvents();
  updateVinylUI();
  renderPhotoStrip();
  if (S.songSrc) updateTrimUI(); // restore trim slider if session had a song
}

function composeHTML() {
  return `
    <section class="screen active">
      <header class="dash-topbar">
        <button id="c-home" style="color:var(--muted);font-size:.85rem;letter-spacing:.1em;text-transform:uppercase;transition:color .2s;padding:.5rem 1rem;">← home</button>
        <div class="dash-logo">retro note</div>
        <div style="width:80px;"></div>
      </header>
      <main class="dash-body">
        <div class="tab-panel active">
          <p class="panel-title">compose a note</p>
          <div id="compose-layout">

            <!-- LEFT: vinyl player -->
            <div class="composer-left">
              <div style="position:relative;display:inline-block;">
                <div id="c-vinyl" class="vinyl-wrap" role="button" aria-label="Play / pause vinyl">
                  <div class="vinyl-disc"></div>
                  <div class="vinyl-label-ring">
                    <div id="c-label-face" class="vinyl-label-face">
                      <span class="vinyl-label-name"><strong>retro</strong>note</span>
                    </div>
                  </div>
                  <div class="tonearm-wrap" aria-hidden="true"><div class="tonearm"></div></div>
                </div>
              </div>

              <div id="c-player-info" style="display:none;">
                <p class="play-hint">click to play ↑</p>
                <p id="c-song-display" class="song-name-display"></p>
                <div class="progress-row">
                  <div id="c-prog-track" class="progress-track" role="slider" aria-label="Audio progress">
                    <div id="c-prog-fill" class="progress-fill"></div>
                  </div>
                  <span id="c-prog-time" class="progress-time">0:00</span>
                </div>
                ${trimSectionHTML()}
              </div>

              <p id="c-no-song" class="play-hint" style="margin-top:8px;">no song attached</p>
            </div>

            <!-- RIGHT: form -->
            <div>
              <div class="field">
                <label>your photos <span style="font-style:italic;font-size:.8em;text-transform:none;letter-spacing:0;color:var(--dust);">(up to 6)</span></label>
                <div class="upload-zone" tabindex="0" aria-label="Upload photos">
                  <input id="c-photo-input" type="file" accept="image/*" multiple aria-label="Choose photos" />
                  <div class="icon">📷</div>
                  <p>drop memories here<br><span style="font-size:.75em;">jpg · png · webp · max 8 MB each</span></p>
                </div>
                <div id="c-photo-strip" class="polaroid-stack" style="margin-top:14px;"></div>
              </div>

              <div class="field">
                <label>song for the vinyl</label>
                <div id="c-pane-upload">
                  <div class="song-zone" tabindex="0">
                    <input id="c-song-input" type="file" accept="audio/*" aria-label="Choose a song" />
                    <div class="song-icon-wrap">♪</div>
                    <div class="song-meta"><p id="c-song-label">choose an audio file</p></div>
                  </div>
                </div>
              </div>

              <div class="field">
                <label for="c-note">your note</label>
                <textarea id="c-note" rows="6" placeholder="write something that feels like a Sunday morning…"
                  maxlength="2000"
                  style="font-family:'IM Fell English',Georgia,serif;font-style:italic;font-size:1rem;line-height:1.9;resize:vertical;"></textarea>
              </div>

              <div class="field">
                <label for="c-recipient">from</label>
                <input id="c-recipient" type="text" placeholder="their name" maxlength="32" autocomplete="off" />
              </div>

              <button id="c-preview-btn" class="btn btn-primary" style="margin-top:8px;">preview &amp; send ✦</button>
            </div>

          </div>
        </div>
      </main>
    </section>

    ${shareBannerHTML()}
    <div id="c-prev-overlay" style="display:none;"></div>
  `;
}

function trimSectionHTML() {
  return `
    <div id="c-trim-section" style="margin-top:1rem;padding:1rem;background:rgba(0,0,0,.04);border-radius:4px;border:1px solid var(--aged);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;">
        <span style="font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--sepia);font-family:'Cormorant Garamond',serif;">start time</span>
        <span id="c-trim-display" style="font-size:.78rem;font-family:'Cormorant Garamond',serif;color:var(--ink);font-variant-numeric:tabular-nums;">0:00</span>
      </div>
      <input id="c-trim-slider" type="range" min="0" max="100" step="0.1" value="0"
        style="width:100%;accent-color:var(--sepia);cursor:pointer;" aria-label="Trim start position" />
      <div style="display:flex;justify-content:space-between;margin-top:.3rem;margin-bottom:1rem;">
        <span style="font-size:.65rem;color:var(--dust);font-family:'Cormorant Garamond',serif;">0:00</span>
        <span id="c-trim-end-label" style="font-size:.65rem;color:var(--dust);font-family:'Cormorant Garamond',serif;"></span>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;">
        <span style="font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--sepia);font-family:'Cormorant Garamond',serif;">clip length</span>
        <span id="c-duration-display" style="font-size:.78rem;font-family:'Cormorant Garamond',serif;color:var(--ink);font-variant-numeric:tabular-nums;">0:30</span>
      </div>
      <input id="c-duration-slider" type="range" min="1" max="30" step="0.1" value="30"
        style="width:100%;accent-color:var(--sepia);cursor:pointer;" aria-label="Clip duration" />
      <div style="display:flex;justify-content:space-between;margin-top:.3rem;">
        <span style="font-size:.65rem;color:var(--dust);font-family:'Cormorant Garamond',serif;">0:01</span>
        <span style="font-size:.65rem;color:var(--dust);font-family:'Cormorant Garamond',serif;">0:30</span>
      </div>

      <p id="c-trim-note" style="font-size:.68rem;color:var(--muted);margin:.7rem 0 0;font-style:italic;font-family:'IM Fell English',Georgia,serif;">
        your letter will play from 0:00 for 0:30
      </p>
      <button id="c-trim-preview" style="margin-top:.6rem;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--sepia);background:none;border:1px solid var(--aged);padding:.3rem .75rem;cursor:pointer;border-radius:2px;transition:all .15s;">
        ▶ preview clip
      </button>
    </div>
  `;
}

function shareBannerHTML() {
  return `
    <div id="c-share-banner" style="display:none;position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:var(--parchment);padding:1.5rem 2rem;border-radius:var(--radius);box-shadow:var(--shadow-lg);max-width:500px;width:90%;z-index:9999;border:2px solid var(--aged);">
      <p style="font-size:.8rem;letter-spacing:.15em;text-transform:uppercase;color:var(--sepia);margin-bottom:.5rem;">Letter sent! Share this link:</p>
      <button id="c-native-share" style="display:none;width:100%;margin-bottom:.75rem;padding:.65rem;background:var(--sepia);color:var(--parchment);border:none;cursor:pointer;font-size:.82rem;letter-spacing:.12em;text-transform:uppercase;font-family:'Cormorant Garamond',serif;border-radius:2px;transition:opacity .15s;">
        ↗ share letter
      </button>
      <div style="display:flex;gap:.5rem;align-items:center;">
        <input id="c-share-link" type="text" readonly style="flex:1;padding:.5rem;font-size:.9rem;" />
        <button id="c-copy-btn" class="btn btn-primary btn-sm">copy</button>
      </div>
      <p id="c-share-size" style="font-size:.7rem;color:var(--muted);margin:.4rem 0 0;font-style:italic;"></p>
      <button id="c-close-share" style="margin-top:.75rem;font-size:.75rem;color:var(--muted);text-decoration:underline;background:none;border:none;cursor:pointer;">close</button>
    </div>
  `;
}

/* ── Event bindings ──────────────────────────────────────────────────────── */
function bindComposeEvents() {
  const homeBtn = document.getElementById('c-home');
  if (homeBtn) {
    homeBtn.addEventListener('click', () => navigate('/'));
    homeBtn.addEventListener('mouseenter', (e) => { (e.currentTarget as HTMLElement).style.color = 'var(--sepia)'; });
    homeBtn.addEventListener('mouseleave', (e) => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; });
  }

  const photoInput = document.getElementById('c-photo-input') as HTMLInputElement | null;
  if (photoInput) photoInput.addEventListener('change', async (e) => {
    const files = (e.target as HTMLInputElement)?.files;
    for (const f of Array.from(files || [])) {
      if (S.photos.length >= 6) break;
      try   { S.photos.push(await readFileAsBase64(f, 'image') as string); }
      catch (err) { toast((err as Error).message); }
    }
    (e.target as HTMLInputElement).value = '';
    renderPhotoStrip();
    saveSession(S);
  });

  const songInput = document.getElementById('c-song-input') as HTMLInputElement | null;
  if (songInput) songInput.addEventListener('change', async (e) => {
    const files = (e.target as HTMLInputElement)?.files;
    const f = files?.[0];
    if (!f) return;
    try {
      const src  = await readFileAsBase64(f, 'audio') as string;
      const name = f.name.replace(/\.[^/.]+$/, '').slice(0, 120);
      await setSong(src, name, null);
    } catch (err) { toast((err as Error).message); }
    (e.target as HTMLInputElement).value = '';
  });

  const noteInput = document.getElementById('c-note') as HTMLTextAreaElement | null;
  if (noteInput) noteInput.addEventListener('input', (e) => {
    S.note = (e.target as HTMLTextAreaElement).value;
    saveSession(S);
  });
  const recipientInput = document.getElementById('c-recipient') as HTMLInputElement | null;
  if (recipientInput) recipientInput.addEventListener('input', (e) => {
    S.recipient = (e.target as HTMLInputElement).value;
    saveSession(S);
  });

  const vinyl = document.getElementById('c-vinyl');
  if (vinyl) vinyl.addEventListener('click', () => {
    if (!S.songSrc) { toast('Add a song first ♪'); return; }
    toggleComposePlaying();
  });

  const progTrack = document.getElementById('c-prog-track');
  if (progTrack) progTrack.addEventListener('click', (e) => {
    const a   = S.composeAudio;
    if (!a || !isFinite(a.duration)) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * a.duration;
  });

  const previewBtn = document.getElementById('c-preview-btn');
  if (previewBtn) previewBtn.addEventListener('click', handlePreview);
}

/* ── Song ─────────────────────────────────────────────────────────────────── */
async function setSong(src: string, name: string, albumArt: string | null) {
  S.songSrc          = src;
  S.songName         = name;
  S.songAlbumArt     = albumArt;
  S.trimStart        = 0;
  S.songDuration     = 0;
  S.composeIsPlaying = false;
  if (S.composeAudio) { (S.composeAudio as HTMLAudioElement).pause(); S.composeAudio = null; }

  S.songDuration = (await getAudioDuration(src)) as number;

  updateVinylUI();
  updateTrimUI();
  saveSession(S);
}

function updateVinylUI() {
  const vinyl = document.getElementById('c-vinyl');
  if (!vinyl) return;
  vinyl.style.cursor = S.songSrc ? 'pointer' : 'default';
  vinyl.classList.toggle('playing', S.composeIsPlaying);

  const lf = document.getElementById('c-label-face');
  if (lf) {
    lf.innerHTML = S.songAlbumArt
      ? `<img src="${esc(S.songAlbumArt)}" alt="" aria-hidden="true" class="vinyl-label-art" />`
      : `<span class="vinyl-label-name"><strong>retro</strong>note</span>`;
  }

  document.getElementById('c-no-song')?.style.setProperty('display', S.songSrc ? 'none' : '');
  document.getElementById('c-player-info')?.style.setProperty('display', S.songSrc ? '' : 'none');

  const disp = document.getElementById('c-song-display');
  if (disp && S.songName) disp.textContent = '♪ ' + S.songName;
}

function updateTrimUI() {
  const slider = document.getElementById('c-trim-slider') as HTMLInputElement | null;
  const durationSlider = document.getElementById('c-duration-slider') as HTMLInputElement | null;
  const display = document.getElementById('c-trim-display');
  const durationDisplay = document.getElementById('c-duration-display');
  const endLbl  = document.getElementById('c-trim-end-label');
  const noteEl  = document.getElementById('c-trim-note');
  if (!slider || !durationSlider || !display || !durationDisplay) return;

  const dur = S.songDuration;
  const maxStart = Math.max(0, dur - S.clipDuration);

  slider.max = String(maxStart > 0 ? maxStart * 10 : 0);
  slider.value = String(S.trimStart * 10);
  durationSlider.value = String(S.clipDuration);

  display.textContent = fmtTime(S.trimStart);
  durationDisplay.textContent = fmtTime(S.clipDuration);
  if (endLbl) endLbl.textContent = fmtTime(dur);

  // Disable start slider if song is very short
  if (dur <= 1) {
    slider.disabled = true;
    slider.style.opacity = '.4';
  } else {
    slider.disabled = false;
    slider.style.opacity = '1';
  }

  // Update note with preview
  if (noteEl) {
    noteEl.textContent = `your letter will play from ${fmtTime(S.trimStart)} for ${fmtTime(S.clipDuration)}`;
  }

  slider.oninput = () => {
    S.trimStart = parseFloat(slider.value) / 10;
    if (display) display.textContent = fmtTime(S.trimStart);
    if (noteEl) noteEl.textContent = `your letter will play from ${fmtTime(S.trimStart)} for ${fmtTime(S.clipDuration)}`;
    // Seek paused player to the new trim start
    if (S.composeAudio && !S.composeIsPlaying) {
      (S.composeAudio as HTMLAudioElement).currentTime = S.trimStart;
    }
  };

  durationSlider.oninput = () => {
    S.clipDuration = parseFloat(durationSlider.value);
    // Ensure start position doesn't go past the new duration
    const maxNewStart = Math.max(0, dur - S.clipDuration);
    if (S.trimStart > maxNewStart) {
      S.trimStart = maxNewStart;
      slider.value = String(S.trimStart * 10);
      if (display) display.textContent = fmtTime(S.trimStart);
    }
    if (durationDisplay) durationDisplay.textContent = fmtTime(S.clipDuration);
    if (noteEl) noteEl.textContent = `your letter will play from ${fmtTime(S.trimStart)} for ${fmtTime(S.clipDuration)}`;
  };

  const trimPreviewBtn = document.getElementById('c-trim-preview');
  if (trimPreviewBtn) trimPreviewBtn.onclick = () => previewTrimClip();
}

let _trimPreviewAudio: HTMLAudioElement | null = null;

function previewTrimClip() {
  if (!S.songSrc) return;
  if (_trimPreviewAudio) { _trimPreviewAudio.pause(); _trimPreviewAudio = null; }

  const btn = document.getElementById('c-trim-preview');

  // Pause main player if running
  if (S.composeIsPlaying) {
    S.composeIsPlaying = false;
    (S.composeAudio as HTMLAudioElement)?.pause();
    updateVinylUI();
  }

  const a       = new Audio(S.songSrc);
  a.currentTime = S.trimStart;
  _trimPreviewAudio = a;

  const endTime = S.trimStart + Math.min(S.clipDuration, S.songDuration - S.trimStart);

  const tick = () => {
    if (a.currentTime >= endTime) {
      a.pause();
      if (btn) btn.textContent = '▶ preview clip';
      _trimPreviewAudio = null;
      return;
    }
    requestAnimationFrame(tick);
  };

  a.play()
    .then(() => {
      if (btn) btn.textContent = '■ stop preview';
      requestAnimationFrame(tick);
    })
    .catch(() => toast('Could not preview audio'));

  a.addEventListener('ended', () => {
    if (btn) btn.textContent = '▶ preview clip';
    _trimPreviewAudio = null;
  }, { once: true });

  if (btn) {
    btn.onclick = () => {
      if (_trimPreviewAudio) { _trimPreviewAudio.pause(); _trimPreviewAudio = null; }
      btn.textContent = '▶ preview clip';
      btn.onclick = () => previewTrimClip();
    };
  }
}

function toggleComposePlaying() {
  // Stop trim preview if running
  if (_trimPreviewAudio) {
    _trimPreviewAudio.pause();
    _trimPreviewAudio = null;
    const b = document.getElementById('c-trim-preview');
    if (b) b.textContent = '▶ preview clip';
  }

  S.composeIsPlaying = !S.composeIsPlaying;

  if (!S.composeAudio && S.songSrc) {
    const a = new Audio();
    a.preload = 'auto';
    a.addEventListener('timeupdate', () => {
      const fill = document.getElementById('c-prog-fill');
      const time = document.getElementById('c-prog-time');
      if (fill) fill.style.width = (a.duration > 0 ? (a.currentTime / a.duration) * 100 : 0) + '%';
      if (time) time.textContent = fmtTime(a.currentTime);
    });
    a.addEventListener('ended', () => { S.composeIsPlaying = false; updateVinylUI(); });
    a.addEventListener('error', () => {
      const codes: Record<number, string> = { 1:'aborted', 2:'network error', 3:'decode error', 4:'unsupported format' };
      const errorCode = a.error?.code;
      const errorMsg = (errorCode && errorCode in codes) ? codes[errorCode] : 'unknown';
      toast(`Audio error: ${errorMsg}`);
      S.composeIsPlaying = false;
      updateVinylUI();
    });
    a.src = S.songSrc;
    a.load();
    S.composeAudio = a;
  }

  if (S.composeIsPlaying) {
    (S.composeAudio as HTMLAudioElement)?.play().catch(err => {
      toast(`Playback blocked: ${(err as Error).name}`);
      S.composeIsPlaying = false;
      updateVinylUI();
    });
  } else {
    (S.composeAudio as HTMLAudioElement)?.pause();
  }
  updateVinylUI();
}

function stopAllAudio() {
  if (S.composeAudio) { (S.composeAudio as HTMLAudioElement).pause(); S.composeAudio = null; }
  if (_trimPreviewAudio) { _trimPreviewAudio.pause(); _trimPreviewAudio = null; }
  S.composeIsPlaying = false;
}

/* ── Photos ──────────────────────────────────────────────────────────────── */
function renderPhotoStrip() {
  const strip = document.getElementById('c-photo-strip');
  if (!strip) return;
  strip.innerHTML = S.photos.map((src, i) => `
    <div class="polaroid">
      <img src="${esc(src)}" alt="photo ${i + 1}" loading="lazy" />
      <button class="polaroid-del" data-i="${i}" aria-label="Remove photo">×</button>
    </div>
  `).join('');
  strip.querySelectorAll('.polaroid-del').forEach(btn => {
    const htmlBtn = btn as HTMLButtonElement;
    htmlBtn.addEventListener('click', () => {
      S.photos.splice(+(htmlBtn.dataset.i || '0'), 1);
      renderPhotoStrip();
      saveSession(S);
    });
  });
}

/* ── Preview & Send ──────────────────────────────────────────────────────── */
function handlePreview() {
  if (!S.recipient.trim())              { toast('Who is this from?'); return; }
  if (!S.note.trim() && !S.photos.length) { toast('Add a note or at least one photo.'); return; }
  openPreviewOverlay();
}

function openPreviewOverlay() {
  const overlay = document.getElementById('c-prev-overlay');
  if (!overlay) return;

  // Bug 1 fix: stop compose player before opening preview
  stopAllAudio();

  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(8,4,1,.82);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:9000;padding:1.5rem;';
  overlay.innerHTML = `
    <div id="prev-panel" style="background:var(--cream);padding:2rem;max-width:900px;width:100%;max-height:94vh;overflow:auto;border-radius:3px;box-shadow:0 24px 64px rgba(0,0,0,.5);">
      <h2 style="font-family:'Playfair Display',Georgia,serif;font-size:1.35rem;margin-bottom:1.5rem;color:var(--ink);">Preview</h2>
      <div style="display:flex;justify-content:center;margin-bottom:1.25rem;">
        ${buildCollageHTML({ recipient: S.recipient, note: S.note, photos: S.photos, hasSong: !!S.songSrc, albumArt: S.songAlbumArt, id: 'pv' })}
      </div>
      ${S.songName ? `<p id="pv-song-lbl" style="text-align:center;color:var(--muted);font-size:.88rem;font-style:italic;margin-bottom:1.25rem;font-family:'IM Fell English',Georgia,serif;">♪ click vinyl to preview · ${esc(S.songName)}</p>` : ''}
      <div style="display:flex;gap:1rem;justify-content:center;">
        <button id="pv-back" style="padding:.75rem 2rem;background:none;border:1px solid var(--aged);color:var(--muted);cursor:pointer;border-radius:3px;font-size:.85rem;letter-spacing:.06em;">go back</button>
        <button id="pv-confirm" class="btn btn-primary" style="padding:.75rem 2rem;">confirm &amp; send ✦</button>
      </div>
    </div>
  `;

  overlay.addEventListener('click', e => { if (e.target === overlay) closePreviewOverlay(); });
  const prevPanel = document.getElementById('prev-panel');
  if (prevPanel) prevPanel.addEventListener('click', e => e.stopPropagation());
  const pvBack = document.getElementById('pv-back');
  if (pvBack) pvBack.addEventListener('click', closePreviewOverlay);
  const pvConfirm = document.getElementById('pv-confirm');
  if (pvConfirm) pvConfirm.addEventListener('click', handleConfirmSend);

  // Bug 2 fix: pre-trim so preview plays the trimmed clip, not the full song
  (async () => {
    let previewAudioSrc: string | null = S.songSrc;
    if (S.songSrc) {
      try {
        previewAudioSrc = await trimAudioTo30s(S.songSrc, S.trimStart, S.clipDuration);
      } catch { /* fall back to full src */ }
    }
    bindCollageEvents({
      id: 'pv', hasSong: !!S.songSrc, audioSrc: previewAudioSrc,
      recipient: S.recipient, note: S.note,
      onPlayingChange: (playing: boolean) => {
        const lbl = document.getElementById('pv-song-lbl');
        if (lbl) lbl.textContent = (playing ? '♪ now playing' : '♪ click vinyl to preview') + (S.songName ? ` · ${S.songName}` : '');
      },
    });
  })();
}

function closePreviewOverlay() {
  const overlay = document.getElementById('c-prev-overlay');
  if (overlay) { overlay.style.display = 'none'; overlay.innerHTML = ''; }
  document.getElementById('pm-overlay')?.remove();
}

async function handleConfirmSend() {
  const confirmBtn = document.getElementById('pv-confirm') as HTMLButtonElement | null;
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'encoding…'; }

  try {
    let trimmedSong = null;
    if (S.songSrc) {
      try {
        toast('Trimming audio… ♪');
        trimmedSong = await trimAudioTo30s(S.songSrc, S.trimStart, S.clipDuration);
      } catch (err) {
        console.warn('Audio trim failed, skipping audio:', err);
        toast('Audio encoding failed — sending without song');
      }
    }

    if (confirmBtn) confirmBtn.textContent = 'uploading…';

    // Upload a data URI to Cloudinary, returns secure_url
    const uploadToCloudinary = async (dataUri: string, resourceType: 'image' | 'video', label: string): Promise<string> => {
      toast(`Uploading ${label}…`);
      const res = await fetch(dataUri);
      const blob = await res.blob();
      const fd = new FormData();
      fd.append('file', blob);
      fd.append('upload_preset', 'wclswrwx');
      // 3-day auto-expiry via eager transformation tag
      fd.append('tags', 'retronote,expires_3d');
      const cRes = await fetch(`https://api.cloudinary.com/v1_1/dt2unqegp/${resourceType}/upload`, {
        method: 'POST', body: fd,
      });
      if (!cRes.ok) throw new Error(`Cloudinary ${label} upload failed: ${cRes.status} ${await cRes.text()}`);
      return (await cRes.json()).secure_url as string;
    };

    // Upload all photos to Cloudinary
    const photoUrls = await Promise.all(
      S.photos.slice(0, 6)
        .filter(s => s.startsWith('data:image/'))
        .map((src, i) => uploadToCloudinary(src, 'image', `photo ${i + 1}`))
    );

    // Upload audio to Cloudinary
    let audioUrl: string | null = null;
    if (trimmedSong) {
      audioUrl = await uploadToCloudinary(trimmedSong, 'video', 'audio ♪');
    }

    // Album art (small, upload to Cloudinary too)
    let albumArtUrl: string | null = null;
    if (S.songAlbumArt) {
      try { albumArtUrl = await uploadToCloudinary(S.songAlbumArt, 'image', 'album art'); }
      catch { albumArtUrl = null; }
    }

    if (confirmBtn) confirmBtn.textContent = 'sealing…';
    toast('Sealing your letter…');

    // Upload letter metadata as a JSON file to Cloudinary (raw resource type)
    const letterMeta = {
      r:    S.recipient.trim().slice(0, 32),
      n:    S.note.trim().slice(0, 2000),
      p:    photoUrls,
      aurl: audioUrl,
      sn:   S.songName?.slice(0, 120) ?? null,
      sa:   albumArtUrl,
      d:    new Date().toISOString(),
    };
    const metaBlob = new Blob([JSON.stringify(letterMeta)], { type: 'application/json' });
    const metaFd = new FormData();
    metaFd.append('file', metaBlob, 'letter.json');
    metaFd.append('upload_preset', 'wclswrwx');
    metaFd.append('tags', 'retronote,expires_3d');
    const metaRes = await fetch('https://api.cloudinary.com/v1_1/dt2unqegp/raw/upload', {
      method: 'POST', body: metaFd,
    });
    if (!metaRes.ok) throw new Error(`Cloudinary meta upload failed: ${metaRes.status} ${await metaRes.text()}`);
    const metaData = await metaRes.json();
    const metaUrl  = metaData.secure_url as string;
    // Store only the Cloudinary public_id in the hash — short and stable
    const publicId = metaData.public_id as string;

    const link   = `${window.location.origin}/letter#${encodeURIComponent(publicId)}`;
    const sizeKB = Math.round(link.length / 1024);

    // Bug 3 fix: stop audio BEFORE wiping state so the ref isn't lost
    if (S.composeAudio) { (S.composeAudio as HTMLAudioElement).pause(); S.composeAudio = null; }
    if (_trimPreviewAudio) { _trimPreviewAudio.pause(); _trimPreviewAudio = null; }

    // Reset state and clear saved draft
    Object.assign(S, {
      photos: [], songSrc: null, songName: null, songAlbumArt: null,
      recipient: '', note: '', composeIsPlaying: false, trimStart: 0, songDuration: 0,
    });
    clearSession();

    closePreviewOverlay();
    const appRoot = document.getElementById('rn-app');
    if (appRoot) renderCompose(appRoot);
    showShareBanner(link, sizeKB, letterMeta);
    toast('Sealed & sent ✦');

  } catch (err) {
    toast('Failed to encode letter. Try smaller files.');
    console.error(err);
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'confirm & send ✦'; }
  }
}

function showShareBanner(link: string, sizeKB: number, letter: any) {
  const banner = document.getElementById('c-share-banner');
  if (!banner) return;

  banner.style.display = '';
  const shareLink = document.getElementById('c-share-link') as HTMLInputElement | null;
  if (shareLink) shareLink.value = link;

  const sizeEl = document.getElementById('c-share-size');
  if (sizeEl) {
    sizeEl.textContent = `link size: ~${sizeKB} KB${sizeKB > 64 ? ' — very long, some apps may truncate it' : ''}`;
    sizeEl.style.color = sizeKB > 64 ? '#b05030' : 'var(--muted)';
  }

  // Native share sheet (iOS Safari, Android Chrome, modern desktop Chrome)
  const nativeBtn = document.getElementById('c-native-share');
  if (nativeBtn && navigator.share) {
    nativeBtn.style.display = '';
    nativeBtn.addEventListener('click', async () => {
      try {
        await navigator.share({
          title: `a retro note${letter.r ? ` from ${letter.r}` : ''}`,
          text:  'someone sent you a retro note ✦',
          url:   link,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') toast('Could not open share sheet');
      }
    });
    nativeBtn.addEventListener('mouseenter', (e) => { (e.currentTarget as HTMLElement).style.opacity = '.8'; });
    nativeBtn.addEventListener('mouseleave', (e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; });
  }

  const copyBtn = document.getElementById('c-copy-btn');
  if (copyBtn) copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(link).catch(() => {});
    toast('Link copied!');
  });
  const closeBtn = document.getElementById('c-close-share');
  if (closeBtn) closeBtn.addEventListener('click', () => {
    banner.style.display = 'none';
  });
}

/* ═══════════════════════════════════════════════════
   LETTER PAGE  (recipient view — data from URL hash)
   ═══════════════════════════════════════════════════ */
async function renderLetterPage(root: HTMLElement) {
  stopAllAudio();
  root.innerHTML = loadingHTML();

  const hashVal = window.location.hash.slice(1);
  if (!hashVal) { root.innerHTML = notFoundHTML(); return; }

  let letter;
  try {
    const publicId = decodeURIComponent(hashVal);
    // Fetch the letter JSON from Cloudinary by public_id
    const metaUrl = `https://res.cloudinary.com/dt2unqegp/raw/upload/${publicId}`;
    const res = await fetch(metaUrl);
    if (!res.ok) throw new Error(`Cloudinary fetch failed: ${res.status}`);
    letter = await res.json();
    if (!letter.s && letter.aurl) letter.s = letter.aurl;
  } catch (err) {
    console.error('Failed to decode letter hash:', err);
    root.innerHTML = corruptHTML();
    return;
  }

  const data = {
    recipientName: letter.r  ?? '',
    note:          letter.n  ?? '',
    photos:        letter.p  ?? [],
    songData:      letter.s  ?? null,
    songName:      letter.sn ?? null,
    songAlbumArt:  letter.sa ?? null,
  };

  root.innerHTML = `
    <button id="lp-home" style="position:fixed;top:1.5rem;left:1.75rem;background:rgba(247,242,232,.9);border:1px solid var(--aged);padding:.45rem 1rem;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);cursor:pointer;transition:all .2s;z-index:100;backdrop-filter:blur(8px);">← home</button>
    <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;">
      ${buildCollageHTML({
        recipient: data.recipientName,
        note:      data.note,
        photos:    data.photos,
        hasSong:   !!data.songData,
        albumArt:  data.songAlbumArt,
        id:        'lp',
      })}
      ${data.songData
        ? `<p id="lp-song-lbl" style="margin-top:2rem;text-align:center;color:var(--muted);font-size:.88rem;font-style:italic;font-family:'IM Fell English',Georgia,serif;">♪ click the vinyl to play${data.songName ? ` · ${esc(data.songName)}` : ''}</p>`
        : ''}
    </div>
  `;

  const hb = document.getElementById('lp-home') as HTMLButtonElement | null;
  if (hb) {
    hb.addEventListener('click', () => navigate('/'));
    hb.addEventListener('mouseenter', (e) => { (e.currentTarget as HTMLElement).style.color = 'var(--sepia)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--sepia)'; });
    hb.addEventListener('mouseleave', (e) => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--aged)'; });
  }

  bindCollageEvents({
    id:        'lp',
    hasSong:   !!data.songData,
    audioSrc:  data.songData,
    recipient: data.recipientName,
    note:      data.note,
    onPlayingChange: (playing: boolean) => {
      const lbl = document.getElementById('lp-song-lbl');
      if (lbl) lbl.textContent = `♪ ${playing ? 'now playing' : 'click the vinyl to play'}${data.songName ? ` · ${data.songName}` : ''}`;
    },
  });
}

/* ═══════════════════════════════════════════════════
   SMALL HTML FRAGMENTS
   ═══════════════════════════════════════════════════ */
const centred = (content: string) =>
  `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;color:var(--muted);">${content}</div>`;

const loadingHTML  = () => centred('<span style="font-size:1rem;letter-spacing:.22em;text-transform:uppercase;">opening letter…</span>');
const notFoundHTML = () => centred('<span style="font-family:\'Playfair Display\',Georgia,serif;font-size:1.3rem;">letter not found</span>');
const corruptHTML  = () => centred('<span style="font-family:\'Playfair Display\',Georgia,serif;font-size:1.3rem;">could not open letter — link may be corrupted</span>');