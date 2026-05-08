// session.js — sessionStorage draft checkpoint
// Persists compose state across accidental navigation (back/forward).
// Audio is included only if it fits within sessionStorage quota (~5 MB);
// if it doesn't fit it's silently dropped — the rest of the form still restores.

const SESSION_KEY = 'rn_draft';

/**
 * Saves the relevant fields from the state object S to sessionStorage.
 * @param {object} S  — the global compose state
 */
export function saveSession(S) {
  try {
    const draft = {
      recipient:    S.recipient,
      note:         S.note,
      trimStart:    S.trimStart,
      songName:     S.songName,
      songAlbumArt: S.songAlbumArt,
      songDuration: S.songDuration,
      photos:       S.photos,
      songSrc:      null,
    };
    // Probe whether the audio blob fits before committing it
    if (S.songSrc) {
      try {
        sessionStorage.setItem(SESSION_KEY + '_probe', S.songSrc);
        sessionStorage.removeItem(SESSION_KEY + '_probe');
        draft.songSrc = S.songSrc;
      } catch { /* audio too large — will be absent on restore, that is fine */ }
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(draft));
  } catch { /* sessionStorage unavailable or full — silently skip */ }
}

/**
 * Restores saved draft fields into the state object S.
 * Mutates S in place; call before the first render.
 * @param {object} S  — the global compose state
 */
export function loadSession(S) {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const draft    = JSON.parse(raw);
    S.recipient    = draft.recipient    ?? '';
    S.note         = draft.note         ?? '';
    S.trimStart    = draft.trimStart    ?? 0;
    S.songName     = draft.songName     ?? null;
    S.songAlbumArt = draft.songAlbumArt ?? null;
    S.songDuration = draft.songDuration ?? 0;
    S.photos       = Array.isArray(draft.photos) ? draft.photos : [];
    S.songSrc      = draft.songSrc      ?? null;
  } catch { /* corrupt draft — ignore */ }
}

/**
 * Clears the saved draft. Call after a successful send.
 */
export function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}
