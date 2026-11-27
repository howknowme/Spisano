/* Catedra – nucleul sincronizării (folosit în browser, Android și în procesul principal Electron).
   - Datele sunt împărțite în „entități” (o notă, o absență, o clasă cu elevii ei, o oră din orar...).
   - Fiecare entitate are un marcaj de timp al ultimei modificări; ștergerile lasă „pietre funerare”.
   - La sincronizare câștigă modificarea cea mai recentă, entitate cu entitate.
   - Tot traficul este criptat AES-GCM cu o cheie derivată (PBKDF2) din codul de asociere. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SyncCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const subtle = () => globalThis.crypto.subtle;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const PORT = 47800;
  const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // fără 0/O, 1/I/L

  const b64 = (buf) => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  function randomCode() {
    const r = new Uint8Array(16); globalThis.crypto.getRandomValues(r);
    let s = ''; for (let i = 0; i < 16; i++) { s += ALPHA[r[i] % ALPHA.length]; if (i % 4 === 3 && i < 15) s += '-'; }
    return s; // 16 caractere din 31 ≈ 79 de biți
  }
  const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  function randomId() { const r = new Uint8Array(8); globalThis.crypto.getRandomValues(r); return [...r].map((x) => x.toString(16).padStart(2, '0')).join(''); }

  const keyCache = new Map();
  async function deriveKey(code) {
    const c = normCode(code);
    if (keyCache.has(c)) return keyCache.get(c);
    const base = await subtle().importKey('raw', enc.encode(c), 'PBKDF2', false, ['deriveKey']);
    const key = await subtle().deriveKey({ name: 'PBKDF2', salt: enc.encode('catedra-sync-v1'), iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    keyCache.set(c, key);
    return key;
  }
  async function seal(code, obj) {
    const key = await deriveKey(code);
    const iv = new Uint8Array(12); globalThis.crypto.getRandomValues(iv);
    const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify({ t: Date.now(), d: obj })));
    return { v: 1, iv: b64(iv), ct: b64(ct) };
  }
  // Aruncă eroare dacă codul e greșit sau mesajul e mai vechi de 10 minute (protecție la reluare).
  async function open(code, msg, maxSkewMs = 10 * 60 * 1000) {
    const key = await deriveKey(code);
    const pt = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(msg.iv) }, key, unb64(msg.ct));
    const o = JSON.parse(dec.decode(pt));
    if (Math.abs(Date.now() - o.t) > maxSkewMs) throw new Error('mesaj expirat – verificați ora pe dispozitive');
    return o.d;
  }

  // ---------- Entități ----------
  const LISTS = { g: 'grades', a: 'absences', p: 'plans', l: 'lessons', q: 'questions', c: 'classes' };
  function entities(D) {
    const m = {};
    const { sem, ...settings } = D.settings || {};
    m['s:settings'] = settings;
    for (const [p, k] of Object.entries(LISTS)) for (const x of D[k] || []) m[p + ':' + x.id] = x;
    for (const [k, v] of Object.entries(D.timetable || {})) m['t:' + k] = v;
    return m;
  }
  function applyEntities(D, ent) {
    for (const [p, k] of Object.entries(LISTS)) {
      const old = D[k] || [], seen = new Set(), out = [];
      for (const x of old) { const v = ent[p + ':' + x.id]; if (v) { out.push(v); seen.add(x.id); } }
      for (const [key, v] of Object.entries(ent)) if (key.startsWith(p + ':') && !seen.has(key.slice(2))) out.push(v);
      D[k] = out;
    }
    D.timetable = {};
    for (const [key, v] of Object.entries(ent)) if (key.startsWith('t:')) D.timetable[key.slice(2)] = v;
    if (ent['s:settings']) D.settings = { ...D.settings, ...ent['s:settings'], sem: D.settings.sem };
    return D;
  }
  const hashes = (ent) => { const h = {}; for (const [k, v] of Object.entries(ent)) h[k] = JSON.stringify(v); return h; };

  // Marchează ce s-a schimbat de la ultima salvare. meta[k] = timpul modificării, del[k] = timpul ștergerii.
  function stamp(sync, prevHashes, ent) {
    const now = () => (sync.clock = Math.max(Date.now(), (sync.clock || 0) + 1));
    const cur = hashes(ent);
    let changed = false;
    for (const [k, h] of Object.entries(cur)) {
      if (prevHashes[k] !== undefined && prevHashes[k] !== h) { sync.meta[k] = now(); delete sync.del[k]; changed = true; }
      else if (prevHashes[k] === undefined) { sync.meta[k] = now(); delete sync.del[k]; changed = true; }
      else if (!sync.meta[k]) sync.meta[k] = 1; // date existente dinainte de sincronizare: marcaj minim
    }
    for (const k of Object.keys(prevHashes)) if (!(k in cur)) { sync.del[k] = now(); delete sync.meta[k]; changed = true; }
    return { hashes: cur, changed };
  }

  // Îmbină două stări {ent, meta, del}. Câștigă marcajul cel mai recent; la egalitate rămâne starea locală.
  function merge(local, remote) {
    const out = { ent: {}, meta: {}, del: {} };
    const keys = new Set([...Object.keys(local.meta), ...Object.keys(local.del), ...Object.keys(remote.meta || {}), ...Object.keys(remote.del || {})]);
    let changedLocal = false;
    for (const k of keys) {
      const lt = Math.max(local.meta[k] || 0, local.del[k] || 0);
      const rt = Math.max((remote.meta || {})[k] || 0, (remote.del || {})[k] || 0);
      const src = rt > lt ? remote : local;
      if (src === remote) changedLocal = true;
      if ((src.del || {})[k] && (src.del[k] >= ((src.meta || {})[k] || 0))) out.del[k] = src.del[k];
      else if ((src.meta || {})[k] && src.ent[k] !== undefined) { out.meta[k] = src.meta[k]; out.ent[k] = src.ent[k]; }
    }
    // Entități fără marcaj (date foarte vechi) – se păstrează.
    for (const [k, v] of Object.entries(local.ent)) if (!(k in out.ent) && !(k in out.del)) { out.ent[k] = v; }
    return { merged: out, changedLocal };
  }

  return { PORT, randomCode, randomId, normCode, seal, open, entities, applyEntities, hashes, stamp, merge };
});
