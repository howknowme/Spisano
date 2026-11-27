const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const SyncCore = require('./src/sync-core.js');

const dataFile = () => path.join(app.getPath('userData'), 'catedra-date.json');

ipcMain.on('store:load', (e) => {
  try { e.returnValue = fs.existsSync(dataFile()) ? fs.readFileSync(dataFile(), 'utf8') : null; }
  catch { e.returnValue = null; }
});
ipcMain.on('store:save', (e, json) => {
  try {
    const f = dataFile();
    if (fs.existsSync(f)) fs.copyFileSync(f, f + '.bak');
    fs.writeFileSync(f, json, 'utf8');
    e.returnValue = true;
  } catch { e.returnValue = false; }
});
ipcMain.handle('file:export', async (_e, { name, content }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({ defaultPath: name });
  if (canceled || !filePath) return false;
  fs.writeFileSync(filePath, content, 'utf8');
  return true;
});
ipcMain.handle('file:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ filters: [{ name: 'Copie de rezervă', extensions: ['json'] }], properties: ['openFile'] });
  if (canceled || !filePaths[0]) return null;
  return fs.readFileSync(filePaths[0], 'utf8');
});


// ---------- Server de sincronizare Wi‑Fi ----------
let mainWin = null, syncSrv = null, syncCfg = null;
const pending = new Map();
const failures = new Map(); // limitare încercări cu cod greșit, pe IP
function lanIPs() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) {
    if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) out.push(a.address);
  }
  return out.sort((a, b) => (/^192\.168\./.test(b) - /^192\.168\./.test(a)));
}
function askRenderer(data) {
  return new Promise((resolve, reject) => {
    if (!mainWin || mainWin.isDestroyed()) return reject(new Error('fereastra este închisă'));
    const id = Math.random().toString(36).slice(2);
    const t = setTimeout(() => { pending.delete(id); reject(new Error('timeout')); }, 20000);
    pending.set(id, (res) => { clearTimeout(t); resolve(res); });
    mainWin.webContents.send('sync:incoming', id, data);
  });
}
ipcMain.on('sync:reply', (_e, id, res) => { const f = pending.get(id); if (f) { pending.delete(id); f(res); } });

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Private-Network': 'true', 'Cache-Control': 'no-store' });
  res.end(obj === undefined ? '' : JSON.stringify(obj));
}
async function handle(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204);
  if (!syncCfg) return send(res, 503, { error: 'oprit' });
  const url = req.url.split('?')[0];
  if (req.method === 'GET' && url === '/catedra/hello') return send(res, 200, { app: 'catedra', v: 1, id: syncCfg.id });
  if (req.method === 'POST' && url === '/catedra/sync') {
    const ip = req.socket.remoteAddress;
    const f = failures.get(ip) || { n: 0, t: Date.now() };
    if (Date.now() - f.t > 10 * 60 * 1000) { f.n = 0; f.t = Date.now(); }
    if (f.n >= 20) return send(res, 429, { error: 'prea multe încercări' });
    let body = '', size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 50 * 1024 * 1024) return send(res, 413, { error: 'prea mare' }); body += chunk; }
    let data;
    try { data = await SyncCore.open(syncCfg.code, JSON.parse(body)); }
    catch (e) { f.n++; failures.set(ip, f); return send(res, 403, { error: 'cod greșit' }); }
    try { const reply = await askRenderer(data); if (!reply || !reply.state) throw new Error('date invalide'); return send(res, 200, await SyncCore.seal(syncCfg.code, reply)); }
    catch (e) { return send(res, 500, { error: e.message }); }
  }
  send(res, 404, { error: 'necunoscut' });
}
function startServer() {
  return new Promise((resolve, reject) => {
    const s = http.createServer((req, res) => handle(req, res).catch(() => { try { send(res, 500, {}); } catch (e) {} }));
    s.once('error', reject);
    s.listen(SyncCore.PORT, '0.0.0.0', () => { s.removeListener('error', reject); syncSrv = s; resolve(); });
  });
}
ipcMain.handle('sync:server', async (_e, cfg) => {
  if (!cfg || !cfg.enabled) { syncCfg = null; if (syncSrv) { syncSrv.close(); syncSrv = null; } return { running: false }; }
  syncCfg = { id: String(cfg.id), code: String(cfg.code) };
  try { if (!syncSrv) await startServer(); } catch (e) { syncCfg = null; return { running: false, error: e.code || e.message }; }
  return { running: true, ips: lanIPs(), port: SyncCore.PORT };
});

function createWindow() {
  const win = mainWin = new BrowserWindow({
    width: 1320, height: 860, minWidth: 980, minHeight: 640,
    title: 'Catedra', backgroundColor: '#f6f4ef', icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Fișier', submenu: [{ role: 'reload', label: 'Reîncarcă' }, { type: 'separator' }, { role: 'quit', label: 'Ieșire' }] },
    { label: 'Editare', submenu: [{ role: 'undo', label: 'Anulează' }, { role: 'redo', label: 'Refă' }, { type: 'separator' }, { role: 'cut', label: 'Taie' }, { role: 'copy', label: 'Copiază' }, { role: 'paste', label: 'Lipește' }, { role: 'selectAll', label: 'Selectează tot' }] },
    { label: 'Vizualizare', submenu: [{ role: 'zoomIn', label: 'Mărește' }, { role: 'zoomOut', label: 'Micșorează' }, { role: 'resetZoom', label: 'Dimensiune normală' }, { role: 'togglefullscreen', label: 'Ecran complet' }, { role: 'toggleDevTools', label: 'Instrumente dezvoltator' }] }
  ]));
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
