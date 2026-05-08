// encoding.ts — URL hash serialization (pako deflateRaw + URL-safe base64)

let _pako = null;

async function getPako() {
  if (_pako) return _pako;
  if ((window as any).pako) { _pako = (window as any).pako; return _pako; }
  await new Promise((resolve, reject) => {
    const s   = document.createElement('script');
    s.src     = 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js';
    s.onload  = resolve;
    s.onerror = () => reject(new Error('Failed to load pako'));
    document.head.appendChild(s);
  });
  _pako = (window as any).pako;
  return _pako;
}

/** Uint8Array → URL-safe base64, no btoa, handles any payload size */
function u8ToBase64url(u8: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  const len = u8.length;
  let i = 0;
  for (; i + 2 < len; i += 3) {
    const n = (u8[i] << 16) | (u8[i+1] << 8) | u8[i+2];
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63] + chars[(n >> 6) & 63] + chars[n & 63];
  }
  if (i + 1 === len) {
    const n = u8[i] << 16;
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63];
  } else if (i + 2 === len) {
    const n = (u8[i] << 16) | (u8[i+1] << 8);
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63] + chars[(n >> 6) & 63];
  }
  return out;
}

/** URL-safe base64 → Uint8Array, no atob, handles any payload size */
function base64urlToU8(str: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const lookup = new Uint8Array(256).fill(255);
  for (let i = 0; i < 64; i++) lookup[chars.charCodeAt(i)] = i;
  const len = str.length;
  const out = new Uint8Array(Math.ceil(len * 3 / 4));
  let o = 0, i = 0;
  for (; i + 3 < len; i += 4) {
    const n = (lookup[str.charCodeAt(i)] << 18) | (lookup[str.charCodeAt(i+1)] << 12) |
              (lookup[str.charCodeAt(i+2)] << 6)  |  lookup[str.charCodeAt(i+3)];
    out[o++] = (n >> 16) & 255;
    out[o++] = (n >> 8)  & 255;
    out[o++] =  n        & 255;
  }
  if (i < len) {
    const a = lookup[str.charCodeAt(i)];
    const b = i+1 < len ? lookup[str.charCodeAt(i+1)] : 0;
    const c = i+2 < len ? lookup[str.charCodeAt(i+2)] : 0;
    const n = (a << 18) | (b << 12) | (c << 6);
    out[o++] = (n >> 16) & 255;
    if (i+1 < len) out[o++] = (n >> 8) & 255;
    if (i+2 < len) out[o++] = n & 255;
  }
  return out.subarray(0, o);
}

export async function encodeLetterToHash(letter): Promise<string> {
  const pk         = await getPako();
  const compressed = pk.deflateRaw(new TextEncoder().encode(JSON.stringify(letter))) as Uint8Array;
  return u8ToBase64url(compressed);
}

export async function decodeLetterFromHash(hash: string): Promise<object> {
  const pk    = await getPako();
  const bytes = base64urlToU8(hash);
  let inflated: Uint8Array;
  try   { inflated = pk.inflateRaw(bytes) as Uint8Array; }
  catch { inflated = pk.inflate(bytes)    as Uint8Array; }
  return JSON.parse(new TextDecoder().decode(inflated));
}