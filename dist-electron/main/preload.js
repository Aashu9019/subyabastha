"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('api', {
    selectFolder: () => electron_1.ipcRenderer.invoke('dialog:select-folder'),
    getRules: () => electron_1.ipcRenderer.invoke('rules:get'),
    saveRules: (rules) => electron_1.ipcRenderer.invoke('rules:save', rules),
    saveRule: (rule) => electron_1.ipcRenderer.invoke('rules:save-one', rule),
    deleteRule: (id) => electron_1.ipcRenderer.invoke('rules:delete', id),
    dryRun: (folderPath, rules) => electron_1.ipcRenderer.invoke('rules:dry-run', folderPath, rules),
    getJournal: () => electron_1.ipcRenderer.invoke('journal:get'),
    undoJournalEntry: (id) => electron_1.ipcRenderer.invoke('journal:undo', id),
    getEngineStatus: () => electron_1.ipcRenderer.invoke('engine:status'),
    toggleEngine: (running) => electron_1.ipcRenderer.invoke('engine:toggle', running),
    getSettings: () => electron_1.ipcRenderer.invoke('settings:get'),
    saveSettings: (settings) => electron_1.ipcRenderer.invoke('settings:save', settings),
    getPresets: () => electron_1.ipcRenderer.invoke('settings:get-presets')
});
