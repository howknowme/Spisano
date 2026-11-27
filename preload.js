const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  load: () => ipcRenderer.sendSync('store:load'),
  save: (json) => ipcRenderer.sendSync('store:save', json),
  exportFile: (name, content) => ipcRenderer.invoke('file:export', { name, content }),
  importFile: () => ipcRenderer.invoke('file:import'),
  syncServer: (cfg) => ipcRenderer.invoke('sync:server', cfg),
  onSyncRequest: (handler) => ipcRenderer.on('sync:incoming', async (_e, id, data) => {
    let res; try { res = await handler(data); } catch (e) { res = null; }
    ipcRenderer.send('sync:reply', id, res);
  })
});
