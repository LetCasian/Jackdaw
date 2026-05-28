// ============================================================
// JACKDAW - Main Process
// "Collect what catches your eye."
// ============================================================
const { app, BrowserWindow, ipcMain, dialog, globalShortcut, nativeImage, desktopCapturer, screen } = require('electron');
const path = require('path');
const fs = require('fs');

// Activam EyeDropper API (color picker de pe tot ecranul) - dezactivat implicit in Electron
app.commandLine.appendSwitch('enable-features', 'EyeDropper');

const userDataPath = app.getPath('userData');
const dataFilePath = path.join(userDataPath, 'jackdaw-data.json');
const settingsFilePath = path.join(userDataPath, 'jackdaw-settings.json');
// Folder unde stocam imaginile ca fisiere reale (necesar pentru drag-out spre Photoshop)
const imagesDir = path.join(userDataPath, 'images');

if (!fs.existsSync(imagesDir)) {
  try { fs.mkdirSync(imagesDir, { recursive: true }); } catch (e) { console.error(e); }
}

let mainWindow = null;
let pinWindow = null;  // fereastra pop-up de referinta (una la un moment dat)

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

  // Always-on-top la nivelul cel mai inalt ('screen-saver') ca sa stea
  // deasupra aplicatiilor agresive precum Blender, jocuri, ferestre fullscreen.
  if (settings.alwaysOnTop !== false) {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  }
  // Fereastra ramane vizibila si pe alte workspace-uri / fullscreen
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

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
  // Nivelul 'screen-saver' tine fereastra deasupra aplicatiilor agresive (Blender)
  mainWindow.setAlwaysOnTop(newValue, 'screen-saver');
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
    if (!payload || !payload.dataUrl) return;
    const { dataUrl, id } = payload;
    const filePath = dataUrlToFile(dataUrl, `drag_${id}_${Date.now()}`);
    if (!filePath || !fs.existsSync(filePath)) {
      console.error('start-drag: file not ready');
      return;
    }

    // Icon-ul de drag: incercam din imagine, cu fallback la icon-ul app-ului
    let icon;
    try {
      icon = nativeImage.createFromDataURL(dataUrl);
      if (icon.isEmpty()) {
        icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png'));
      }
      icon = icon.resize({ width: 96 });
    } catch (_) {
      icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png'));
    }
    if (!icon || icon.isEmpty()) {
      icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=');
    }

    // startDrag poate crapa daca webContents nu mai e valid - verificam
    if (event.sender && !event.sender.isDestroyed()) {
      event.sender.startDrag({ file: filePath, icon });
    }
  } catch (e) { console.error('start-drag error:', e); }
});

// ------------------------------------------------------------
// FEREASTRA POP-UP DE REFERINTA (pin pe ecran)
// O singura fereastra la un moment dat: deschiderea alteia o inlocuieste.
// Fara margini, always-on-top, redimensionabila, cu zoom propriu.
// ------------------------------------------------------------
ipcMain.on('open-pin-window', (event, payload) => {
  try {
    const { dataUrl } = payload;
    if (!dataUrl) { console.error('open-pin-window: no dataUrl'); return; }

    if (pinWindow && !pinWindow.isDestroyed()) {
      pinWindow.close();
      pinWindow = null;
    }

    pinWindow = new BrowserWindow({
      width: 360,
      height: 360,
      minWidth: 120,
      minHeight: 120,
      frame: false,
      transparent: false,          // transparency rupe randarea pe multe GPU-uri Windows
      alwaysOnTop: true,
      resizable: true,
      backgroundColor: '#1a1a1a',
      hasShadow: true,
      skipTaskbar: false,
      show: false,                 // aratam dupa ce e gata, ca sa nu palpaie
      title: 'Jackdaw Reference',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    pinWindow.setAlwaysOnTop(true, 'screen-saver');
    pinWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    pinWindow.loadFile(path.join(__dirname, 'pin.html'));

    pinWindow.webContents.once('did-finish-load', () => {
      pinWindow.webContents.send('pin-image', dataUrl);
      pinWindow.show();            // afisam explicit dupa incarcare
      pinWindow.focus();
    });

    pinWindow.on('closed', () => { pinWindow = null; });
  } catch (e) { console.error('open-pin-window error:', e); }
});

ipcMain.on('close-pin-window', () => {
  if (pinWindow && !pinWindow.isDestroyed()) {
    pinWindow.close();
    pinWindow = null;
  }
});

// Mutarea ferestrei pin din JS (nu folosim app-region:drag ca sa nu fure scroll-ul)
ipcMain.on('move-pin-window', (event, { dx, dy }) => {
  if (pinWindow && !pinWindow.isDestroyed()) {
    const [x, y] = pinWindow.getPosition();
    pinWindow.setPosition(Math.round(x + dx), Math.round(y + dy));
  }
});

// ------------------------------------------------------------
// COLOR PICKER de pe tot ecranul
// Capturam ecranul ca imagine; renderer-ul afiseaza un overlay
// fullscreen peste care utilizatorul da click ca sa aleaga culoarea.
// ------------------------------------------------------------
ipcMain.handle('capture-screen', async () => {
  try {
    const primary = screen.getPrimaryDisplay();
    const { width, height } = primary.size;
    const scaleFactor = primary.scaleFactor || 1;
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(width * scaleFactor),
        height: Math.round(height * scaleFactor)
      }
    });
    if (!sources.length) return null;
    // Sursa principala (primul ecran)
    return {
      dataUrl: sources[0].thumbnail.toDataURL(),
      width: Math.round(width * scaleFactor),
      height: Math.round(height * scaleFactor),
      cssWidth: width,
      cssHeight: height
    };
  } catch (e) {
    console.error('capture-screen error:', e);
    return null;
  }
});

// Ascunde/arata fereastra principala temporar (ca sa capturam ce e dedesubt)
ipcMain.handle('hide-for-capture', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
    // mic delay ca OS-ul sa redeseneze ce era sub fereastra
    await new Promise(r => setTimeout(r, 180));
  }
});

ipcMain.on('show-after-capture', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }
});

// Pune fereastra sa acopere tot ecranul pentru overlay-ul de picker
let prePickerBounds = null;
ipcMain.handle('enter-picker-fullscreen', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  prePickerBounds = mainWindow.getBounds();
  const primary = screen.getPrimaryDisplay();
  const { x, y, width, height } = primary.bounds;
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setBounds({ x, y, width, height });
  mainWindow.show();
  mainWindow.focus();
});

ipcMain.on('exit-picker-fullscreen', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (prePickerBounds) {
    mainWindow.setBounds(prePickerBounds);
    prePickerBounds = null;
  }
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
