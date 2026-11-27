'use strict';
/* Catedra – sincronizare automată prin Wi‑Fi.
   Calculatorul (aplicația desktop) este „centrul”: pornește un mic server în rețeaua locală.
   Telefonul / browserul se asociază o singură dată (adresă + cod) și apoi se sincronizează singur. */
const Sync = (() => {
  const C = SyncCore;
  let hashes = {};
  let timer = null, busy = false, lastScan = 0;
  const status = { text: '', ok: null, at: 0 };
  const isHub = () => !!(window.desktop && window.desktop.syncServer);

  function ensure() {
    if (!D.sync) D.sync = { deviceId: C.randomId(), meta: {}, del: {}, clock: 0, peer: null, hub: null };
    D.sync.meta = D.sync.meta || {}; D.sync.del = D.sync.del || {};
    return D.sync;
  }
  function stateForWire() { const s = ensure(); return { ent: C.entities(D), meta: s.meta, del: s.del }; }

  // Apelată la fiecare salvare: notează ce s-a modificat.
  function onSave() {
    const s = ensure();
    const r = C.stamp(s, hashes, C.entities(D));
    hashes = r.hashes;
    if (r.changed && s.peer) schedule(2500);
  }
  // Apelată după ce datele au fost încărcate / înlocuite din afară.
  function reset() { ensure(); hashes = C.hashes(C.entities(D)); }

  // Îmbină o stare primită și reafișează (fără a strica un formular deschis).
  function absorb(remote) {
    const s = ensure();
    const { merged, changedLocal } = C.merge(stateForWire(), remote);
    C.applyEntities(D, merged.ent);
    s.meta = merged.meta; s.del = merged.del;
    hashes = C.hashes(C.entities(D));
    persist();
    if (changedLocal) refreshView();
    return merged;
  }
  function persist() { const json = JSON.stringify(D); try { if (window.desktop) window.desktop.save(json); else { localStorage.setItem(KEY, json); if (window.mobile) window.mobile.mirror(json); } } catch (e) {} }
  let pendingRefresh = false;
  function refreshView() {
    const editing = !$('#modal').classList.contains('hidden') || state.editing || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName));
    if (editing) { pendingRefresh = true; return; }
    pendingRefresh = false; go(current);
  }
  document.addEventListener('focusout', () => { if (pendingRefresh) setTimeout(refreshView, 300); });

  // ---------- Client (telefon / browser) ----------
  const timeoutFetch = (url, opts = {}, ms = 4000) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t)); };
  const base = (host) => `http://${host}:${C.PORT}/catedra`;

  async function hello(host, ms) {
    const r = await timeoutFetch(base(host) + '/hello', {}, ms);
    const j = await r.json(); if (j.app !== 'catedra') throw new Error('nu este Catedra');
    return j;
  }
  async function exchange(host, code) {
    const msg = await C.seal(code, { from: ensure().deviceId, name: deviceName(), state: stateForWire() });
    const r = await timeoutFetch(base(host) + '/sync', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(msg) }, 15000);
    if (r.status === 403) throw new Error('cod greșit');
    if (!r.ok) throw new Error('eroare server ' + r.status);
    return C.open(code, await r.json());
  }
  // Caută calculatorul în aceeași rețea (dacă i s-a schimbat adresa IP).
  async function scan(prevHost, hubId) {
    const m = String(prevHost).match(/^(\d+\.\d+\.\d+)\.\d+$/); if (!m) return null;
    const hosts = Array.from({ length: 254 }, (_, i) => `${m[1]}.${i + 1}`).filter((h) => h !== prevHost);
    for (let i = 0; i < hosts.length; i += 40) {
      const found = await Promise.all(hosts.slice(i, i + 40).map((h) => hello(h, 1500).then((j) => (j.id === hubId ? h : null)).catch(() => null)));
      const h = found.find(Boolean); if (h) return h;
    }
    return null;
  }
  async function syncNow(manual) {
    const s = ensure(); if (!s.peer || busy) return;
    busy = true; setStatus('Se sincronizează…', null);
    try {
      let host = s.peer.host;
      try { await hello(host, 3000); }
      catch (e) {
        if (Date.now() - lastScan < 5 * 60 * 1000 && !manual) throw new Error('Calculatorul nu este găsit în rețea');
        lastScan = Date.now(); setStatus('Caut calculatorul în rețea…', null);
        const h = await scan(host, s.peer.hubId); if (!h) throw new Error('Calculatorul nu este găsit în rețea');
        s.peer.host = host = h;
      }
      const reply = await exchange(host, s.peer.code);
      absorb(reply.state);
      s.peer.lastOk = Date.now(); persist();
      setStatus('Sincronizat', true);
    } catch (e) {
      setStatus(e.name === 'AbortError' ? 'Calculatorul nu răspunde' : (e.message || 'Eroare'), false);
    } finally { busy = false; }
  }
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(() => { syncNow(); schedule(30000); }, ms); }

  async function pair(host, code) {
    host = host.trim().replace(/^https?:\/\//, '').replace(/[:/].*$/, '');
    const j = await hello(host, 5000);
    const s = ensure();
    s.peer = { host, code: C.normCode(code), hubId: j.id, lastOk: 0 };
    const reply = await exchange(host, s.peer.code); // verifică și codul
    absorb(reply.state); s.peer.lastOk = Date.now(); persist();
    setStatus('Sincronizat', true); schedule(30000);
  }
  function unpair() { ensure().peer = null; clearTimeout(timer); persist(); setStatus('', null); }

  // ---------- Centru (aplicația desktop) ----------
  async function hubStart() {
    const s = ensure();
    if (!s.hub) s.hub = { id: C.randomId(), code: C.randomCode(), enabled: true, devices: {} };
    s.hub.enabled = true; persist();
    return window.desktop.syncServer({ enabled: true, id: s.hub.id, code: s.hub.code });
  }
  async function hubStop() { const s = ensure(); if (s.hub) s.hub.enabled = false; persist(); return window.desktop.syncServer({ enabled: false }); }
  function hubNewCode() { const s = ensure(); s.hub.code = C.randomCode(); s.hub.devices = {}; persist(); return hubStart(); }
  // Cerere primită de la un telefon (decriptată deja în procesul principal).
  function hubIncoming(req) {
    const s = ensure();
    const merged = absorb(req.state);
    s.hub.devices[req.from] = { name: String(req.name || 'Dispozitiv').slice(0, 60), at: Date.now() };
    persist();
    setStatus('Sincronizat cu ' + s.hub.devices[req.from].name, true);
    return { state: merged };
  }

  function deviceName() {
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) return 'Telefon Android'; if (/iPhone|iPad/i.test(ua)) return 'iPhone/iPad';
    return 'Browser';
  }
  function setStatus(text, ok) {
    Object.assign(status, { text, ok, at: Date.now() });
    const el = $('#sync-status'); if (el) render(el);
    if (current === 'sync' && !busy) { const v = $('#sync-live'); if (v) v.textContent = statusLine(); }
  }
  const ago = (t) => { if (!t) return 'niciodată'; const s = Math.round((Date.now() - t) / 1000); return s < 60 ? 'acum câteva secunde' : s < 3600 ? `acum ${Math.round(s / 60)} min` : new Date(t).toLocaleString('ro-RO'); };
  const statusLine = () => status.text ? `${status.ok === false ? '⚠️' : status.ok ? '✅' : '🔄'} ${status.text} · ${ago(status.at)}` : '';
  function render(el) {
    const s = D.sync || {};
    const on = isHub() ? s.hub && s.hub.enabled : !!s.peer;
    el.innerHTML = on ? `<span>${status.ok === false ? '⚠️' : '📶'} Wi‑Fi: ${esc(status.ok === false ? status.text : status.text || 'activ')}</span>` : '';
  }

  async function init() {
    reset();
    const el = document.createElement('div'); el.id = 'sync-status'; el.className = 'sync-status';
    el.addEventListener('click', () => go('sync'));
    $('.sem-switch').before(el);
    if (isHub()) {
      window.desktop.onSyncRequest(hubIncoming);
      if (D.sync.hub && D.sync.hub.enabled) { try { await hubStart(); setStatus('Așteaptă telefoanele', true); } catch (e) { setStatus('Serverul nu a pornit', false); } }
    } else if (D.sync.peer) {
      schedule(800);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(300); });
      window.addEventListener('online', () => schedule(500));
    }
    render(el);
    setInterval(() => render(el), 30000);
  }

  return { init, onSave, reset, syncNow, pair, unpair, hubStart, hubStop, hubNewCode, isHub, status, statusLine, ago };
})();
