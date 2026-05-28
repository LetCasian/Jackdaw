// ============================================================
// JACKDAW - Preload (secure bridge)
// ============================================================
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jackdaw', {
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  loadData: () => ipcRenderer.invoke('load-data'),
  selectImages: () => ipcRenderer.invoke('select-images'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
  getAlwaysOnTop: () => ipcRenderer.invoke('get-always-on-top'),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  setOpacity: (value) => ipcRenderer.send('set-opacity', value),
  // Drag-out spre Photoshop
  startDrag: (payload) => ipcRenderer.send('start-drag', payload),
  // Fereastra pop-up de referinta
  openPinWindow: (payload) => ipcRenderer.send('open-pin-window', payload),
  closePinWindow: () => ipcRenderer.send('close-pin-window'),
  movePinWindow: (delta) => ipcRenderer.send('move-pin-window', delta),
  // Ascultator pentru fereastra pin: primeste imaginea
  onPinImage: (callback) => ipcRenderer.on('pin-image', (event, dataUrl) => callback(dataUrl)),
  // Color picker de pe tot ecranul
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  hideForCapture: () => ipcRenderer.invoke('hide-for-capture'),
  showAfterCapture: () => ipcRenderer.send('show-after-capture'),
  enterPickerFullscreen: () => ipcRenderer.invoke('enter-picker-fullscreen'),
  exitPickerFullscreen: () => ipcRenderer.send('exit-picker-fullscreen')
});
