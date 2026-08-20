const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronReplayAPI', {
  saveReplay: (filename, contents, retentionLimit) =>
    ipcRenderer.invoke('replay:save', { filename, contents, retentionLimit }),
});
