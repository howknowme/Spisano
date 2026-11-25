const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

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

function createWindow() {
  const win = new BrowserWindow({
    width: 1320, height: 860, minWidth: 980, minHeight: 640,
    title: 'Catedra', backgroundColor: '#f6f4ef',
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
