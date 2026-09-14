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
// Each preset sorts Downloads into subfolders of Downloads itself,
// grouped by the month the file arrived, e.g. Downloads/Images/png/2026-09
function downloadsPreset(id, name, extensions, destination) {
    return {
        id,
        name,
        enabled: true,
        monitoredFolders: [],
        matchType: 'ALL',
        conditions: [{ id: 'c1', field: 'extension', operator: 'in', value: extensions }],
        actions: [{ id: 'a1', type: 'move', destination }],
        stats: { timesTriggered: 0, lastTriggered: null }
    };
}
const presetRules = [
    downloadsPreset('preset_images', 'Sort Downloaded Images', 'png, jpg, jpeg, gif, webp, svg, bmp, heic', '{downloads}/Images/{ext}/{year}-{month}'),
    downloadsPreset('preset_documents', 'Sort Downloaded Documents', 'pdf, doc, docx, txt, rtf, odt, xls, xlsx, csv, ppt, pptx', '{downloads}/Documents/{ext}/{year}-{month}'),
    downloadsPreset('preset_videos', 'Sort Downloaded Videos', 'mp4, mkv, mov, avi, webm, wmv', '{downloads}/Videos/{year}-{month}'),
    downloadsPreset('preset_audio', 'Sort Downloaded Music & Audio', 'mp3, wav, flac, m4a, aac, ogg', '{downloads}/Audio/{year}-{month}'),
    downloadsPreset('preset_archives', 'Sort Downloaded Archives', 'zip, rar, 7z, tar, gz', '{downloads}/Archives/{year}-{month}'),
    downloadsPreset('preset_installers', 'Sort Downloaded Installers', 'exe, msi', '{downloads}/Installers/{year}-{month}')
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
                this.migrateLegacyPresets();
            }
            else {
                // Seed the Downloads presets switched off, so nothing moves until the user turns a rule on
                this.rules = this.getPresets().map(r => ({ ...r, enabled: false }));
                this.saveRules();
            }
        }
        catch (err) {
            console.error('Failed to load rules store:', err);
            this.rules = [];
        }
    }
    // v1.0.0 seeded presets that moved files out of Downloads into Pictures/Documents.
    // Replace them with the Downloads presets; the user's own rules are kept.
    migrateLegacyPresets() {
        const legacyIds = ['preset_downloads_cleaner', 'preset_invoice_sorter', 'preset_photos_sorter'];
        const legacy = this.rules.filter(r => legacyIds.includes(r.id));
        if (legacy.length === 0)
            return;
        // Keep image sorting on if the old photo rule was already sorting Downloads
        const photos = legacy.find(r => r.id === 'preset_photos_sorter');
        const imagesOn = !!photos && photos.enabled && photos.monitoredFolders.length > 0;
        const existingIds = new Set(this.rules.map(r => r.id));
        const replacements = this.getPresets()
            .filter(r => !existingIds.has(r.id))
            .map(r => ({ ...r, enabled: r.id === 'preset_images' && imagesOn }));
        this.rules = [...replacements, ...this.rules.filter(r => !legacyIds.includes(r.id))];
        this.saveRules();
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
    // Presets ready to import: watch Downloads ({downloads} in destinations is resolved when a rule runs)
    getPresets() {
        return presetRules.map(r => ({
            ...r,
            monitoredFolders: [electron_1.app.getPath('downloads')]
        }));
    }
}
exports.storeService = new StoreService();
