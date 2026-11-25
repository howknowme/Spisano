const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  load: () => ipcRenderer.sendSync('store:load'),
  save: (json) => ipcRenderer.sendSync('store:save', json),
  exportFile: (name, content) => ipcRenderer.invoke('file:export', { name, content }),
  importFile: () => ipcRenderer.invoke('file:import')
});
