import { app, BrowserWindow, ipcMain, dialog, Tray, Menu } from 'electron';
import path from 'path';
import { storeService } from './services/store';
import { watcherEngine } from './services/watcher';
import { journalService } from './services/journal';
import { Rule, AppSettings } from '../types';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'FileSarathi – Automated File Manager (by Aashutosh)',
    frame: true,
    backgroundColor: '#0f172a',
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
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('close', (event) => {
    const settings = storeService.getSettings();
    if (settings.minimizeToTray && !(app as any).isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createTray() {
  // Use simple tray icon placeholder
  try {
    tray = new Tray(path.join(__dirname, 'icon.png'));
    const contextMenu = Menu.buildFromTemplate([
      { label: 'FileSarathi Pro (by Aashutosh)', enabled: false },
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
    tray.setToolTip('FileSarathi Automation Engine');
    tray.setContextMenu(contextMenu);
  } catch {
    console.log('Tray icon not created (missing icon file in dev).');
  }
}

app.whenReady().then(() => {
  createWindow();
  createTray();

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
