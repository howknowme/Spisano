'use strict';
/* Catedra – asistentul profesorului. Toate datele sunt stocate local, pe calculator. */

// ---------- Stocare ----------
const KEY = 'catedra-date';
const blank = () => ({
  version: 1,
  settings: { teacher: '', school: '', year: '2025-2026', sem: 1, absLimit: 10, periods: 7, startTime: '08:00', lessonMin: 50, breakMin: 10 },
  classes: [], grades: [], absences: [], timetable: {}, plans: [], lessons: [], questions: []
});
function loadData() {
  let raw = null;
  try { raw = window.desktop ? window.desktop.load() : localStorage.getItem(KEY); } catch { raw = null; }
  if (!raw) return blank();
  try { const d = JSON.parse(raw); const b = blank(); return { ...b, ...d, settings: { ...b.settings, ...(d.settings || {}) } }; }
  catch { return blank(); }
}
let D = blank();
function save() {
  try { Sync.onSave(); } catch (e) { console.error(e); }
  const json = JSON.stringify(D);
  try { if (window.desktop) window.desktop.save(json); else { localStorage.setItem(KEY, json); if (window.mobile) window.mobile.mirror(json); } }
  catch { toast('⚠️ Datele nu au putut fi salvate'); }
}

// ---------- Utilitare ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}.${m}.${y}`; };
const sem = () => D.settings.sem;
const cls = (id) => D.classes.find((c) => c.id === id);
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sortStudents = (list) => [...list].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
const DAYS = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri'];

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), msg.length > 60 ? 6000 : 2600); }
function openModal(html, onReady) { $('#modal-box').innerHTML = html; $('#modal').classList.remove('hidden'); onReady && onReady($('#modal-box')); const f = $('#modal-box input, #modal-box select, #modal-box textarea'); f && f.focus(); }
function ask(msg, fn, okLabel = 'Da, continuă') {
  openModal(`<h2>Confirmare</h2><p>${esc(msg)}</p><div class="row"><span class="spacer"></span><button class="btn ghost" data-close>Renunță</button><button class="btn danger" id="ask-ok">${esc(okLabel)}</button></div>`,
    (m) => ($('#ask-ok', m).onclick = () => { closeModal(); fn(); }));
}
function closeModal() { $('#modal').classList.add('hidden'); }
$('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

const embedded = (() => { try { return !window.desktop && window.top !== window.self; } catch { return true; } })();
const EMB_MSG = 'În versiunea online tipărirea și salvarea fișierelor nu sunt disponibile. Folosiți fișierul Catedra.html descărcat pe calculator.';
function printHTML(html) {
  if (window.desktop && window.desktop.print) return window.desktop.print(html);
  if (window.mobile) return window.mobile.print(html);
  if (embedded) return toast(EMB_MSG);
  let p = $('#print'); if (!p) { p = document.createElement('div'); p.id = 'print'; p.className = 'print-area'; document.body.appendChild(p); }
  p.innerHTML = html; window.print();
}
async function download(name, content, mime = 'text/plain') {
  if (window.desktop) { if (await window.desktop.exportFile(name, content)) toast('Fișier salvat'); return; }
  if (window.mobile) return window.mobile.exportFile(name, content);
  if (embedded) return toast(EMB_MSG);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type: mime + ';charset=utf-8' })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
const csv = (rows) => '\ufeff' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');

// ---------- Calcul medii (reguli uzuale în România) ----------
// Media semestrială = media aritmetică a notelor, rotunjită la întreg (x,50 -> în sus).
// Media anuală = media aritmetică a celor două medii semestriale, cu 2 zecimale.
const roundRo = (x) => Math.floor(x + 0.5 + 1e-9);
const trunc2 = (x) => Math.floor(x * 100 + 1e-9) / 100;
function studentGrades(cid, sid, s = sem()) { return D.grades.filter((g) => g.classId === cid && g.studentId === sid && g.sem === s).sort((a, b) => a.date.localeCompare(b.date)); }
function semAverage(cid, sid, s = sem()) {
  const g = studentGrades(cid, sid, s); if (!g.length) return null;
  const raw = g.reduce((t, x) => t + x.value, 0) / g.length;
  return { raw: trunc2(raw), final: roundRo(trunc2(raw)), count: g.length };
}
function yearAverage(cid, sid) {
  const a = semAverage(cid, sid, 1), b = semAverage(cid, sid, 2);
  if (!a || !b) return null; return trunc2((a.final + b.final) / 2);
}
// Număr minim de note pe semestru: nr. ore/săpt. + 1 (minim 2 la o oră pe săptămână).
const minGrades = (c) => Math.max(2, (Number(c.hours) || 1) + 1);
function absCount(cid, sid, s = sem()) {
  const a = D.absences.filter((x) => x.classId === cid && x.studentId === sid && x.sem === s);
  return { total: a.length, mot: a.filter((x) => x.motivated).length, nem: a.filter((x) => !x.motivated).length };
}
function alerts() {
  const out = [];
  for (const c of D.classes) for (const st of c.students) {
    const n = studentGrades(c.id, st.id).length, need = minGrades(c);
    if (n < need) out.push({ type: 'warn', text: `${st.name} (${c.name}) – ${n}/${need} note în semestrul ${sem() === 1 ? 'I' : 'II'}` });
    const av = semAverage(c.id, st.id); if (av && av.final < 5) out.push({ type: 'bad', text: `${st.name} (${c.name}) – media ${av.raw.toFixed(2)}: risc de corigență` });
    const ab = absCount(c.id, st.id); if (ab.nem >= Number(D.settings.absLimit)) out.push({ type: 'bad', text: `${st.name} (${c.name}) – ${ab.nem} absențe nemotivate (pragul de ${D.settings.absLimit} atins)` });
  }
  return out;
}

// ---------- Navigare ----------
let current = 'acasa';
const state = { classId: null };
function pickClass() { if (!cls(state.classId)) state.classId = D.classes[0]?.id || null; return cls(state.classId); }
function classSelect(id = 'cls-select') {
  return `<select id="${id}">${D.classes.map((c) => `<option value="${c.id}" ${c.id === state.classId ? 'selected' : ''}>${esc(c.name)} – ${esc(c.subject)}</option>`).join('')}</select>`;
}
function bindClassSelect(fn) { const s = $('#cls-select'); s && s.addEventListener('change', () => { state.classId = s.value; fn(); }); }
const needClasses = () => `<div class="card empty">Nu aveți încă nicio clasă. <br><br><button class="btn" data-go="clase">+ Adaugă prima clasă</button></div>`;

function go(view) {
  current = view; state.editing = false;
  $$('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $$('.seg button').forEach((b) => b.classList.toggle('active', Number(b.dataset.sem) === sem()));
  (Views[view] || Views.acasa)();
  $('#view').scrollTop = 0;
}
window.go = go;
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-go],[data-close],[data-demo]'); if (!t) return;
  e.preventDefault();
  if (t.hasAttribute('data-close')) return closeModal();
  if (t.hasAttribute('data-demo')) return loadDemo();
  if (t.dataset.cls) state.classId = t.dataset.cls;
  go(t.dataset.go);
});
$$('#nav button').forEach((b) => b.addEventListener('click', () => go(b.dataset.view)));
$$('.seg button').forEach((b) => b.addEventListener('click', () => { D.settings.sem = Number(b.dataset.sem); save(); go(current); }));
const V = (html) => { $('#view').innerHTML = html; };

const Views = {};

// ---------- Acasă ----------
Views.acasa = () => {
  const d = new Date().getDay(); const day = d >= 1 && d <= 5 ? d : null;
  const al = alerts();
  const todaySlots = day ? Array.from({ length: D.settings.periods }, (_, i) => ({ p: i + 1, s: D.timetable[`${day}-${i + 1}`] })).filter((x) => x.s) : [];
  const students = D.classes.reduce((t, c) => t + c.students.length, 0);
  const hello = D.settings.teacher ? `Bună ziua, ${esc(D.settings.teacher)}!` : 'Bună ziua!';
  V(`<h1>${hello}</h1><p class="sub">${new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · Semestrul ${sem() === 1 ? 'I' : 'II'}</p>
  <div class="grid g4" style="margin-bottom:18px">
    <div class="stat"><b>${D.classes.length}</b><span>clase</span></div>
    <div class="stat"><b>${students}</b><span>elevi</span></div>
    <div class="stat"><b>${D.grades.filter((g) => g.sem === sem()).length}</b><span>note în acest semestru</span></div>
    <div class="stat"><b>${D.absences.filter((g) => g.sem === sem()).length}</b><span>absențe în acest semestru</span></div>
  </div>
  <div class="grid g2">
    <div class="card"><h2>⏰ Orele de azi</h2>${day ? (todaySlots.length ? `<table>${todaySlots.map((x) => `<tr><td><b>Ora ${x.p}</b><br><span class="muted">${periodTime(x.p)}</span></td><td>${esc(cls(x.s.classId)?.name || x.s.label || '')} ${x.s.room ? `<span class="muted">· sala ${esc(x.s.room)}</span>` : ''}</td><td>${x.s.classId ? `<button class="btn sm" data-go="catalog" data-cls="${x.s.classId}">Catalog</button>` : ''}</td></tr>`).join('')}</table>` : '<p class="muted">Nu aveți ore programate azi. Completați orarul în secțiunea „Orar”.</p>') : '<p class="muted">Weekend plăcut! 🌿</p>'}</div>
    <div class="card"><h2>🔔 De rezolvat (${al.length})</h2>${al.length ? al.slice(0, 12).map((a) => `<div class="alert ${a.type === 'bad' ? 'bad' : ''}">${esc(a.text)}</div>`).join('') + (al.length > 12 ? `<p class="muted">… și încă ${al.length - 12}</p>` : '') : '<p class="muted">Totul este în ordine. ✅</p>'}</div>
  </div>
  ${D.classes.length ? '' : `<div class="card"><h2>Primii pași</h2><ol><li>Adăugați clasele și lipiți lista de elevi (<a href="#" data-go="clase">Clase și elevi</a>).</li><li>Completați orarul.</li><li>Puneți note și absențe – mediile și alertele se calculează automat.</li><li>Generați planificări, proiecte de lecție, teste și rapoarte pentru părinți, gata de tipărit.</li></ol><button class="btn ghost" data-demo>Încarcă date demonstrative</button></div>`}`);
};
function periodTime(p) {
  const [h, m] = D.settings.startTime.split(':').map(Number);
  const start = h * 60 + m + (p - 1) * (Number(D.settings.lessonMin) + Number(D.settings.breakMin));
  const f = (x) => `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
  return `${f(start)}–${f(start + Number(D.settings.lessonMin))}`;
}

// ---------- Clase și elevi ----------
Views.clase = () => {
  V(`<h1>Clase și elevi</h1><p class="sub">Adăugați clasele la care predați. Lista de elevi se poate lipi direct din Excel sau Word (un nume pe rând).</p>
  <div class="row"><button class="btn" id="add-cls">+ Clasă nouă</button></div>
  ${D.classes.length ? D.classes.map((c) => `<div class="card"><div class="row"><h2 style="margin:0">${esc(c.name)} · ${esc(c.subject)}</h2><span class="chip n">${c.hours} ore/săpt.</span><span class="chip n">${c.students.length} elevi</span><span class="spacer"></span>
    <button class="btn sm ghost" data-edit="${c.id}">Editează</button><button class="btn sm ghost" data-add="${c.id}">+ Elevi</button><button class="btn sm danger" data-del="${c.id}">Șterge</button></div>
    ${c.students.length ? `<table><tr><th>#</th><th>Nume și prenume</th><th>Observații</th><th></th></tr>${sortStudents(c.students).map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.name)}</td><td class="muted">${esc(s.note || '')}</td><td style="text-align:right"><button class="btn sm ghost" data-es="${c.id}|${s.id}">✎</button> <button class="btn sm ghost" data-ds="${c.id}|${s.id}">✕</button></td></tr>`).join('')}</table>` : '<p class="muted">Niciun elev încă.</p>'}</div>`).join('') : '<div class="card empty">Nicio clasă adăugată.</div>'}`);
  $('#add-cls').onclick = () => classForm();
  $$('[data-edit]').forEach((b) => (b.onclick = () => classForm(cls(b.dataset.edit))));
  $$('[data-add]').forEach((b) => (b.onclick = () => studentsForm(cls(b.dataset.add))));
  $$('[data-del]').forEach((b) => (b.onclick = () => {
    const c = cls(b.dataset.del); ask(`Ștergeți clasa ${c.name} împreună cu toate notele și absențele?`, () => {
    D.classes = D.classes.filter((x) => x.id !== c.id); D.grades = D.grades.filter((x) => x.classId !== c.id); D.absences = D.absences.filter((x) => x.classId !== c.id);
    for (const k in D.timetable) if (D.timetable[k].classId === c.id) delete D.timetable[k];
    save(); Views.clase();
  }); }));
  $$('[data-es]').forEach((b) => (b.onclick = () => {
    const [cid, sid] = b.dataset.es.split('|'); const s = cls(cid).students.find((x) => x.id === sid);
    openModal(`<h2>Editează elevul</h2><label class="f">Nume<input id="sn" value="${esc(s.name)}"></label><label class="f">Observații (CES, scutit etc.)<input id="so" value="${esc(s.note || '')}"></label><div class="row"><span class="spacer"></span><button class="btn ghost" data-close>Renunță</button><button class="btn" id="ok">Salvează</button></div>`,
      (m) => ($('#ok', m).onclick = () => { s.name = $('#sn', m).value.trim() || s.name; s.note = $('#so', m).value.trim(); save(); closeModal(); Views.clase(); }));
  }));
  $$('[data-ds]').forEach((b) => (b.onclick = () => {
    const [cid, sid] = b.dataset.ds.split('|'); const c = cls(cid); const s = c.students.find((x) => x.id === sid);
    ask(`Ștergeți elevul ${s.name}?`, () => { c.students = c.students.filter((x) => x.id !== sid); D.grades = D.grades.filter((x) => x.studentId !== sid); D.absences = D.absences.filter((x) => x.studentId !== sid); save(); Views.clase(); });
  }));
};
function classForm(c) {
  openModal(`<h2>${c ? 'Editează clasa' : 'Clasă nouă'}</h2>
    <label class="f">Clasa (ex.: a V-a A)<input id="cn" value="${esc(c?.name || '')}"></label>
    <label class="f">Disciplina<input id="cs" value="${esc(c?.subject || '')}" placeholder="ex.: Matematică"></label>
    <label class="f">Ore pe săptămână<input id="ch" type="number" min="1" max="10" value="${c?.hours || 4}"></label>
    ${c ? '' : '<label class="f">Elevi (opțional – un nume pe rând)<textarea id="cl" rows="8" placeholder="Popescu Ana\nIonescu Mihai\n..."></textarea></label>'}
    <div class="row"><span class="spacer"></span><button class="btn ghost" data-close>Renunță</button><button class="btn" id="ok">Salvează</button></div>`, (m) => {
    $('#ok', m).onclick = () => {
      const name = $('#cn', m).value.trim(); if (!name) return toast('Introduceți numele clasei');
      if (c) { c.name = name; c.subject = $('#cs', m).value.trim(); c.hours = Number($('#ch', m).value) || 1; }
      else { const n = { id: uid(), name, subject: $('#cs', m).value.trim(), hours: Number($('#ch', m).value) || 1, students: parseNames($('#cl', m).value) }; D.classes.push(n); state.classId = n.id; }
      save(); closeModal(); Views.clase();
    };
  });
}
const parseNames = (t) => t.split(/\r?\n/).map((x) => x.replace(/^\s*\d+[.)\s-]*/, '').split('\t')[0].trim()).filter(Boolean).map((name) => ({ id: uid(), name }));
function studentsForm(c) {
  openModal(`<h2>Adaugă elevi în ${esc(c.name)}</h2><label class="f">Un nume pe rând (se pot lipi din Excel)<textarea id="cl" rows="10"></textarea></label>
    <div class="row"><span class="spacer"></span><button class="btn ghost" data-close>Renunță</button><button class="btn" id="ok">Adaugă</button></div>`,
    (m) => ($('#ok', m).onclick = () => { const l = parseNames($('#cl', m).value); c.students.push(...l); save(); closeModal(); toast(`${l.length} elevi adăugați`); Views.clase(); }));
}

// ---------- Catalog ----------
Views.catalog = () => {
  const c = pickClass(); if (!c) return V(`<h1>Catalog și medii</h1>${needClasses()}`);
  const need = minGrades(c);
  const rows = sortStudents(c.students).map((s, i) => {
    const g = studentGrades(c.id, s.id), av = semAverage(c.id, s.id), ya = sem() === 2 ? yearAverage(c.id, s.id) : null;
    const status = g.length < need ? `<span class="chip warn">${g.length}/${need} note</span>` : '<span class="chip good">✓</span>';
    return `<tr><td>${i + 1}</td><td>${esc(s.name)}${s.note ? ` <span class="muted">(${esc(s.note)})</span>` : ''}</td>
      <td>${g.map((x) => `<span class="chip ${x.value < 5 ? 'low' : 'n'}" title="${fmtDate(x.date)}${x.type ? ' · ' + esc(x.type) : ''}${x.comment ? ' · ' + esc(x.comment) : ''} – clic pentru editare" data-g="${x.id}">${x.value}<small style="opacity:.6"> ${fmtDate(x.date).slice(0, 5)}</small></span>`).join('')}
        <button class="btn sm ghost" data-ng="${s.id}">+</button></td>
      <td>${status}</td>
      <td class="avg" style="color:${av && av.final < 5 ? 'var(--bad)' : 'inherit'}">${av ? `${av.final} <small class="muted">(${av.raw.toFixed(2)})</small>` : '–'}</td>
      ${sem() === 2 ? `<td class="avg">${ya != null ? ya.toFixed(2) : '–'}</td>` : ''}</tr>`;
  }).join('');
  V(`<h1>Catalog și medii</h1><p class="sub">Mediile se calculează automat: media semestrială se rotunjește la întreg (x,50 → în sus), media anuală are 2 zecimale. Minim ${need} note/semestru la ${c.hours} ${c.hours == 1 ? 'oră' : 'ore'}/săpt.</p>
  <div class="row">${classSelect()}<button class="btn" id="bulk">⚡ Notare rapidă (test pe clasă)</button><span class="spacer"></span><button class="btn ghost" id="exp">⬇ Export Excel (CSV)</button><button class="btn ghost" id="prt">🖨 Tipărește</button></div>
  <div class="card">${c.students.length ? `<table><tr><th>#</th><th>Elev</th><th>Note sem. ${sem() === 1 ? 'I' : 'II'}</th><th>Stare</th><th>Media sem.</th>${sem() === 2 ? '<th>Media anuală</th>' : ''}</tr>${rows}</table>` : '<p class="muted">Clasa nu are elevi.</p>'}</div>
  ${classStats(c)}`);
  bindClassSelect(Views.catalog);
  $$('[data-ng]').forEach((b) => (b.onclick = () => gradeForm(c, b.dataset.ng)));
  $$('[data-g]').forEach((b) => (b.onclick = () => { const g = D.grades.find((x) => x.id === b.dataset.g); gradeForm(c, g.studentId, g); }));
  $('#bulk').onclick = () => bulkGrades(c);
  $('#exp').onclick = () => download(`catalog_${c.name}_${c.subject}_sem${sem()}.csv`.replace(/\s+/g, '_'), csv([['Nr', 'Elev', 'Note', 'Media brută', 'Media semestrială', ...(sem() === 2 ? ['Media anuală'] : [])],
    ...sortStudents(c.students).map((s, i) => { const av = semAverage(c.id, s.id); return [i + 1, s.name, studentGrades(c.id, s.id).map((g) => g.value).join(' '), av ? av.raw.toFixed(2) : '', av ? av.final : '', ...(sem() === 2 ? [yearAverage(c.id, s.id)?.toFixed(2) ?? ''] : [])]; })]), 'text/csv');
  $('#prt').onclick = () => printHTML(`<h2>${esc(D.settings.school)}</h2><h1>Situația la ${esc(c.subject)} – clasa ${esc(c.name)}, semestrul ${sem() === 1 ? 'I' : 'II'}, ${esc(D.settings.year)}</h1>
    <table><tr><th>Nr.</th><th>Elev</th><th>Note</th><th>Media</th>${sem() === 2 ? '<th>Media anuală</th>' : ''}</tr>${sortStudents(c.students).map((s, i) => { const av = semAverage(c.id, s.id); return `<tr><td>${i + 1}</td><td>${esc(s.name)}</td><td>${studentGrades(c.id, s.id).map((g) => `${g.value}/${fmtDate(g.date).slice(0, 5)}`).join(', ')}</td><td>${av ? av.final : ''}</td>${sem() === 2 ? `<td>${yearAverage(c.id, s.id)?.toFixed(2) ?? ''}</td>` : ''}</tr>`; }).join('')}</table>
    <p>Profesor: ${esc(D.settings.teacher)} &nbsp;&nbsp;&nbsp; Semnătura: ____________</p>`);
};
function classStats(c) {
  const avs = c.students.map((s) => semAverage(c.id, s.id)).filter(Boolean);
  if (!avs.length) return '';
  const mean = avs.reduce((t, a) => t + a.raw, 0) / avs.length;
  const buckets = [['sub 5', (x) => x < 5], ['5–6', (x) => x >= 5 && x < 7], ['7–8', (x) => x >= 7 && x < 9], ['9–10', (x) => x >= 9]];
  const max = Math.max(...buckets.map(([, f]) => avs.filter((a) => f(a.final)).length), 1);
  return `<div class="card"><h2>📈 Statistica clasei</h2><div class="grid g4">
    <div class="stat"><b>${mean.toFixed(2)}</b><span>media clasei</span></div>
    <div class="stat"><b>${Math.round((avs.filter((a) => a.final >= 5).length / avs.length) * 100)}%</b><span>promovabilitate</span></div>
    <div class="stat"><b>${avs.filter((a) => a.final < 5).length}</b><span>elevi sub 5</span></div></div>
    <div style="margin-top:14px">${buckets.map(([l, f]) => { const n = avs.filter((a) => f(a.final)).length; return `<div class="row" style="margin:4px 0"><span style="width:50px">${l}</span><div style="height:16px;border-radius:4px;background:var(--accent);width:${(n / max) * 60}%"></div><span>${n}</span></div>`; }).join('')}</div></div>`;
}
function gradeForm(c, sid, g, done = () => Views.catalog()) {
  const s = c.students.find((x) => x.id === sid);
  openModal(`<h2>${g ? 'Editează nota' : 'Notă nouă'} – ${esc(s.name)}</h2>
    <label class="f">Nota (1–10)<input id="gv" type="number" min="1" max="10" value="${g?.value || ''}"></label>
    <label class="f">Data<input id="gd" type="date" value="${g?.date || today()}"></label>
    <label class="f">Tip evaluare<select id="gt">${['Oral', 'Test', 'Lucrare scrisă', 'Temă', 'Proiect', 'Portofoliu', 'Activitate'].map((t) => `<option ${g?.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label class="f">Observație<input id="gc" value="${esc(g?.comment || '')}"></label>
    <div class="row">${g ? '<button class="btn danger" id="del">Șterge</button>' : ''}<span class="spacer"></span><button class="btn ghost" data-close>Renunță</button><button class="btn" id="ok">Salvează</button></div>`, (m) => {
    $('#ok', m).onclick = () => {
      const v = Number($('#gv', m).value); if (!(v >= 1 && v <= 10) || !Number.isInteger(v)) return toast('Nota trebuie să fie un număr întreg între 1 și 10');
      const data = { value: v, date: $('#gd', m).value || today(), type: $('#gt', m).value, comment: $('#gc', m).value.trim() };
      if (g) Object.assign(g, data); else D.grades.push({ id: uid(), classId: c.id, studentId: sid, sem: sem(), ...data });
      save(); closeModal(); done();
    };
    $('#gv', m).addEventListener('keydown', (e) => e.key === 'Enter' && $('#ok', m).click());
    g && ($('#del', m).onclick = () => { D.grades = D.grades.filter((x) => x.id !== g.id); save(); closeModal(); done(); });
  });
}
function bulkGrades(c) {
  openModal(`<h2>Notare rapidă – ${esc(c.name)}</h2><p class="muted">Introduceți notele pentru toți elevii deodată (lăsați gol pentru absenți). Tasta Enter trece la elevul următor.</p>
    <div class="row"><input id="bd" type="date" value="${today()}"><select id="bt">${['Test', 'Lucrare scrisă', 'Oral', 'Temă', 'Proiect'].map((t) => `<option>${t}</option>`).join('')}</select></div>
    <table>${sortStudents(c.students).map((s) => `<tr><td>${esc(s.name)}</td><td style="width:90px"><input class="bv" data-s="${s.id}" type="number" min="1" max="10" style="width:80px"></td></tr>`).join('')}</table>
    <div class="row" style="margin-top:12px"><span class="spacer"></span><button class="btn ghost" data-close>Renunță</button><button class="btn" id="ok">Salvează notele</button></div>`, (m) => {
    const inputs = $$('.bv', m);
    inputs.forEach((inp, i) => inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); (inputs[i + 1] || $('#ok', m)).focus(); } }));
    $('#ok', m).onclick = () => {
      let n = 0; const date = $('#bd', m).value || today(), type = $('#bt', m).value;
      for (const inp of inputs) { const v = Number(inp.value); if (inp.value && Number.isInteger(v) && v >= 1 && v <= 10) { D.grades.push({ id: uid(), classId: c.id, studentId: inp.dataset.s, sem: sem(), value: v, date, type, comment: '' }); n++; } }
      save(); closeModal(); toast(`${n} note salvate`); Views.catalog();
    };
  });
}

// ---------- Absențe ----------
Views.absente = () => {
  const c = pickClass(); if (!c) return V(`<h1>Absențe</h1>${needClasses()}`);
  const date = state.absDate || today();
  const rows = sortStudents(c.students).map((s, i) => {
    const has = D.absences.find((a) => a.classId === c.id && a.studentId === s.id && a.date === date);
    const cnt = absCount(c.id, s.id); const list = D.absences.filter((a) => a.classId === c.id && a.studentId === s.id && a.sem === sem()).sort((a, b) => a.date.localeCompare(b.date));
    return `<tr><td>${i + 1}</td><td>${esc(s.name)}</td>
      <td><label style="cursor:pointer"><input type="checkbox" data-ab="${s.id}" ${has ? 'checked' : ''}> absent</label></td>
      <td>${list.map((a) => `<span class="chip ${a.motivated ? 'mot' : 'nem'}" data-tog="${a.id}" title="Clic: motivează / anulează motivarea">${fmtDate(a.date).slice(0, 5)}</span>`).join('') || '<span class="muted">–</span>'}</td>
      <td>${cnt.total}</td><td>${cnt.mot}</td><td>${cnt.nem >= D.settings.absLimit ? `<span class="chip bad">${cnt.nem}</span>` : cnt.nem}</td></tr>`;
  }).join('');
  V(`<h1>Absențe</h1><p class="sub">Bifați elevii absenți la data aleasă. Clic pe o absență din listă pentru a o motiva (verde = motivată, roșu = nemotivată). Alertă la ${D.settings.absLimit} absențe nemotivate/semestru.</p>
    <div class="row">${classSelect()}<input type="date" id="ad" value="${date}"><span class="spacer"></span><button class="btn ghost" id="exp">⬇ Export CSV</button></div>
    <div class="card">${c.students.length ? `<table><tr><th>#</th><th>Elev</th><th>${fmtDate(date)}</th><th>Absențe sem. ${sem() === 1 ? 'I' : 'II'}</th><th>Total</th><th>Motivate</th><th>Nemotivate</th></tr>${rows}</table>` : '<p class="muted">Clasa nu are elevi.</p>'}</div>`);
  bindClassSelect(Views.absente);
  $('#ad').onchange = (e) => { state.absDate = e.target.value; Views.absente(); };
  $$('[data-ab]').forEach((b) => (b.onchange = () => {
    if (b.checked) D.absences.push({ id: uid(), classId: c.id, studentId: b.dataset.ab, date, sem: sem(), motivated: false });
    else D.absences = D.absences.filter((a) => !(a.classId === c.id && a.studentId === b.dataset.ab && a.date === date));
    save(); Views.absente();
  }));
  $$('[data-tog]').forEach((b) => (b.onclick = () => { const a = D.absences.find((x) => x.id === b.dataset.tog); a.motivated = !a.motivated; save(); Views.absente(); }));
  $('#exp').onclick = () => download(`absente_${c.name}_sem${sem()}.csv`.replace(/\s+/g, '_'), csv([['Elev', 'Total', 'Motivate', 'Nemotivate', 'Date nemotivate'], ...sortStudents(c.students).map((s) => { const n = absCount(c.id, s.id); return [s.name, n.total, n.mot, n.nem, D.absences.filter((a) => a.studentId === s.id && a.classId === c.id && a.sem === sem() && !a.motivated).map((a) => fmtDate(a.date)).join(', ')]; })]), 'text/csv');
};

// ---------- Orar ----------
Views.orar = () => {
  const d = new Date().getDay(); const P = Number(D.settings.periods);
  let hours = 0; for (const k in D.timetable) hours++;
  V(`<h1>Orar</h1><p class="sub">Clic pe o căsuță pentru a programa o oră. Total: <b>${hours}</b> ore/săptămână. Orele se pot ajusta din Setări (ora de început, durata orei și a pauzei).</p>
  <div class="row"><span class="spacer"></span><button class="btn ghost" id="prt">🖨 Tipărește orarul</button></div>
  <div class="card" style="overflow-x:auto"><table class="timetable" id="tt"><tr><th>Ora</th>${DAYS.map((x) => `<th>${x}</th>`).join('')}</tr>
  ${Array.from({ length: P }, (_, i) => `<tr><th>${i + 1}<br><small class="muted">${periodTime(i + 1)}</small></th>${DAYS.map((_, j) => { const s = D.timetable[`${j + 1}-${i + 1}`]; return `<td class="slot ${s ? 'filled' : ''} ${d === j + 1 ? 'today' : ''}" data-k="${j + 1}-${i + 1}">${s ? `${esc(cls(s.classId)?.name || s.label || '')}<br><small>${esc(cls(s.classId)?.subject || '')}${s.room ? ' · ' + esc(s.room) : ''}</small>` : ''}</td>`; }).join('')}</tr>`).join('')}</table></div>`);
  $$('.slot').forEach((td) => (td.onclick = () => {
    const k = td.dataset.k, s = D.timetable[k] || {};
    openModal(`<h2>${DAYS[Number(k.split('-')[0]) - 1]}, ora ${k.split('-')[1]}</h2>
      <label class="f">Clasa<select id="tc"><option value="">— altă activitate —</option>${D.classes.map((c) => `<option value="${c.id}" ${c.id === s.classId ? 'selected' : ''}>${esc(c.name)} – ${esc(c.subject)}</option>`).join('')}</select></label>
      <label class="f">Altă activitate (ex.: consiliere, cerc, pregătire)<input id="tl" value="${esc(s.label || '')}"></label>
      <label class="f">Sala<input id="tr" value="${esc(s.room || '')}"></label>
      <div class="row"><button class="btn danger" id="clr">Golește</button><span class="spacer"></span><button class="btn ghost" data-close>Renunță</button><button class="btn" id="ok">Salvează</button></div>`, (m) => {
      $('#ok', m).onclick = () => { const classId = $('#tc', m).value, label = $('#tl', m).value.trim(); if (!classId && !label) delete D.timetable[k]; else D.timetable[k] = { classId, label, room: $('#tr', m).value.trim() }; save(); closeModal(); Views.orar(); };
      $('#clr', m).onclick = () => { delete D.timetable[k]; save(); closeModal(); Views.orar(); };
    });
  }));
  $('#prt').onclick = () => printHTML(`<h1>Orar – ${esc(D.settings.teacher)}</h1><p>${esc(D.settings.school)} · ${esc(D.settings.year)}</p>` + $('#tt').outerHTML);
};

// ---------- Planificare calendaristică ----------
Views.planificare = () => {
  const c = pickClass(); if (!c) return V(`<h1>Planificare calendaristică</h1>${needClasses()}`);
  const plans = D.plans.filter((p) => p.classId === c.id).sort((a, b) => a.week - b.week);
  const totalH = plans.reduce((t, p) => t + Number(p.hours || 0), 0);
  V(`<h1>Planificare calendaristică</h1><p class="sub">Planificați unitățile de învățare pe săptămâni. Documentul se tipărește în formatul uzual cerut de școală.</p>
  <div class="row">${classSelect()}<button class="btn" id="add">+ Unitate de învățare</button><button class="btn ghost" id="gen">⚡ Generează săptămânile</button><span class="spacer"></span><button class="btn ghost" id="prt">🖨 Tipărește</button></div>
  <div class="card">${plans.length ? `<table><tr><th>Săpt.</th><th>Unitatea de învățare</th><th>Competențe specifice</th><th>Conținuturi</th><th>Ore</th><th>Obs.</th><th></th></tr>
    ${plans.map((p) => `<tr><td>S${p.week}</td><td><b>${esc(p.unit)}</b></td><td>${esc(p.comp)}</td><td>${esc(p.content)}</td><td>${p.hours}</td><td class="muted">${esc(p.obs)}</td><td><button class="btn sm ghost" data-e="${p.id}">✎</button> <button class="btn sm ghost" data-d="${p.id}">✕</button></td></tr>`).join('')}
    <tr><td></td><td colspan="3"><b>Total ore planificate</b></td><td><b>${totalH}</b></td><td colspan="2" class="muted">${c.hours} ore/săpt.</td></tr></table>` : '<p class="muted">Nicio unitate planificată încă. Apăsați „Generează săptămânile” pentru a crea rapid un schelet de 34 de săptămâni.</p>'}</div>`);
  bindClassSelect(Views.planificare);
  $('#add').onclick = () => planForm(c);
  $$('[data-e]').forEach((b) => (b.onclick = () => planForm(c, D.plans.find((p) => p.id === b.dataset.e))));
  $$('[data-d]').forEach((b) => (b.onclick = () => { D.plans = D.plans.filter((p) => p.id !== b.dataset.d); save(); Views.planificare(); }));
  $('#gen').onclick = () => {
    const doit = () => { for (let w = 1; w <= 34; w++) D.plans.push({ id: uid(), classId: c.id, week: w, unit: '', comp: '', content: '', hours: c.hours, obs: '' }); save(); Views.planificare(); };
    plans.length ? ask('Se vor adăuga 34 de rânduri goale (câte unul pe săptămână). Continuați?', doit) : doit();
  };
  $('#prt').onclick = () => printHTML(`<p>Unitatea de învățământ: ${esc(D.settings.school)}<br>Profesor: ${esc(D.settings.teacher)}<br>Disciplina: ${esc(c.subject)} · Clasa: ${esc(c.name)} · ${c.hours} ore/săpt. · An școlar ${esc(D.settings.year)}</p>
    <h1 style="text-align:center">PLANIFICARE CALENDARISTICĂ</h1><table><tr><th>Unitatea de învățare</th><th>Competențe specifice</th><th>Conținuturi</th><th>Nr. ore</th><th>Săptămâna</th><th>Observații</th></tr>
    ${plans.map((p) => `<tr><td>${esc(p.unit)}</td><td>${esc(p.comp)}</td><td>${esc(p.content)}</td><td>${p.hours}</td><td>S${p.week}</td><td>${esc(p.obs)}</td></tr>`).join('')}</table><p>Avizat șef catedră: ____________ &nbsp;&nbsp; Director: ____________</p>`);
};
function planForm(c, p) {
  const next = Math.max(0, ...D.plans.filter((x) => x.classId === c.id).map((x) => x.week)) + 1;
  openModal(`<h2>${p ? 'Editează' : 'Unitate nouă'}</h2>
    <label class="f">Săptămâna<input id="pw" type="number" min="1" max="40" value="${p?.week || next}"></label>
    <label class="f">Unitatea de învățare<input id="pu" value="${esc(p?.unit || '')}"></label>
    <label class="f">Competențe specifice (ex.: 1.1, 2.3)<input id="pc" value="${esc(p?.comp || '')}"></label>
    <label class="f">Conținuturi<textarea id="pt">${esc(p?.content || '')}</textarea></label>
    <label class="f">Nr. ore<input id="ph" type="number" min="0" value="${p?.hours ?? c.hours}"></label>
    <label class="f">Observații<input id="po" value="${esc(p?.obs || '')}"></label>
    <div class="row"><span class="spacer"></span><button class="btn ghost" data-close>Renunță</button><button class="btn" id="ok">Salvează</button></div>`, (m) => ($('#ok', m).onclick = () => {
    const data = { week: Number($('#pw', m).value) || next, unit: $('#pu', m).value.trim(), comp: $('#pc', m).value.trim(), content: $('#pt', m).value.trim(), hours: Number($('#ph', m).value) || 0, obs: $('#po', m).value.trim() };
    if (p) Object.assign(p, data); else D.plans.push({ id: uid(), classId: c.id, ...data });
    save(); closeModal(); Views.planificare();
  }));
}

// ---------- Proiect de lecție ----------
const STAGES = [
  ['Moment organizatoric', 2], ['Captarea atenției', 3], ['Reactualizarea cunoștințelor', 5], ['Anunțarea temei și a obiectivelor', 2],
  ['Dirijarea învățării', 20], ['Obținerea performanței', 8], ['Asigurarea feedbackului și evaluarea', 5], ['Tema pentru acasă', 2], ['Încheierea lecției', 3]
];
const LESSON_TYPES = ['Lecție mixtă', 'Lecție de comunicare/însușire de noi cunoștințe', 'Lecție de formare de priceperi și deprinderi', 'Lecție de fixare și sistematizare', 'Lecție de verificare și apreciere a rezultatelor'];
Views.lectie = () => {
  const list = [...D.lessons].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  V(`<h1>Proiect de lecție</h1><p class="sub">Completați un formular structurat – etapele lecției sunt deja propuse. Proiectul se tipărește sau se salvează ca PDF. Puteți duplica un proiect vechi pentru a-l refolosi.</p>
  <div class="row"><button class="btn" id="new">+ Proiect nou</button></div>
  <div class="card">${list.length ? `<table><tr><th>Data</th><th>Clasa</th><th>Subiectul lecției</th><th>Tipul</th><th></th></tr>${list.map((l) => `<tr><td>${fmtDate(l.date)}</td><td>${esc(cls(l.classId)?.name || l.className || '')}</td><td><b>${esc(l.topic)}</b></td><td class="muted">${esc(l.type)}</td><td style="text-align:right;white-space:nowrap"><button class="btn sm ghost" data-o="${l.id}">Deschide</button> <button class="btn sm ghost" data-c="${l.id}">Duplică</button> <button class="btn sm ghost" data-p="${l.id}">🖨</button> <button class="btn sm ghost" data-d="${l.id}">✕</button></td></tr>`).join('')}</table>` : '<p class="muted">Niciun proiect de lecție salvat.</p>'}</div>`);
  $('#new').onclick = () => lessonEditor();
  $$('[data-o]').forEach((b) => (b.onclick = () => lessonEditor(D.lessons.find((l) => l.id === b.dataset.o))));
  $$('[data-c]').forEach((b) => (b.onclick = () => { const l = structuredClone(D.lessons.find((x) => x.id === b.dataset.c)); l.id = uid(); l.date = today(); l.topic += ' (copie)'; D.lessons.push(l); save(); lessonEditor(l); }));
  $$('[data-p]').forEach((b) => (b.onclick = () => printLesson(D.lessons.find((l) => l.id === b.dataset.p))));
  $$('[data-d]').forEach((b) => (b.onclick = () => ask('Ștergeți proiectul?', () => { D.lessons = D.lessons.filter((l) => l.id !== b.dataset.d); save(); Views.lectie(); })));
};
function lessonEditor(l) {
  const isNew = !l; setTimeout(() => (state.editing = true));
  l = l || { id: uid(), classId: D.classes[0]?.id || '', date: today(), topic: '', unit: '', type: LESSON_TYPES[0], comp: '', objectives: 'O1 – \nO2 – \nO3 – ', methods: 'conversația, explicația, exercițiul, problematizarea', resources: 'manualul, fișe de lucru, videoproiector', forms: 'frontal, individual, pe grupe', evaluation: 'observarea sistematică, evaluare orală', bibliography: '', stages: STAGES.map(([name, min]) => ({ name, min, teacher: '', students: '' })) };
  V(`<h1>${isNew ? 'Proiect de lecție nou' : 'Proiect de lecție'}</h1><p class="sub">Toate câmpurile sunt opționale. Apăsați „Salvează” la final.</p>
  <div class="card"><div class="grid g2">
    <label class="f">Clasa<select id="lc">${D.classes.map((c) => `<option value="${c.id}" ${c.id === l.classId ? 'selected' : ''}>${esc(c.name)} – ${esc(c.subject)}</option>`).join('')}<option value="" ${!l.classId ? 'selected' : ''}>— alta —</option></select></label>
    <label class="f">Data<input id="ld" type="date" value="${l.date}"></label>
    <label class="f">Subiectul lecției<input id="lt" value="${esc(l.topic)}"></label>
    <label class="f">Unitatea de învățare<input id="lu" value="${esc(l.unit)}"></label>
    <label class="f">Tipul lecției<select id="ly">${LESSON_TYPES.map((t) => `<option ${t === l.type ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label class="f">Competențe specifice<input id="lk" value="${esc(l.comp)}"></label>
  </div>
  <label class="f">Obiective operaționale<textarea id="lo" rows="4">${esc(l.objectives)}</textarea></label>
  <div class="grid g2">
    <label class="f">Metode și procedee<input id="lm" value="${esc(l.methods)}"></label>
    <label class="f">Mijloace / resurse<input id="lr" value="${esc(l.resources)}"></label>
    <label class="f">Forme de organizare<input id="lf" value="${esc(l.forms)}"></label>
    <label class="f">Evaluare<input id="le" value="${esc(l.evaluation)}"></label>
  </div>
  <label class="f">Bibliografie<input id="lb" value="${esc(l.bibliography)}"></label></div>
  <div class="card"><div class="row"><h2 style="margin:0">Desfășurarea lecției</h2><span class="spacer"></span><span class="muted" id="tot"></span><button class="btn sm ghost" id="adds">+ Etapă</button></div><div id="stages"></div></div>
  <div class="row"><button class="btn ghost" id="back">← Înapoi</button><span class="spacer"></span><button class="btn ghost" id="prt">🖨 Tipărește / PDF</button><button class="btn" id="sv">💾 Salvează</button></div>`);
  const renderStages = () => {
    $('#stages').innerHTML = l.stages.map((s, i) => `<div class="stage"><div class="row"><input data-i="${i}" data-k="name" value="${esc(s.name)}" style="flex:1;font-weight:600"><input data-i="${i}" data-k="min" type="number" value="${s.min}" style="width:70px"> min <button class="btn sm ghost" data-up="${i}">↑</button><button class="btn sm ghost" data-rm="${i}">✕</button></div>
      <div class="grid g2"><label class="f">Activitatea profesorului<textarea data-i="${i}" data-k="teacher" rows="2">${esc(s.teacher)}</textarea></label><label class="f">Activitatea elevilor<textarea data-i="${i}" data-k="students" rows="2">${esc(s.students)}</textarea></label></div></div>`).join('');
    const tot = () => ($('#tot').textContent = `Durată totală: ${l.stages.reduce((t, s) => t + Number(s.min || 0), 0)} min`);
    tot();
    $$('#stages [data-k]').forEach((inp) => inp.addEventListener('input', () => { const s = l.stages[inp.dataset.i]; s[inp.dataset.k] = inp.dataset.k === 'min' ? Number(inp.value) : inp.value; tot(); }));
    $$('#stages [data-rm]').forEach((b) => (b.onclick = () => { l.stages.splice(Number(b.dataset.rm), 1); renderStages(); }));
    $$('#stages [data-up]').forEach((b) => (b.onclick = () => { const i = Number(b.dataset.up); if (i > 0) { [l.stages[i - 1], l.stages[i]] = [l.stages[i], l.stages[i - 1]]; renderStages(); } }));
  };
  renderStages();
  const collect = () => Object.assign(l, { classId: $('#lc').value, date: $('#ld').value, topic: $('#lt').value.trim(), unit: $('#lu').value.trim(), type: $('#ly').value, comp: $('#lk').value.trim(), objectives: $('#lo').value, methods: $('#lm').value, resources: $('#lr').value, forms: $('#lf').value, evaluation: $('#le').value, bibliography: $('#lb').value });
  $('#adds').onclick = () => { l.stages.push({ name: 'Etapă nouă', min: 5, teacher: '', students: '' }); renderStages(); };
  $('#sv').onclick = () => { collect(); if (!D.lessons.includes(l)) D.lessons.push(l); save(); toast('Proiect salvat'); };
  $('#prt').onclick = () => { collect(); printLesson(l); };
  $('#back').onclick = () => Views.lectie();
}
function printLesson(l) {
  const c = cls(l.classId); const nl = (s) => esc(s).replace(/\n/g, '<br>');
  printHTML(`<p>Unitatea de învățământ: ${esc(D.settings.school)}<br>Profesor: ${esc(D.settings.teacher)}<br>Data: ${fmtDate(l.date)}<br>Clasa: ${esc(c?.name || '')}<br>Disciplina: ${esc(c?.subject || '')}</p>
  <h1 style="text-align:center">PROIECT DIDACTIC</h1>
  <p><b>Unitatea de învățare:</b> ${esc(l.unit)}<br><b>Subiectul lecției:</b> ${esc(l.topic)}<br><b>Tipul lecției:</b> ${esc(l.type)}<br><b>Competențe specifice:</b> ${esc(l.comp)}</p>
  <p><b>Obiective operaționale:</b><br>${nl(l.objectives)}</p>
  <p><b>Strategii didactice:</b><br>Metode și procedee: ${esc(l.methods)}<br>Mijloace de învățământ: ${esc(l.resources)}<br>Forme de organizare: ${esc(l.forms)}<br>Evaluare: ${esc(l.evaluation)}</p>
  ${l.bibliography ? `<p><b>Bibliografie:</b> ${esc(l.bibliography)}</p>` : ''}
  <h3>Desfășurarea lecției</h3><table><tr><th>Etapele lecției</th><th>Timp</th><th>Activitatea profesorului</th><th>Activitatea elevilor</th></tr>
  ${l.stages.map((s, i) => `<tr><td>${i + 1}. ${esc(s.name)}</td><td>${s.min}'</td><td>${nl(s.teacher)}</td><td>${nl(s.students)}</td></tr>`).join('')}</table>`);
}

// ---------- Generator de teste ----------
Views.teste = () => {
  const subj = state.qSubj ?? '';
  const subjects = [...new Set(D.questions.map((q) => q.subject).filter(Boolean))];
  const qs = D.questions.filter((q) => !subj || q.subject === subj);
  V(`<h1>Generator de teste</h1><p class="sub">Construiți-vă o bancă de itemi o singură dată. Apoi generați teste în mai multe variante (ordinea itemilor și a răspunsurilor amestecată), cu barem de corectare și calculul notei.</p>
  <div class="row"><select id="qs"><option value="">Toate disciplinele</option>${subjects.map((s) => `<option ${s === subj ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select><button class="btn" id="add">+ Item nou</button><button class="btn ghost" id="imp">📋 Import rapid</button><span class="spacer"></span><button class="btn" id="gen">⚡ Generează test</button></div>
  <div class="card">${qs.length ? `<table><tr><th><input type="checkbox" id="all"></th><th>Item</th><th>Tip</th><th>Puncte</th><th>Disciplina / tema</th><th></th></tr>${qs.map((q) => `<tr><td><input type="checkbox" class="qc" value="${q.id}"></td><td>${esc(q.text)}${q.type === 'grila' ? `<br><small class="muted">${q.options.map((o, i) => (i === q.correct ? '✔ ' : '') + esc(o)).join(' · ')}</small>` : ''}</td><td>${{ grila: 'Grilă', adevarat: 'A/F', deschis: 'Răspuns deschis' }[q.type]}</td><td>${q.points}</td><td class="muted">${esc(q.subject)}${q.topic ? ' / ' + esc(q.topic) : ''}</td><td style="white-space:nowrap"><button class="btn sm ghost" data-e="${q.id}">✎</button> <button class="btn sm ghost" data-d="${q.id}">✕</button></td></tr>`).join('')}</table>` : '<p class="muted">Banca de itemi este goală.</p>'}</div>`);
  $('#qs').onchange = (e) => { state.qSubj = e.target.value; Views.teste(); };
  $('#add').onclick = () => questionForm();
  $('#imp').onclick = importQuestions;
  $('#all') && ($('#all').onchange = (e) => $$('.qc').forEach((c) => (c.checked = e.target.checked)));
  $$('[data-e]').forEach((b) => (b.onclick = () => questionForm(D.questions.find((q) => q.id === b.dataset.e))));
  $$('[data-d]').forEach((b) => (b.onclick = () => { D.questions = D.questions.filter((q) => q.id !== b.dataset.d); save(); Views.teste(); }));
  $('#gen').onclick = () => {
    let sel = $$('.qc:checked').map((c) => D.questions.find((q) => q.id === c.value));
    if (!sel.length) sel = qs;
    if (!sel.length) return toast('Adăugați mai întâi itemi');
    openModal(`<h2>Generează test (${sel.length} itemi selectați)</h2>
      <label class="f">Titlul testului<input id="tt" value="Test de evaluare"></label>
      <label class="f">Clasa<input id="tc" value="${esc(cls(state.classId)?.name || '')}"></label>
      <label class="f">Număr de itemi aleși aleatoriu (din cei selectați)<input id="tn" type="number" min="1" max="${sel.length}" value="${sel.length}"></label>
      <label class="f">Număr de variante<select id="tv"><option>1</option><option selected>2</option><option>3</option><option>4</option></select></label>
      <label class="f">Puncte din oficiu<input id="to" type="number" min="0" value="10"></label>
      <label class="f">Timp de lucru (minute)<input id="tm" type="number" min="1" value="45"></label>
      <div class="row"><span class="spacer"></span><button class="btn ghost" data-close>Renunță</button><button class="btn" id="ok">🖨 Generează și tipărește</button></div>`, (m) => ($('#ok', m).onclick = () => {
      closeModal(); printTest(sel, { title: $('#tt', m).value, cls: $('#tc', m).value, n: Number($('#tn', m).value) || sel.length, variants: Number($('#tv', m).value), oficiu: Number($('#to', m).value) || 0, minutes: Number($('#tm', m).value) || 45 });
    }));
  };
};
function questionForm(q) {
  const lastSubj = q?.subject ?? (state.qSubj || D.questions.at(-1)?.subject || cls(state.classId)?.subject || '');
  openModal(`<h2>${q ? 'Editează itemul' : 'Item nou'}</h2>
    <label class="f">Tip<select id="qt"><option value="grila">Alegere multiplă (grilă)</option><option value="adevarat">Adevărat / Fals</option><option value="deschis">Răspuns deschis</option></select></label>
    <label class="f">Enunț<textarea id="qx">${esc(q?.text || '')}</textarea></label>
    <div id="qo"></div>
    <div class="grid g2"><label class="f">Puncte<input id="qp" type="number" min="1" value="${q?.points || 10}"></label><label class="f">Disciplina<input id="qs2" value="${esc(lastSubj)}"></label></div>
    <label class="f">Tema / capitolul<input id="qtp" value="${esc(q?.topic || '')}"></label>
    <div class="row"><span class="spacer"></span><button class="btn ghost" data-close>Renunță</button><button class="btn" id="ok">Salvează</button></div>`, (m) => {
    const t = $('#qt', m); t.value = q?.type || 'grila';
    const opts = () => {
      if (t.value === 'grila') $('#qo', m).innerHTML = `<p class="muted" style="margin:0 0 6px">Variante de răspuns – bifați răspunsul corect:</p>${[0, 1, 2, 3].map((i) => `<div class="row" style="margin-bottom:6px"><input type="radio" name="cr" value="${i}" ${(q?.correct ?? 0) === i ? 'checked' : ''}><input class="op" style="flex:1" value="${esc(q?.options?.[i] || '')}" placeholder="Varianta ${'abcd'[i]}"></div>`).join('')}`;
      else if (t.value === 'adevarat') $('#qo', m).innerHTML = `<label class="f">Răspuns corect<select id="qa"><option value="A">Adevărat</option><option value="F" ${q?.answer === 'F' ? 'selected' : ''}>Fals</option></select></label>`;
      else $('#qo', m).innerHTML = `<label class="f">Răspuns așteptat / barem<textarea id="qa">${esc(q?.answer || '')}</textarea></label><label class="f">Rânduri pentru răspuns<input id="ql" type="number" min="1" value="${q?.lines || 4}"></label>`;
    };
    t.onchange = opts; opts();
    $('#ok', m).onclick = () => {
      const text = $('#qx', m).value.trim(); if (!text) return toast('Scrieți enunțul');
      const data = { type: t.value, text, points: Number($('#qp', m).value) || 1, subject: $('#qs2', m).value.trim(), topic: $('#qtp', m).value.trim() };
      if (t.value === 'grila') { const o = $$('.op', m).map((x) => x.value.trim()); const cr = Number(($('input[name=cr]:checked', m) || {}).value || 0); const keep = o.map((v, i) => [v, i]).filter(([v]) => v); if (keep.length < 2) return toast('Introduceți cel puțin 2 variante'); data.options = keep.map(([v]) => v); data.correct = Math.max(0, keep.findIndex(([, i]) => i === cr)); }
      else if (t.value === 'adevarat') data.answer = $('#qa', m).value;
      else { data.answer = $('#qa', m).value.trim(); data.lines = Number($('#ql', m).value) || 4; }
      if (q) { for (const k of ['options', 'correct', 'answer', 'lines']) delete q[k]; Object.assign(q, data); } else D.questions.push({ id: uid(), ...data });
      save(); closeModal(); Views.teste();
    };
  });
}
function importQuestions() {
  openModal(`<h2>Import rapid de itemi</h2><p class="muted">Scrieți sau lipiți itemii. Format:<br>
  <code>Enunțul întrebării?<br>a) varianta 1<br>*b) varianta corectă (marcată cu *)<br>c) varianta 3</code><br><br>Lăsați un rând gol între itemi. Un item fără variante devine „răspuns deschis”. Un item care începe cu <code>A/F:</code> și se termină cu <code>= A</code> sau <code>= F</code> devine Adevărat/Fals.</p>
  <div class="grid g2"><label class="f">Disciplina<input id="is" value="${esc(state.qSubj || cls(state.classId)?.subject || '')}"></label><label class="f">Puncte / item<input id="ip" type="number" value="10"></label></div>
  <textarea id="it" rows="12"></textarea><div class="row" style="margin-top:10px"><span class="spacer"></span><button class="btn ghost" data-close>Renunță</button><button class="btn" id="ok">Importă</button></div>`, (m) => ($('#ok', m).onclick = () => {
    const subject = $('#is', m).value.trim(), points = Number($('#ip', m).value) || 10; let n = 0;
    for (const block of $('#it', m).value.split(/\n\s*\n/)) {
      const lines = block.split('\n').map((x) => x.trim()).filter(Boolean); if (!lines.length) continue;
      const head = lines[0].replace(/^\d+[.)]\s*/, ''), optLines = lines.slice(1).filter((x) => /^\*?\s*[a-hA-H][).]/.test(x));
      const tf = head.match(/^A\/F:\s*(.+?)\s*=\s*([AF])$/i);
      if (tf) D.questions.push({ id: uid(), type: 'adevarat', text: tf[1], answer: tf[2].toUpperCase(), points, subject, topic: '' });
      else if (optLines.length >= 2) D.questions.push({ id: uid(), type: 'grila', text: head, options: optLines.map((x) => x.replace(/^\*?\s*[a-hA-H][).]\s*/, '')), correct: Math.max(0, optLines.findIndex((x) => x.startsWith('*'))), points, subject, topic: '' });
      else D.questions.push({ id: uid(), type: 'deschis', text: [head, ...lines.slice(1)].join(' '), answer: '', lines: 4, points, subject, topic: '' });
      n++;
    }
    save(); closeModal(); toast(`${n} itemi importați`); Views.teste();
  }));
}
function printTest(sel, o) {
  const base = shuffle(sel).slice(0, o.n);
  const L = 'ABCD';
  const variants = Array.from({ length: o.variants }, () => shuffle(base).map((q) => {
    if (q.type !== 'grila') return { ...q };
    const idx = shuffle(q.options.map((_, i) => i));
    return { ...q, options: idx.map((i) => q.options[i]), correct: idx.indexOf(q.correct) };
  }));
  const total = base.reduce((t, q) => t + q.points, 0) + o.oficiu;
  const letters = 'abcdefgh';
  const sheet = (qs, v) => `<h2 style="text-align:center">${esc(o.title)}${o.variants > 1 ? ` – Varianta ${L[v]}` : ''}</h2>
    <p>Numele și prenumele: ______________________________ &nbsp; Clasa: ${esc(o.cls) || '______'} &nbsp; Data: __________</p>
    <p><i>Timp de lucru: ${o.minutes} minute. Se acordă ${o.oficiu} puncte din oficiu. Total: ${total} puncte.</i></p>
    ${qs.map((q, i) => `<div style="margin:12px 0"><b>${i + 1}.</b> ${esc(q.text)} <i>(${q.points}p)</i>
      ${q.type === 'grila' ? `<div style="margin-left:18px">${q.options.map((op, j) => `${letters[j]}) ${esc(op)}`).join('<br>')}</div>` : ''}
      ${q.type === 'adevarat' ? '<div style="margin-left:18px">Adevărat &#9744; &nbsp;&nbsp; Fals &#9744;</div>' : ''}
      ${q.type === 'deschis' ? '<div style="margin-left:18px">' + '<div style="border-bottom:1px dotted #000;height:26px"></div>'.repeat(q.lines || 4) + '</div>' : ''}</div>`).join('')}
    <div class="page-break"></div>`;
  const key = variants.map((qs, v) => `<h3>Barem${o.variants > 1 ? ` – Varianta ${L[v]}` : ''}</h3><table><tr><th>Item</th><th>Răspuns corect</th><th>Punctaj</th></tr>${qs.map((q, i) => `<tr><td>${i + 1}</td><td>${q.type === 'grila' ? letters[q.correct] + ') ' + esc(q.options[q.correct]) : q.type === 'adevarat' ? (q.answer === 'A' ? 'Adevărat' : 'Fals') : esc(q.answer || '—')}</td><td>${q.points}p</td></tr>`).join('')}<tr><td colspan="2">Din oficiu</td><td>${o.oficiu}p</td></tr><tr><td colspan="2"><b>Total</b></td><td><b>${total}p</b></td></tr></table>`).join('');
  const conv = `<h3>Transformarea punctajului în notă</h3><p>Nota = punctajul obținut ÷ ${total / 10}. ${[...Array(10)].map((_, i) => `Nota ${i + 1}: ${Math.round((i + 0.5) * total / 10)}–${Math.round((i + 1.5) * total / 10) - 1}p`).slice(0, 9).join('; ')}; Nota 10: ${Math.round(9.5 * total / 10)}–${total}p.</p>`;
  printHTML(variants.map(sheet).join('') + key + conv);
}

// ---------- Rapoarte pentru părinți ----------
Views.rapoarte = () => {
  const c = pickClass(); if (!c) return V(`<h1>Rapoarte pentru părinți</h1>${needClasses()}`);
  V(`<h1>Rapoarte pentru părinți</h1><p class="sub">Fișă individuală pentru ședința cu părinții: note, medie, absențe și o observație personalizată. Tipăriți pentru un elev sau pentru toată clasa.</p>
  <div class="row">${classSelect()}<span class="spacer"></span><button class="btn" id="all">🖨 Tipărește toată clasa</button></div>
  <div class="card"><table><tr><th>Elev</th><th>Media</th><th>Absențe (nem.)</th><th>Observație pentru părinți</th><th></th></tr>
  ${sortStudents(c.students).map((s) => { const av = semAverage(c.id, s.id), ab = absCount(c.id, s.id); return `<tr><td>${esc(s.name)}</td><td class="avg">${av ? av.final : '–'}</td><td>${ab.total} (${ab.nem})</td><td><input style="width:100%" data-obs="${s.id}" value="${esc((s.obs || {})[sem()] || '')}" placeholder="${esc(autoComment(c, s))}"></td><td><button class="btn sm ghost" data-p="${s.id}">🖨</button></td></tr>`; }).join('')}</table></div>`);
  bindClassSelect(Views.rapoarte);
  $$('[data-obs]').forEach((i) => i.addEventListener('change', () => { const s = c.students.find((x) => x.id === i.dataset.obs); s.obs = { ...(s.obs || {}), [sem()]: i.value }; save(); }));
  $$('[data-p]').forEach((b) => (b.onclick = () => printHTML(report(c, c.students.find((s) => s.id === b.dataset.p)))));
  $('#all').onclick = () => printHTML(sortStudents(c.students).map((s) => report(c, s) + '<div class="page-break"></div>').join(''));
};
function autoComment(c, s) {
  const av = semAverage(c.id, s.id), ab = absCount(c.id, s.id);
  if (!av) return 'Încă nu există suficiente note pentru o apreciere.';
  let t = av.final >= 9 ? 'Rezultate foarte bune, elevul/eleva lucrează constant.' : av.final >= 7 ? 'Rezultate bune; cu puțin mai mult exercițiu poate obține rezultate foarte bune.' : av.final >= 5 ? 'Rezultate satisfăcătoare; recomandăm lucru suplimentar acasă.' : 'Situație de risc – este necesară o discuție și un plan de recuperare.';
  if (ab.nem >= 5) t += ` Atenție la absențele nemotivate (${ab.nem}).`;
  return t;
}
function report(c, s) {
  const g = studentGrades(c.id, s.id), av = semAverage(c.id, s.id), ab = absCount(c.id, s.id);
  return `<h2>${esc(D.settings.school)}</h2><h1>Fișa elevului – ${esc(s.name)}</h1>
  <p>Clasa: ${esc(c.name)} · Disciplina: ${esc(c.subject)} · Semestrul ${sem() === 1 ? 'I' : 'II'}, ${esc(D.settings.year)}</p>
  <table><tr><th>Data</th><th>Tip evaluare</th><th>Nota</th></tr>${g.map((x) => `<tr><td>${fmtDate(x.date)}</td><td>${esc(x.type || '')}</td><td>${x.value}</td></tr>`).join('') || '<tr><td colspan="3">Nicio notă</td></tr>'}</table>
  <p><b>Media:</b> ${av ? `${av.final} (${av.raw.toFixed(2)})` : '–'} &nbsp;&nbsp; <b>Absențe:</b> ${ab.total}, din care nemotivate: ${ab.nem}</p>
  <p><b>Observații:</b> ${esc((s.obs || {})[sem()] || autoComment(c, s))}</p>
  <p style="margin-top:30px">Profesor: ${esc(D.settings.teacher)} ____________ &nbsp;&nbsp;&nbsp; Semnătura părintelui: ____________</p>`;
}

// ---------- La clasă: elev aleatoriu, cronometru, grupe ----------
let timerInt = null;
Views.clasa = () => {
  const c = pickClass();
  V(`<h1>Instrumente la clasă</h1><p class="sub">Pentru videoproiector sau tablă interactivă.</p>
  ${c ? `<div class="row">${classSelect()}</div>` : ''}
  <div class="grid g2">
    <div class="card"><h2>🎲 Elev aleatoriu</h2><div class="big-name" id="name">?</div><div class="row"><button class="btn" id="pick">Alege un elev</button><label><input type="checkbox" id="norep" checked> fără repetare</label><span class="spacer"></span><button class="btn ghost sm" id="grade">+ Notă</button></div></div>
    <div class="card"><h2>⏱ Cronometru</h2><div class="timer" id="tm">05:00</div><div class="row" style="justify-content:center">${[1, 3, 5, 10, 15].map((x) => `<button class="btn ghost sm" data-t="${x}">${x} min</button>`).join('')}<button class="btn" id="ts">Start</button><button class="btn ghost" id="tr">Reset</button></div></div>
  </div>
  <div class="card"><h2>👥 Împărțire pe grupe</h2><div class="row"><input type="number" id="gn" value="4" min="2" max="15" style="width:80px"><select id="gm"><option value="n">grupe</option><option value="s">elevi per grupă</option></select><button class="btn" id="gg">Formează grupe</button></div><div class="groups" id="groups"></div></div>`);
  bindClassSelect(() => { state.picked = []; Views.clasa(); });
  let left = 300, run = false, lastPick = null;
  const show = () => { $('#tm').textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`; $('#tm').style.color = left <= 10 ? 'var(--bad)' : ''; };
  clearInterval(timerInt);
  $$('[data-t]').forEach((b) => (b.onclick = () => { left = Number(b.dataset.t) * 60; show(); }));
  $('#ts').onclick = () => { run = !run; $('#ts').textContent = run ? 'Pauză' : 'Start'; clearInterval(timerInt); if (run) timerInt = setInterval(() => { if (left > 0) { left--; show(); } if (left === 0) { clearInterval(timerInt); run = false; $('#ts').textContent = 'Start'; beep(); } }, 1000); };
  $('#tr').onclick = () => { clearInterval(timerInt); run = false; left = 300; $('#ts').textContent = 'Start'; show(); };
  $('#pick').onclick = () => {
    if (!c || !c.students.length) return toast('Adăugați elevi în clasă');
    state.picked = state.picked || [];
    let pool = c.students.filter((s) => !$('#norep').checked || !state.picked.includes(s.id));
    if (!pool.length) { state.picked = []; pool = c.students; toast('Toți elevii au fost aleși – se reîncepe'); }
    let k = 0; const it = setInterval(() => { $('#name').textContent = pool[Math.floor(Math.random() * pool.length)].name; if (++k > 14) { clearInterval(it); lastPick = pool[Math.floor(Math.random() * pool.length)]; $('#name').textContent = lastPick.name; state.picked.push(lastPick.id); } }, 60);
  };
  $('#grade').onclick = () => { if (!lastPick) return toast('Alegeți mai întâi un elev'); gradeForm(c, lastPick.id, null, () => toast(`Notă salvată pentru ${lastPick.name}`)); };
  $('#gg').onclick = () => {
    if (!c || !c.students.length) return toast('Adăugați elevi în clasă');
    const n = Number($('#gn').value) || 2, list = shuffle(c.students);
    const groups = $('#gm').value === 'n' ? Math.min(n, list.length) : Math.ceil(list.length / n);
    const out = Array.from({ length: groups }, () => []); list.forEach((s, i) => out[i % groups].push(s.name));
    $('#groups').innerHTML = out.map((g, i) => `<div><b>Grupa ${i + 1}</b><br>${g.map(esc).join('<br>')}</div>`).join('');
  };
}
function beep() { try { const a = new AudioContext(), o = a.createOscillator(); o.frequency.value = 880; o.connect(a.destination); o.start(); setTimeout(() => { o.stop(); a.close(); }, 700); } catch {} toast('⏰ Timpul a expirat!'); }

// ---------- Setări și backup ----------
Views.setari = () => {
  const s = D.settings;
  V(`<h1>Setări și copii de rezervă</h1><p class="sub">Datele se păstrează doar pe acest calculator${window.desktop ? ' (în dosarul aplicației)' : ' (în browser)'}. Faceți periodic o copie de rezervă pe stick sau în cloud.</p>
  <div class="card"><h2>Profil</h2><div class="grid g2">
    <label class="f">Numele profesorului<input id="st" value="${esc(s.teacher)}"></label>
    <label class="f">Unitatea de învățământ<input id="ss" value="${esc(s.school)}"></label>
    <label class="f">An școlar<input id="sy" value="${esc(s.year)}"></label>
    <label class="f">Prag alertă absențe nemotivate / semestru<input id="sa" type="number" value="${s.absLimit}"></label>
    <label class="f">Număr de ore pe zi în orar<input id="sp" type="number" min="1" max="12" value="${s.periods}"></label>
    <label class="f">Ora de început<input id="sb" type="time" value="${s.startTime}"></label>
    <label class="f">Durata orei (min)<input id="sl" type="number" value="${s.lessonMin}"></label>
    <label class="f">Durata pauzei (min)<input id="sk" type="number" value="${s.breakMin}"></label>
  </div><button class="btn" id="sv">Salvează setările</button></div>
  <div class="card"><h2>Copie de rezervă</h2><div class="row"><button class="btn" id="bk">⬇ Salvează copia de rezervă</button><button class="btn ghost" id="rs">⬆ Restaurează din fișier</button><input type="file" id="rf" accept=".json" class="hidden"></div>
  <p class="muted">Copia de rezervă conține toate clasele, notele, absențele, orarul, planificările, proiectele și testele.</p></div>
  <div class="card"><h2>Zonă periculoasă</h2><div class="row"><button class="btn ghost" data-demo>Încarcă date demonstrative</button><button class="btn danger" id="wipe">Șterge toate datele</button></div></div>
  <p class="muted">Catedra v1.0 · funcționează complet offline · datele nu părăsesc calculatorul.</p>`);
  $('#sv').onclick = () => { Object.assign(s, { teacher: $('#st').value.trim(), school: $('#ss').value.trim(), year: $('#sy').value.trim(), absLimit: Number($('#sa').value) || 10, periods: Number($('#sp').value) || 7, startTime: $('#sb').value || '08:00', lessonMin: Number($('#sl').value) || 50, breakMin: Number($('#sk').value) || 10 }); save(); toast('Setări salvate'); };
  $('#bk').onclick = () => download(`catedra_backup_${today()}.json`, JSON.stringify(D, null, 1), 'application/json');
  const restore = (txt) => { try { const d = JSON.parse(txt); if (!d.classes) throw 0; ask('Datele actuale vor fi înlocuite. Continuați?', () => { D = { ...blank(), ...d, settings: { ...blank().settings, ...d.settings }, sync: D.sync }; save(); toast('Date restaurate'); go('acasa'); }); } catch { toast('Fișier invalid'); } };
  $('#rs').onclick = async () => { if (window.desktop) { const t = await window.desktop.importFile(); t && restore(t); } else $('#rf').click(); };
  $('#rf').onchange = (e) => { const f = e.target.files[0]; if (f) f.text().then(restore); };
  $('#wipe').onclick = () => ask('Sigur ștergeți TOATE datele? Acțiunea nu poate fi anulată – faceți întâi o copie de rezervă!', () => { D = { ...blank(), sync: D.sync }; save(); go('acasa'); }, 'Da, șterge tot');
};


// ---------- Sincronizare Wi‑Fi ----------
Views.sync = async () => {
  const s = D.sync || {};
  if (Sync.isHub()) {
    const hub = s.hub && s.hub.enabled;
    const info = hub ? await window.desktop.syncServer({ enabled: true, id: s.hub.id, code: s.hub.code }).catch(() => null) : null;
    const devs = Object.values((s.hub && s.hub.devices) || {}).sort((a, b) => b.at - a.at);
    V(`<h1>Sincronizare Wi‑Fi</h1><p class="sub">Telefonul și calculatorul își trimit automat notele, absențele și restul datelor când sunt în aceeași rețea Wi‑Fi. Calculatorul este „centrul”: telefoanele se conectează la el.</p>
    <div class="card"><div class="row"><h2 style="margin:0">Sincronizarea cu telefoanele</h2><span class="spacer"></span>
      ${hub ? '<span class="chip good">Pornită</span><button class="btn ghost" id="off">Oprește</button>' : '<span class="chip warn">Oprită</span><button class="btn" id="on">Pornește sincronizarea</button>'}</div>
      ${hub ? (info && info.running ? `<div class="pair-box">
        <div><span class="muted">Adresa calculatorului</span><b class="pair-val">${info.ips.length ? info.ips.map(esc).join('<br>') : 'nicio rețea'}</b></div>
        <div><span class="muted">Codul de asociere</span><b class="pair-val mono">${esc(s.hub.code)}</b></div></div>
        <p class="muted">Pe telefon: deschideți Catedra → „Sincronizare Wi‑Fi” → introduceți adresa și codul de mai sus. Asocierea se face o singură dată; apoi datele circulă singure.<br>
        Dacă Windows întreabă despre Firewall, permiteți accesul pentru <b>rețele private</b>.</p>
        <div class="row"><button class="btn ghost sm" id="newcode">Generează alt cod (deconectează telefoanele)</button></div>` : `<div class="alert bad">Serverul nu a putut porni${info && info.error ? ': ' + esc(info.error) : ''}. Verificați dacă portul ${SyncCore.PORT} nu este folosit de alt program.</div>`) : '<p class="muted">Porniți sincronizarea pentru a primi un cod de asociere pentru telefon.</p>'}
    </div>
    ${hub ? `<div class="card"><h2>Dispozitive conectate</h2>${devs.length ? `<table><tr><th>Dispozitiv</th><th>Ultima sincronizare</th></tr>${devs.map((d) => `<tr><td>📱 ${esc(d.name)}</td><td>${Sync.ago(d.at)}</td></tr>`).join('')}</table>` : '<p class="muted">Încă niciun telefon conectat.</p>'}</div>` : ''}
    <div class="card"><h2>Cum funcționează</h2><ul class="muted"><li>Tot traficul este criptat (AES‑256) cu codul de asociere; fără cod nimeni nu poate citi sau modifica datele.</li><li>Fiecare notă, absență sau clasă se îmbină separat; dacă aceeași informație a fost modificată pe ambele dispozitive, rămâne modificarea cea mai recentă.</li><li>Ștergerile se transmit și ele. Faceți totuși periodic o copie de rezervă din „Setări”.</li><li>Datele nu trec prin internet – doar prin rețeaua locală.</li></ul></div>`);
    if ($('#on')) $('#on').onclick = async () => { await Sync.hubStart(); Views.sync(); };
    if ($('#off')) $('#off').onclick = async () => { await Sync.hubStop(); Views.sync(); };
    if ($('#newcode')) $('#newcode').onclick = () => ask('Telefoanele asociate vor trebui reconectate cu noul cod. Continuați?', async () => { await Sync.hubNewCode(); Views.sync(); });
    return;
  }
  const p = s.peer;
  V(`<h1>Sincronizare Wi‑Fi</h1><p class="sub">Conectați această aplicație la Catedra de pe calculator. După asociere, datele se sincronizează automat ori de câte ori sunteți în aceeași rețea Wi‑Fi.</p>
  ${p ? `<div class="card"><div class="row"><h2 style="margin:0">Conectat la calculator</h2><span class="spacer"></span><span class="chip ${Sync.status.ok === false ? 'bad' : 'good'}">${Sync.status.ok === false ? 'Fără legătură' : 'Activ'}</span></div>
      <p>Adresa: <b>${esc(p.host)}</b> · Ultima sincronizare reușită: <b>${Sync.ago(p.lastOk)}</b></p><p class="muted" id="sync-live">${esc(Sync.statusLine())}</p>
      <div class="row"><button class="btn" id="now">🔄 Sincronizează acum</button><span class="spacer"></span><button class="btn ghost" id="unpair">Deconectează</button></div></div>`
  : `<div class="card"><h2>Asociere cu calculatorul</h2>
      <ol class="muted"><li>Pe calculator, în Catedra, deschideți „Sincronizare Wi‑Fi” și apăsați „Pornește sincronizarea”.</li><li>Conectați telefonul la aceeași rețea Wi‑Fi.</li><li>Introduceți mai jos adresa și codul afișate pe calculator.</li></ol>
      <label class="f">Adresa calculatorului<input id="ph" inputmode="decimal" placeholder="ex.: 192.168.1.23" autocomplete="off"></label>
      <label class="f">Codul de asociere<input id="pc" placeholder="XXXX-XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" class="mono"></label>
      <div class="row"><button class="btn" id="pair">Conectează</button><span class="muted" id="pmsg"></span></div>
      <p class="muted">Datele existente pe ambele dispozitive se îmbină – nimic nu se pierde.</p></div>`}`);
  if ($('#now')) $('#now').onclick = async () => { $('#now').disabled = true; await Sync.syncNow(true); Views.sync(); };
  if ($('#unpair')) $('#unpair').onclick = () => ask('Deconectați această aplicație de la calculator? Datele rămân pe dispozitiv.', () => { Sync.unpair(); Views.sync(); });
  if ($('#pair')) $('#pair').onclick = async () => {
    const host = $('#ph').value, code = $('#pc').value;
    if (!host.trim() || SyncCore.normCode(code).length !== 16) return toast('Introduceți adresa și codul complet (16 caractere)');
    $('#pair').disabled = true; $('#pmsg').textContent = 'Se conectează…';
    try { await Sync.pair(host, code); toast('Conectat! Datele au fost sincronizate.'); Views.sync(); }
    catch (e) { $('#pair').disabled = false; $('#pmsg').textContent = e.name === 'AbortError' || /fetch|network|Failed/i.test(e.message) ? 'Calculatorul nu răspunde. Verificați adresa, rețeaua Wi‑Fi și că sincronizarea este pornită pe calculator.' : /cod|decrypt|operation/i.test(e.message + e.name) ? 'Cod greșit.' : e.message; }
  };
};

// ---------- Date demonstrative ----------
window.loadDemo = (force) => {
  if ((D.classes.length || D.questions.length) && force !== true) return ask('Datele demonstrative se vor adăuga la cele existente. Continuați?', () => loadDemo(true));
  const names = ['Popescu Andrei', 'Ionescu Maria', 'Dumitrescu Elena', 'Stan Alexandru', 'Gheorghe Ioana', 'Rusu Mihai', 'Munteanu Daria', 'Ciobanu Vlad', 'Moldovan Sara', 'Lupu David', 'Constantin Ana', 'Marin Luca', 'Tudor Bianca', 'Florea Matei', 'Radu Carla', 'Ene Tudor', 'Neagu Alessia', 'Barbu Ștefan', 'Sandu Irina', 'Preda Răzvan'];
  const mk = (name, subject, hours, n) => ({ id: uid(), name, subject, hours, students: shuffle(names).slice(0, n).map((x) => ({ id: uid(), name: x })) });
  const a = mk('a V-a A', 'Matematică', 4, 18), b = mk('a VI-a B', 'Matematică', 4, 16), c = mk('a VIII-a A', 'Matematică', 4, 20);
  D.classes.push(a, b, c);
  const d0 = new Date(); d0.setDate(d0.getDate() - 50);
  for (const k of [a, b, c]) for (const s of k.students) {
    const lvl = 4 + Math.random() * 6, n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) { const d = new Date(d0); d.setDate(d.getDate() + i * 9 + Math.floor(Math.random() * 5)); D.grades.push({ id: uid(), classId: k.id, studentId: s.id, sem: sem(), value: Math.max(1, Math.min(10, Math.round(lvl + (Math.random() * 3 - 1.5)))), date: d.toISOString().slice(0, 10), type: ['Oral', 'Test', 'Temă'][i % 3], comment: '' }); }
    const ab = Math.random() < 0.15 ? 11 : Math.floor(Math.random() * 4);
    for (let i = 0; i < ab; i++) { const d = new Date(d0); d.setDate(d.getDate() + i * 3); D.absences.push({ id: uid(), classId: k.id, studentId: s.id, sem: sem(), date: d.toISOString().slice(0, 10), motivated: Math.random() < 0.4 }); }
  }
  [[1, 1, a], [1, 2, b], [2, 1, c], [2, 3, a], [3, 2, b], [3, 4, c], [4, 1, a], [4, 2, c], [5, 3, b], [5, 4, a]].forEach(([d, p, k]) => (D.timetable[`${d}-${p}`] = { classId: k.id, label: '', room: String(10 + d) }));
  [['Mulțimi', '1.1, 2.1', 'Mulțimi: definiție, notații, relații'], ['Numere naturale', '1.2, 3.1', 'Operații cu numere naturale, ordinea operațiilor'], ['Divizibilitate', '2.2, 4.1', 'Divizor, multiplu, criterii de divizibilitate']].forEach(([u, cp, ct], i) => D.plans.push({ id: uid(), classId: a.id, week: i * 2 + 1, unit: u, comp: cp, content: ct, hours: 8, obs: '' }));
  const Q = [['grila', 'Cât este 12 × 8?', ['96', '86', '108', '92'], 0], ['grila', 'Care dintre numerele următoare este divizibil cu 3?', ['124', '231', '100', '410'], 1], ['grila', 'Cel mai mic număr prim este:', ['0', '1', '2', '3'], 2], ['adevarat', 'Orice număr par este divizibil cu 4.', 'F'], ['adevarat', 'Numărul 0 este număr natural.', 'A'], ['deschis', 'Calculați: 25 + 5 × (18 − 3 × 4).', '25 + 5 × 6 = 55']];
  for (const [t, x, o, k] of Q) D.questions.push(t === 'grila' ? { id: uid(), type: t, text: x, options: o, correct: k, points: 15, subject: 'Matematică', topic: 'Numere naturale' } : { id: uid(), type: t, text: x, answer: o, lines: 4, points: 15, subject: 'Matematică', topic: 'Numere naturale' });
  if (!D.settings.teacher) Object.assign(D.settings, { teacher: 'Prof. Demo', school: 'Școala Gimnazială nr. 1' });
  save(); toast('Date demonstrative încărcate'); go('acasa');
};

(async () => { try { if (window.desktopReady) await window.desktopReady; } catch {} D = loadData(); try { await Sync.init(); } catch (e) { console.error(e); } go('acasa'); })();
