import { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import type { Rule, AppSettings } from '../types';
import { storeService } from './services/store';
import { watcherEngine } from './services/watcher';
import { journalService, undoRuleActions } from './services/journal';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Subyabastha – Automated File Manager (by Aashutosh)',
    frame: true,
    backgroundColor: '#0f172a',
    icon: loadAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    const appDistPath = path.join(__dirname, '../../dist/index.html');
    mainWindow.loadFile(appDistPath);
  }

  mainWindow.on('close', (event) => {
    const settings = storeService.getSettings();
    // Only hide when the tray exists, otherwise the window could never be reopened
    if (settings.minimizeToTray && tray && !(app as any).isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createTray() {
  try {
    const appIcon = loadAppIcon();
    tray = new Tray(appIcon.isEmpty() ? createTrayIcon() : appIcon.resize({ width: 32, height: 32 }));
    tray.on('double-click', () => {
      mainWindow?.show();
      mainWindow?.focus();
    });
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Subyabastha (by Aashutosh)', enabled: false },
      { type: 'separator' },
      {
        label: 'Open Dashboard',
        click: () => {
          mainWindow?.show();
          mainWindow?.focus();
        }
      },
      {
        label: watcherEngine.isRunning() ? 'Pause Engine' : 'Resume Engine',
        click: (item) => {
          if (watcherEngine.isRunning()) {
            watcherEngine.pauseEngine();
            item.label = 'Resume Engine';
          } else {
            watcherEngine.startEngine();
            item.label = 'Pause Engine';
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          (app as any).isQuitting = true;
          app.quit();
        }
      }
    ]);
    tray.setToolTip('Subyabastha Automation Engine');
    tray.setContextMenu(contextMenu);
  } catch (err) {
    tray = null;
    console.error('Tray icon not created:', err);
  }
}

// App icon copied into dist/ from public/ by the UI build
function loadAppIcon() {
  return nativeImage.createFromPath(path.join(__dirname, '../../dist/app-icon.png'));
}

// Fallback when dist/ is not built yet: draw a 32x32 indigo disc with a white centre, so no icon file needs to ship
function createTrayIcon() {
  const size = 32;
  const buffer = Buffer.alloc(size * size * 4);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      const i = (y * size + x) * 4;
      if (d > 15.5) continue; // transparent
      const inner = d < 6;
      // BGRA
      buffer[i] = inner ? 255 : 241;
      buffer[i + 1] = inner ? 255 : 102;
      buffer[i + 2] = inner ? 255 : 99;
      buffer[i + 3] = 255;
    }
  }
  return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}

// Relaunching the app shows the existing (possibly hidden) window instead of a second copy
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  watcherEngine.startEngine();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Register
ipcMain.handle('dialog:select-folder', async () => {
  if (!mainWindow) return null;
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (res.canceled || res.filePaths.length === 0) return null;
  return res.filePaths[0];
});

ipcMain.handle('rules:get', () => {
  return storeService.getRules();
});

ipcMain.handle('rules:save', (_, rules: Rule[]) => {
  const updated = storeService.saveRules(rules);
  watcherEngine.reloadWatchers();
  return updated;
});

ipcMain.handle('rules:save-one', (_, rule: Rule) => {
  const updated = storeService.updateRule(rule);
  watcherEngine.reloadWatchers();
  return updated;
});

ipcMain.handle('rules:delete', (_, id: string) => {
  const ok = storeService.deleteRule(id);
  watcherEngine.reloadWatchers();
  return ok;
});

ipcMain.handle('rules:dry-run', async (_, folderPath: string, rules?: Rule[]) => {
  return await watcherEngine.dryRunFolder(folderPath, rules);
});

ipcMain.handle('journal:get', () => {
  return journalService.getEntries();
});

ipcMain.handle('journal:undo', async (_, id: string) => {
  return await journalService.undoEntry(id);
});

ipcMain.handle('journal:undo-rule', async (_, ruleId: string) => {
  return await undoRuleActions(ruleId);
});

ipcMain.handle('engine:status', () => {
  return {
    isRunning: watcherEngine.isRunning(),
    processedCount: watcherEngine.getProcessedCount()
  };
});

ipcMain.handle('engine:toggle', (_, running: boolean) => {
  if (running) watcherEngine.startEngine();
  else watcherEngine.pauseEngine();
  return watcherEngine.isRunning();
});

ipcMain.handle('settings:get', () => {
  return storeService.getSettings();
});

ipcMain.handle('settings:save', (_, settings: Partial<AppSettings>) => {
  return storeService.saveSettings(settings);
});

ipcMain.handle('settings:get-presets', () => {
  return storeService.getPresets();
});
