"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const store_1 = require("./services/store");
const watcher_1 = require("./services/watcher");
const journal_1 = require("./services/journal");
let mainWindow = null;
let tray = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        show: false,
        title: 'Subyabastha – Automated File Manager (by Aashutosh)',
        frame: true,
        backgroundColor: '#0f172a',
        icon: loadAppIcon(),
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
    if (isDev && process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools();
    }
    else if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    }
    else {
        const appDistPath = path_1.default.join(__dirname, '../../dist/index.html');
        mainWindow.loadFile(appDistPath);
    }
    // Launched by Windows at login: stay quietly in the tray instead of opening the window
    const launchedAtLogin = process.argv.includes(HIDDEN_ARG);
    const showUnlessHidden = () => {
        if (!(launchedAtLogin && tray))
            mainWindow?.show();
    };
    mainWindow.once('ready-to-show', showUnlessHidden);
    // Never leave the user with an invisible window if the page fails to load
    mainWindow.webContents.once('did-fail-load', showUnlessHidden);
    mainWindow.on('close', (event) => {
        const settings = store_1.storeService.getSettings();
        // Only hide when the tray exists, otherwise the window could never be reopened
        if (settings.minimizeToTray && tray && !electron_1.app.isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
        }
    });
}
function createTray() {
    try {
        const appIcon = loadAppIcon();
        tray = new electron_1.Tray(appIcon.isEmpty() ? createTrayIcon() : appIcon.resize({ width: 32, height: 32 }));
        tray.on('double-click', () => {
            mainWindow?.show();
            mainWindow?.focus();
        });
        const contextMenu = electron_1.Menu.buildFromTemplate([
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
                label: watcher_1.watcherEngine.isRunning() ? 'Pause Engine' : 'Resume Engine',
                click: (item) => {
                    if (watcher_1.watcherEngine.isRunning()) {
                        watcher_1.watcherEngine.pauseEngine();
                        item.label = 'Resume Engine';
                    }
                    else {
                        watcher_1.watcherEngine.startEngine();
                        item.label = 'Pause Engine';
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: () => {
                    electron_1.app.isQuitting = true;
                    electron_1.app.quit();
                }
            }
        ]);
        tray.setToolTip('Subyabastha Automation Engine');
        tray.setContextMenu(contextMenu);
    }
    catch (err) {
        tray = null;
        console.error('Tray icon not created:', err);
    }
}
// App icon copied into dist/ from public/ by the UI build
function loadAppIcon() {
    return electron_1.nativeImage.createFromPath(path_1.default.join(__dirname, '../../dist/app-icon.png'));
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
            if (d > 15.5)
                continue; // transparent
            const inner = d < 6;
            // BGRA
            buffer[i] = inner ? 255 : 241;
            buffer[i + 1] = inner ? 255 : 102;
            buffer[i + 2] = inner ? 255 : 99;
            buffer[i + 3] = 255;
        }
    }
    return electron_1.nativeImage.createFromBuffer(buffer, { width: size, height: size });
}
// Relaunching the app shows the existing (possibly hidden) window instead of a second copy
if (!electron_1.app.requestSingleInstanceLock()) {
    electron_1.app.quit();
}
else {
    electron_1.app.on('second-instance', () => {
        if (!mainWindow)
            return;
        if (mainWindow.isMinimized())
            mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
    });
}
const HIDDEN_ARG = '--hidden';
// Register or remove the Windows login item. Skipped in dev, where it would register electron.exe.
function applyStartOnBoot(enabled) {
    if (!electron_1.app.isPackaged)
        return;
    // Quote the exe path: Electron writes it unquoted, which breaks install folders containing spaces
    electron_1.app.setLoginItemSettings({ openAtLogin: enabled, path: `"${process.execPath}"`, args: [HIDDEN_ARG] });
}
electron_1.app.whenReady().then(() => {
    createTray();
    createWindow();
    watcher_1.watcherEngine.startEngine();
    applyStartOnBoot(store_1.storeService.getSettings().startOnBoot);
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// IPC Register
electron_1.ipcMain.handle('dialog:select-folder', async () => {
    if (!mainWindow)
        return null;
    const res = await electron_1.dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (res.canceled || res.filePaths.length === 0)
        return null;
    return res.filePaths[0];
});
electron_1.ipcMain.handle('rules:get', () => {
    return store_1.storeService.getRules();
});
electron_1.ipcMain.handle('rules:save', (_, rules) => {
    const updated = store_1.storeService.saveRules(rules);
    watcher_1.watcherEngine.reloadWatchers();
    return updated;
});
electron_1.ipcMain.handle('rules:save-one', (_, rule) => {
    const updated = store_1.storeService.updateRule(rule);
    watcher_1.watcherEngine.reloadWatchers();
    return updated;
});
electron_1.ipcMain.handle('rules:delete', (_, id) => {
    const ok = store_1.storeService.deleteRule(id);
    watcher_1.watcherEngine.reloadWatchers();
    return ok;
});
electron_1.ipcMain.handle('rules:dry-run', async (_, folderPath, rules) => {
    return await watcher_1.watcherEngine.dryRunFolder(folderPath, rules);
});
electron_1.ipcMain.handle('journal:get', () => {
    return journal_1.journalService.getEntries();
});
electron_1.ipcMain.handle('journal:undo', async (_, id) => {
    return await journal_1.journalService.undoEntry(id);
});
electron_1.ipcMain.handle('journal:undo-rule', async (_, ruleId) => {
    return await (0, journal_1.undoRuleActions)(ruleId);
});
electron_1.ipcMain.handle('engine:status', () => {
    return {
        isRunning: watcher_1.watcherEngine.isRunning(),
        processedCount: watcher_1.watcherEngine.getProcessedCount()
    };
});
electron_1.ipcMain.handle('engine:toggle', (_, running) => {
    if (running)
        watcher_1.watcherEngine.startEngine();
    else
        watcher_1.watcherEngine.pauseEngine();
    return watcher_1.watcherEngine.isRunning();
});
electron_1.ipcMain.handle('settings:get', () => {
    return store_1.storeService.getSettings();
});
electron_1.ipcMain.handle('settings:save', (_, settings) => {
    const saved = store_1.storeService.saveSettings(settings);
    if (settings.startOnBoot !== undefined)
        applyStartOnBoot(saved.startOnBoot);
    return saved;
});
electron_1.ipcMain.handle('settings:get-presets', () => {
    return store_1.storeService.getPresets();
});
