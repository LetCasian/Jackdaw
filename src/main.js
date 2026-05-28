// ============================================================
// JACKDAW - Main Process
// "Collect what catches your eye."
// ============================================================
const { app, BrowserWindow, ipcMain, dialog, globalShortcut, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const userDataPath = app.getPath('userData');
const dataFilePath = path.join(userDataPath, 'jackdaw-data.json');
const settingsFilePath = path.join(userDataPath, 'jackdaw-settings.json');
// Folder unde stocam imaginile ca fisiere reale (necesar pentru drag-out spre Photoshop)
const imagesDir = path.join(userDataPath, 'images');

if (!fs.existsSync(imagesDir)) {
  try { fs.mkdirSync(imagesDir, { recursive: true }); } catch (e) { console.error(e); }
}

let mainWindow = null;

function createWindow() {
  const settings = loadSettings();

  mainWindow = new BrowserWindow({
    width: settings.width || 520,
    height: settings.height || 900,
    x: settings.x,
    y: settings.y,
    minWidth: 320,
    minHeight: 400,
    resizable: true,
    alwaysOnTop: settings.alwaysOnTop !== false,
    frame: false,
    transparent: false,
    backgroundColor: '#1a1a1a',
    title: 'Jackdaw',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  const saveBounds = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const bounds = mainWindow.getBounds();
    const currentSettings = loadSettings();
    saveSettings({
      ...currentSettings,
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y
    });
  };

  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);
  mainWindow.on('closed', () => { mainWindow = null; });
}

function loadSettings() {
  try {
    if (fs.existsSync(settingsFilePath)) {
      return JSON.parse(fs.readFileSync(settingsFilePath, 'utf-8'));
    }
  } catch (e) { console.error('Settings load error:', e); }
  return {};
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
  } catch (e) { console.error('Settings save error:', e); }
}

function loadJackdawData() {
  try {
    if (fs.existsSync(dataFilePath)) {
      return JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
    }
  } catch (e) { console.error('Data load error:', e); }
  return { groups: [] };
}

function saveJackdawData(data) {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    return true;
  } catch (e) { console.error('Data save error:', e); return false; }
}

// Converteste un dataURL base64 intr-un fisier real pe disk.
function dataUrlToFile(dataUrl, idHint) {
  try {
    const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) return null;
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const base64 = match[2];
    const fileName = `${idHint || Date.now()}.${ext}`;
    const filePath = path.join(imagesDir, fileName);
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
    return filePath;
  } catch (e) { console.error('dataUrlToFile error:', e); return null; }
}

// ------------------------------------------------------------
// IPC Handlers
// ------------------------------------------------------------
ipcMain.handle('save-data', (event, data) => saveJackdawData(data));
ipcMain.handle('load-data', () => loadJackdawData());

ipcMain.handle('select-images', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select images for your collection',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }
    ]
  });

  if (result.canceled || !result.filePaths.length) return [];

  return result.filePaths.map(filePath => {
    try {
      const data = fs.readFileSync(filePath);
      const ext = path.extname(filePath).slice(1).toLowerCase();
      const mimeType = ext === 'jpg' ? 'jpeg' : ext;
      return {
        name: path.basename(filePath),
        path: filePath,
        dataUrl: `data:image/${mimeType};base64,${data.toString('base64')}`
      };
    } catch (e) { console.error('Read error:', filePath, e); return null; }
  }).filter(Boolean);
});

ipcMain.handle('toggle-always-on-top', () => {
  if (!mainWindow) return false;
  const newValue = !mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(newValue);
  const settings = loadSettings();
  saveSettings({ ...settings, alwaysOnTop: newValue });
  return newValue;
});

ipcMain.handle('get-always-on-top', () => mainWindow ? mainWindow.isAlwaysOnTop() : false);

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-close', () => mainWindow?.close());
ipcMain.on('window-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('set-opacity', (event, opacity) => {
  if (mainWindow) mainWindow.setOpacity(opacity);
});

// ------------------------------------------------------------
// DRAG-OUT spre Photoshop / alte aplicatii
// Photoshop accepta drop de FISIERE, deci scriem imaginea pe disk
// si pornim un drag nativ cu acel fisier.
// dataUrl contine deja imaginea (cu transformari aplicate daca exista)
// ------------------------------------------------------------
ipcMain.on('start-drag', (event, payload) => {
  try {
    const { dataUrl, id } = payload;
    const filePath = dataUrlToFile(dataUrl, `drag_${id}_${Date.now()}`);
    if (!filePath) { console.error('start-drag: no file'); return; }

    // Icon-ul de drag: incercam din imagine, cu fallback la icon-ul app-ului
    let icon = nativeImage.createFromDataURL(dataUrl);
    if (icon.isEmpty()) {
      icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png'));
    }
    // startDrag necesita un icon ne-gol; resize defensiv
    try { icon = icon.resize({ width: 96 }); } catch (_) {}
    if (icon.isEmpty()) {
      // ultim resort: icon 1x1 transparent ca sa nu crape startDrag
      icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=');
    }
    event.sender.startDrag({ file: filePath, icon });
  } catch (e) { console.error('start-drag error:', e); }
});

// ------------------------------------------------------------
// App lifecycle
// ------------------------------------------------------------
app.whenReady().then(() => {
  createWindow();

  globalShortcut.register('CommandOrControl+Shift+J', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
