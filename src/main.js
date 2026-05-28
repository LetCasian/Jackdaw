// ============================================================
// JACKDAW - Main Process
// "Collect what catches your eye."
// ============================================================
const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

const userDataPath = app.getPath('userData');
const dataFilePath = path.join(userDataPath, 'jackdaw-data.json');
const settingsFilePath = path.join(userDataPath, 'jackdaw-settings.json');

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
  } catch (e) {
    console.error('Settings load error:', e);
  }
  return {};
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error('Settings save error:', e);
  }
}

function loadJackdawData() {
  try {
    if (fs.existsSync(dataFilePath)) {
      return JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
    }
  } catch (e) {
    console.error('Data load error:', e);
  }
  return { groups: [] };
}

function saveJackdawData(data) {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error('Data save error:', e);
    return false;
  }
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
    } catch (e) {
      console.error('Read error:', filePath, e);
      return null;
    }
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
