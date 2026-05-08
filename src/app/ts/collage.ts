// collage.js — envelope + vinyl + photos collage widget
// Renders the shareable letter collage as HTML and wires up all interactions.

import { esc } from './utils';

/**
 * Returns the inner HTML string for a letter collage (vinyl, envelope, photos).
 * The returned string is safe to set as innerHTML inside a container.
 */
export function buildCollageHTML({ recipient, note, photos, hasSong, albumArt, id }) {
  const KRAFT = 'linear-gradient(148deg,#c9a878 0%,#b78d56 50%,#c3a26e 100%)';
  const FOLDS = [
    'linear-gradient(to bottom right,transparent 49.5%,rgba(0,0,0,.055) 49.5%,rgba(0,0,0,.055) 50.5%,transparent 50.5%)',
    'linear-gradient(to bottom left,transparent 49.5%,rgba(0,0,0,.055) 49.5%,rgba(0,0,0,.055) 50.5%,transparent 50.5%)',
  ].join(',');

  const labelInner = albumArt
    ? `<img src="${esc(albumArt)}" alt="" aria-hidden="true" class="vinyl-label-art" />`
    : `<span class="vinyl-label-name"><strong>retro</strong>note</span>`;

  const photosHTML = buildPhotosHTML(photos);

  return `
    <div class="lp-stage" id="coll-${id}">
      <!-- vinyl -->
      <div id="vw-${id}" style="position:absolute;left:18px;top:42px;width:330px;height:330px;z-index:1;cursor:${hasSong ? 'pointer' : 'default'};">
        <div class="vinyl-wrap" style="width:100%;height:100%;">
          <div class="vinyl-disc"></div>
          <div class="vinyl-label-ring">
            <div id="vlf-${id}" class="vinyl-label-face">${labelInner}</div>
          </div>
          <div class="tonearm-wrap"><div class="tonearm"></div></div>
        </div>
      </div>
      <!-- envelope back -->
      <div style="position:absolute;left:188px;top:188px;width:290px;height:200px;transform:rotate(-6deg);background:${KRAFT};box-shadow:2px 5px 16px rgba(0,0,0,.2),inset 0 0 0 1px rgba(0,0,0,.06);z-index:2;">
        <div style="position:absolute;inset:0;background:${FOLDS};pointer-events:none;"></div>
      </div>
      <!-- letter card -->
      <div id="lc-${id}" style="position:absolute;left:208px;top:240px;width:202px;height:265px;transform:translateY(0) rotate(-11deg);transition:transform .44s cubic-bezier(.34,1.38,.64,1);background:linear-gradient(160deg,#f5e8d5 0%,#eeddd0 38%,#eedcc6 100%);padding:.9rem .85rem;box-shadow:0 2px 8px rgba(0,0,0,.15);z-index:3;overflow:hidden;clip-path:inset(0 0 118px 0);pointer-events:none;cursor:default;">
        <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:.14em;color:#8b5e3c;font-family:'Cormorant Garamond',serif;margin-bottom:.5rem;">from ${esc(recipient)}</div>
        <div style="font-family:'IM Fell English',Georgia,serif;font-size:.78rem;line-height:1.75;color:#2a1208;font-style:italic;overflow:hidden;display:-webkit-box;-webkit-line-clamp:8;-webkit-box-orient:vertical;">${esc(note) || '[ no note ]'}</div>
      </div>
      <!-- envelope front -->
      <div id="ef-${id}" style="position:absolute;left:188px;top:216px;width:290px;height:172px;transform:rotate(-6deg);background:${KRAFT};cursor:pointer;z-index:4;overflow:hidden;transition:filter .2s;">
        <div style="position:absolute;inset:0;background:${FOLDS};pointer-events:none;"></div>
        <div style="position:absolute;top:0;left:0;right:0;height:14px;background:linear-gradient(to bottom,rgba(0,0,0,.16),transparent);pointer-events:none;"></div>
      </div>
      <!-- envelope mouth -->
      <div style="position:absolute;left:192px;top:210px;width:282px;height:10px;transform:rotate(-6deg);background:rgba(48,26,6,.38);z-index:5;pointer-events:none;"></div>
      <div style="position:absolute;left:188px;top:215px;width:290px;height:2px;transform:rotate(-6deg);background:#a07038;opacity:.7;z-index:5;pointer-events:none;"></div>
      <!-- open hint -->
      <div id="eh-${id}" style="position:absolute;left:188px;top:188px;width:290px;height:28px;transform:rotate(-6deg);cursor:pointer;z-index:5;display:flex;align-items:center;justify-content:center;">
        <span id="eht-${id}" style="font-size:.52rem;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,240,210,.7);font-family:'Cormorant Garamond',serif;opacity:0;transition:opacity .2s;pointer-events:none;text-shadow:0 1px 2px rgba(0,0,0,.4);">open ↑</span>
      </div>
      ${photosHTML}
    </div>
  `;
}

/**
 * Wires up all interactions for a rendered collage:
 * vinyl click → play/pause, envelope click → open letter, letter card → parchment modal.
 */
export function bindCollageEvents({ id, hasSong, audioSrc, recipient, note, onPlayingChange }) {
  let letterOut = false;
  let modalOpen = false;
  let isPlaying = false;
  let audio     = null;

  // ── Vinyl playback ──────────────────────────────────────────────────────────
  const vinylEl = document.querySelector(`#vw-${id} .vinyl-wrap`);
  if (vinylEl && hasSong && audioSrc) {
    vinylEl.addEventListener('click', () => {
      isPlaying = !isPlaying;
      if (isPlaying) {
        if (!audio) {
          audio = new Audio(audioSrc);
          audio.addEventListener('ended', () => {
            isPlaying = false;
            vinylEl.classList.remove('playing');
            onPlayingChange?.(false);
          });
        }
        audio.play().catch(() => {});
        vinylEl.classList.add('playing');
      } else {
        audio?.pause();
        vinylEl.classList.remove('playing');
      }
      onPlayingChange?.(isPlaying);
    });
  }

  // ── Envelope open ───────────────────────────────────────────────────────────
  const envFront = document.getElementById(`ef-${id}`);
  const envHint  = document.getElementById(`eh-${id}`);
  const hintTxt  = document.getElementById(`eht-${id}`);
  const ltrCard  = document.getElementById(`lc-${id}`);

  function openModal() {
    if (modalOpen) return;
    modalOpen = true;
    showParchmentModal(recipient, note, () => { modalOpen = false; });
  }

  function openLetter() {
    if (modalOpen) return;
    if (letterOut) { openModal(); return; }
    letterOut = true;

    if (ltrCard) {
      ltrCard.style.transform    = 'translateY(-108px) rotate(-11deg)';
      ltrCard.style.boxShadow    = '0 8px 28px rgba(0,0,0,.28),-2px 3px 8px rgba(0,0,0,.12)';
      ltrCard.style.pointerEvents = 'auto';
      ltrCard.style.cursor       = 'pointer';
      ltrCard.addEventListener('click', openModal);
      const hint = document.createElement('div');
      hint.style.cssText = "position:absolute;bottom:.6rem;right:.7rem;font-size:.52rem;letter-spacing:.12em;text-transform:uppercase;color:#8b5e3c;opacity:.5;font-family:'Cormorant Garamond',serif;";
      hint.textContent = 'read ↗';
      ltrCard.appendChild(hint);
    }
    if (envFront) envFront.style.cursor = 'default';
    if (envHint)  envHint.style.cursor  = 'default';
    setTimeout(() => { if (!modalOpen) openModal(); }, 430);
  }

  const hoverOn  = () => {
    if (!letterOut && envFront) envFront.style.filter = 'brightness(1.06)';
    if (hintTxt) hintTxt.style.opacity = '1';
  };
  const hoverOff = () => {
    if (envFront) envFront.style.filter = '';
    if (hintTxt) hintTxt.style.opacity = '0';
  };

  [envFront, envHint].forEach(el => {
    if (!el) return;
    el.addEventListener('click', openLetter);
    el.addEventListener('mouseenter', hoverOn);
    el.addEventListener('mouseleave', hoverOff);
  });
}

/**
 * Renders and displays the parchment letter modal over the page.
 */
export function showParchmentModal(recipient, note, onClose) {
  let overlay = document.getElementById('pm-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'pm-overlay';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div id="pm-backdrop" style="position:fixed;inset:0;background:rgba(12,7,2,.84);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;z-index:10000;padding:2rem;">
      <div class="parchment-scroll" style="position:relative;max-width:540px;width:92%;max-height:84vh;overflow-y:auto;background-color:#f0e6c4;background-image:repeating-linear-gradient(transparent 0px,transparent 27px,rgba(122,92,30,.11) 27px,rgba(122,92,30,.11) 28px),linear-gradient(160deg,#faf2dc 0%,#f0e4c2 30%,#e8d8b0 60%,#f0e4c2 100%);padding:3rem 2.5rem;box-shadow:0 2px 4px rgba(0,0,0,.4),0 14px 40px rgba(0,0,0,.38),0 28px 64px rgba(0,0,0,.2);animation:parchmentReveal .38s cubic-bezier(.34,1.4,.64,1) both;">
        <div style="position:absolute;top:0;left:0;right:0;height:44px;background:linear-gradient(to bottom,rgba(70,42,12,.16),transparent);pointer-events:none;z-index:5;"></div>
        <button id="pm-close" aria-label="Close" style="position:absolute;top:.9rem;right:1rem;background:none;border:none;cursor:pointer;font-size:1.5rem;color:var(--sepia);opacity:.48;line-height:1;padding:.25rem .5rem;transition:opacity .15s;">×</button>
        <div style="font-size:.68rem;letter-spacing:.22em;text-transform:uppercase;color:var(--sepia);font-family:'Cormorant Garamond',serif;margin-bottom:.5rem;">from ${esc(recipient)}</div>
        <div style="width:100%;height:1px;background:linear-gradient(to right,rgba(122,92,30,.5),rgba(122,92,30,.04));margin-bottom:1.75rem;"></div>
        <div style="font-family:'IM Fell English',Georgia,serif;font-size:1.05rem;line-height:1.96;font-style:italic;color:#1c0e04;white-space:pre-wrap;">${esc(note) || '[ no note written ]'}</div>
        <div style="position:absolute;bottom:0;left:0;right:0;height:40px;background:linear-gradient(to top,rgba(70,42,12,.18),transparent);pointer-events:none;"></div>
      </div>
    </div>
  `;

  const close = () => { overlay.innerHTML = ''; onClose?.(); };
  document.getElementById('pm-backdrop').addEventListener('click', e => {
    if (e.target === e.currentTarget) close();
  });
  const closeBtn = document.getElementById('pm-close');
  closeBtn.addEventListener('click', close);
  closeBtn.addEventListener('mouseenter', e => { e.currentTarget.style.opacity = '1'; });
  closeBtn.addEventListener('mouseleave', e => { e.currentTarget.style.opacity = '.48'; });
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function buildPhotosHTML(photos) {
  if (!photos.length) return '';

  if (photos.length === 1) {
    return `<div style="position:absolute;left:284px;top:80px;transform:rotate(7deg);z-index:6;background:#fff;padding:10px 10px 34px;box-shadow:0 6px 24px rgba(0,0,0,.28);width:168px;">
      <img src="${esc(photos[0])}" alt="" style="width:100%;height:148px;object-fit:cover;display:block;filter:sepia(10%) contrast(.93);" />
    </div>`;
  }

  const FILM = 'repeating-linear-gradient(to bottom,#0d0d0d 0,#0d0d0d 4px,rgba(255,255,255,.85) 4px,rgba(255,255,255,.85) 13px,#0d0d0d 13px,#0d0d0d 20px)';
  return `<div style="position:absolute;left:308px;top:-18px;transform:rotate(5deg);z-index:6;background:#0d0d0d;padding:10px 18px;box-shadow:0 10px 28px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:3px;">
    <div style="position:absolute;left:3px;top:0;bottom:0;width:10px;background:${FILM};"></div>
    <div style="position:absolute;right:3px;top:0;bottom:0;width:10px;background:${FILM};"></div>
    ${photos.slice(0, 4).map(p =>
      `<img src="${esc(p)}" alt="" style="width:108px;height:104px;object-fit:cover;display:block;filter:grayscale(18%) contrast(1.05) brightness(.95);" />`
    ).join('')}
  </div>`;
}
