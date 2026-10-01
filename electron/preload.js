const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getCameraStatus: () => ipcRenderer.invoke('get-camera-status'),
  capturePhoto: () => ipcRenderer.invoke('capture-photo'),
  killPTPCamera: () => ipcRenderer.invoke('kill-ptp-camera'),
  getAppUrl: () => ipcRenderer.invoke('get-app-url'),
  saveAppUrl: (url) => ipcRenderer.invoke('save-app-url', url),
  resetAppUrl: () => ipcRenderer.invoke('reset-app-url')
});
