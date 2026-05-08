// encoding.js — URL hash serialization (pako deflate + base64)
// The letter payload is compressed and stored entirely in the URL fragment,
// so no server or database is needed for sharing.

let _pako = null;

async function getPako() {
  if (_pako) return _pako;
  if (window.pako) { _pako = window.pako; return _pako; }
  await new Promise((resolve, reject) => {
    const s   = document.createElement('script');
    s.src     = 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js';
    s.onload  = resolve;
    s.onerror = () => reject(new Error('Failed to load pako from CDN'));
    document.head.appendChild(s);
  });
  _pako = window.pako;
  return _pako;
}

/**
 * Compresses a letter object to a base64 string suitable for a URL hash.
 * @param {object} letter
 * @returns {Promise<string>} base64-encoded compressed payload
 */
export async function encodeLetterToHash(letter) {
  const pk         = await getPako();
  const json       = JSON.stringify(letter);
  const compressed = pk.deflate(new TextEncoder().encode(json));
  let binary = '';
  compressed.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

/**
 * Decompresses and parses a letter object from a base64 URL hash string.
 * @param {string} hash  — the raw hash value (without the leading #)
 * @returns {Promise<object>}
 */
export async function decodeLetterFromHash(hash) {
  const pk     = await getPako();
  const binary = atob(hash);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const json = new TextDecoder().decode(pk.inflate(bytes));
  return JSON.parse(json);
}
