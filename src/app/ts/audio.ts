// audio.js — audio trimming and WAV encoding
// Trims a full audio data URI to a 30s mono clip at 22kHz via OfflineAudioContext

export const CLIP_DURATION = 30; // seconds
const TARGET_RATE = 22050;       // downsample to 22kHz — halves file size vs 44.1kHz

/**
 * Decodes a full audio data URI, extracts [startSec, startSec + 30s],
 * downmixes to mono at 22kHz, and returns a WAV data URI.
 */
export async function trimAudioTo30s(dataUri, startSec) {
  const buffer = dataUriToArrayBuffer(dataUri);

  const audioCtx = new AudioContext();
  const decoded  = await audioCtx.decodeAudioData(buffer);
  await audioCtx.close();

  const clipSamples = Math.floor(
    Math.min(CLIP_DURATION, decoded.duration - startSec) * TARGET_RATE
  );

  const offline = new OfflineAudioContext(1, clipSamples, TARGET_RATE);
  const src     = offline.createBufferSource();

  // Mix channels down to mono at the original sample rate;
  // OfflineAudioContext handles resampling to TARGET_RATE on render.
  const origRate   = decoded.sampleRate;
  const monoBuffer = new OfflineAudioContext(1, decoded.length, origRate)
    .createBuffer(1, decoded.length, origRate);
  const monoData = monoBuffer.getChannelData(0);
  const chans    = decoded.numberOfChannels;
  for (let i = 0; i < decoded.length; i++) {
    let sum = 0;
    for (let c = 0; c < chans; c++) sum += decoded.getChannelData(c)[i];
    monoData[i] = sum / chans;
  }

  src.buffer = monoBuffer;
  src.connect(offline.destination);
  src.start(0, startSec, CLIP_DURATION);

  const rendered = await offline.startRendering();
  return audioBufferToWavDataUri(rendered);
}

/**
 * Returns the duration (seconds) of an audio data URI without fully decoding it.
 */
export function getAudioDuration(dataUri) {
  return new Promise(resolve => {
    const a = new Audio();
    a.preload = 'metadata';
    a.addEventListener('loadedmetadata', () => resolve(a.duration || 0), { once: true });
    a.addEventListener('error', () => resolve(0), { once: true });
    a.src = dataUri;
  });
}

/**
 * Reads a File object as a base64 data URI, enforcing type and size limits.
 */
export function readFileAsBase64(file, type) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith(type + '/'))
      return reject(new Error(`Expected ${type} file.`));
    const MAX = type === 'audio' ? 80 : 8; // MB — audio is trimmed on send
    if (file.size > MAX * 1024 * 1024)
      return reject(new Error(`File too large. Max ${MAX} MB.`));
    const r = new FileReader();
    r.onload  = e  => resolve(e.target.result);
    r.onerror = () => reject(new Error('Could not read file.'));
    r.readAsDataURL(file);
  });
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function dataUriToArrayBuffer(dataUri) {
  const base64 = dataUri.split(',')[1];
  const binary = atob(base64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function audioBufferToWavDataUri(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate  = buffer.sampleRate;
  const samples     = buffer.getChannelData(0); // mono
  const bitDepth    = 16;
  const byteRate    = sampleRate * numChannels * (bitDepth / 8);
  const blockAlign  = numChannels * (bitDepth / 8);
  const dataSize    = samples.length * (bitDepth / 8);
  const wavBuffer   = new ArrayBuffer(44 + dataSize);
  const view        = new DataView(wavBuffer);

  const str = (offset, s) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };

  str(0,  'RIFF');  view.setUint32(4,  36 + dataSize, true);
  str(8,  'WAVE');  str(12, 'fmt ');
  view.setUint32(16, 16,          true);
  view.setUint16(20, 1,           true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate,  true);
  view.setUint32(28, byteRate,    true);
  view.setUint16(32, blockAlign,  true);
  view.setUint16(34, bitDepth,    true);
  str(36, 'data');  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  const bytes = new Uint8Array(wavBuffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(bin);
}
