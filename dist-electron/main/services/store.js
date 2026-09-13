"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
const defaultSettings = {
    startOnBoot: true,
    minimizeToTray: true,
    showNotifications: true,
    theme: 'dark',
    author: 'Aashutosh'
};
const presetRules = [
    {
        id: 'preset_downloads_cleaner',
        name: 'Clean Downloads Folder (PDF & Docs)',
        enabled: true,
        monitoredFolders: [],
        matchType: 'ALL',
        conditions: [
            { id: 'c1', field: 'extension', operator: 'equals', value: 'pdf' }
        ],
        actions: [
            { id: 'a1', type: 'move', destination: '{userDocs}/Organized_PDFs/{year}' },
            { id: 'a2', type: 'notify', notifyMessage: 'Moved PDF file to Organized_PDFs folder' }
        ],
        stats: { timesTriggered: 0, lastTriggered: null }
    },
    {
        id: 'preset_invoice_sorter',
        name: 'Auto-Organize Tax Invoices by Content Date',
        enabled: true,
        monitoredFolders: [],
        matchType: 'ALL',
        conditions: [
            { id: 'c1', field: 'extension', operator: 'equals', value: 'pdf' },
            { id: 'c2', field: 'pdfContent', operator: 'contains', value: 'invoice' }
        ],
        actions: [
            { id: 'a1', type: 'rename', pattern: 'Invoice_{extracted_date}_{name}.pdf' },
            { id: 'a2', type: 'move', destination: '{userDocs}/Invoices/{year}' }
        ],
        stats: { timesTriggered: 0, lastTriggered: null }
    },
    {
        id: 'preset_photos_sorter',
        name: 'Sort Photos & Screenshots by Month',
        enabled: true,
        monitoredFolders: [],
        matchType: 'ANY',
        conditions: [
            { id: 'c1', field: 'extension', operator: 'equals', value: 'png' },
            { id: 'c2', field: 'extension', operator: 'equals', value: 'jpg' }
        ],
        actions: [
            { id: 'a1', type: 'move', destination: '{userPictures}/Organized_Photos/{year}-{month}' }
        ],
        stats: { timesTriggered: 0, lastTriggered: null }
    }
];
class StoreService {
    rulesPath;
    settingsPath;
    rules = [];
    settings = defaultSettings;
    constructor() {
        const userDataPath = electron_1.app ? electron_1.app.getPath('userData') : process.cwd();
        this.rulesPath = path_1.default.join(userDataPath, 'rules.json');
        this.settingsPath = path_1.default.join(userDataPath, 'settings.json');
        this.init();
    }
    init() {
        // Load Settings
        try {
            if (fs_1.default.existsSync(this.settingsPath)) {
                this.settings = JSON.parse(fs_1.default.readFileSync(this.settingsPath, 'utf-8'));
            }
            else {
                this.saveSettings();
            }
        }
        catch {
            this.settings = defaultSettings;
        }
        // Load Rules
        try {
            if (fs_1.default.existsSync(this.rulesPath)) {
                this.rules = JSON.parse(fs_1.default.readFileSync(this.rulesPath, 'utf-8'));
            }
            else {
                // Seed default rule presets
                const defaultDocDir = electron_1.app ? electron_1.app.getPath('documents') : process.cwd();
                const defaultPicDir = electron_1.app ? electron_1.app.getPath('pictures') : process.cwd();
                this.rules = presetRules.map(r => ({
                    ...r,
                    actions: r.actions.map(a => ({
                        ...a,
                        destination: a.destination
                            ? a.destination.replace('{userDocs}', defaultDocDir).replace('{userPictures}', defaultPicDir)
                            : undefined
                    }))
                }));
                this.saveRules();
            }
        }
        catch (err) {
            console.error('Failed to load rules store:', err);
            this.rules = [];
        }
    }
    getRules() {
        return this.rules;
    }
    saveRules(rules) {
        if (rules)
            this.rules = rules;
        try {
            fs_1.default.writeFileSync(this.rulesPath, JSON.stringify(this.rules, null, 2), 'utf-8');
        }
        catch (err) {
            console.error('Failed to save rules:', err);
        }
        return this.rules;
    }
    getRuleById(id) {
        return this.rules.find(r => r.id === id);
    }
    updateRule(rule) {
        const idx = this.rules.findIndex(r => r.id === rule.id);
        if (idx >= 0) {
            this.rules[idx] = rule;
        }
        else {
            this.rules.push(rule);
        }
        this.saveRules();
        return rule;
    }
    deleteRule(id) {
        this.rules = this.rules.filter(r => r.id !== id);
        this.saveRules();
        return true;
    }
    incrementRuleStat(id) {
        const rule = this.rules.find(r => r.id === id);
        if (rule) {
            rule.stats.timesTriggered += 1;
            rule.stats.lastTriggered = new Date().toISOString();
            this.saveRules();
        }
    }
    getSettings() {
        return this.settings;
    }
    saveSettings(settings) {
        if (settings) {
            this.settings = { ...this.settings, ...settings };
        }
        try {
            fs_1.default.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
        }
        catch (err) {
            console.error('Failed to save settings:', err);
        }
        return this.settings;
    }
    getPresets() {
        return presetRules;
    }
}
exports.storeService = new StoreService();
