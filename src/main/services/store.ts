import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type { Rule, AppSettings } from '../../types';

const defaultSettings: AppSettings = {
  startOnBoot: true,
  minimizeToTray: true,
  showNotifications: true,
  theme: 'dark',
  author: 'Aashutosh'
};

// Each preset sorts Downloads into subfolders of Downloads itself,
// grouped by the month the file arrived, e.g. Downloads/Images/png/2026-09
function downloadsPreset(id: string, name: string, extensions: string, destination: string): Rule {
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

const presetRules: Rule[] = [
  downloadsPreset('preset_images', 'Sort Downloaded Images',
    'png, jpg, jpeg, gif, webp, svg, bmp, heic', '{downloads}/Images/{ext}/{year}-{month}'),
  downloadsPreset('preset_documents', 'Sort Downloaded Documents',
    'pdf, doc, docx, txt, rtf, odt, xls, xlsx, csv, ppt, pptx', '{downloads}/Documents/{ext}/{year}-{month}'),
  downloadsPreset('preset_videos', 'Sort Downloaded Videos',
    'mp4, mkv, mov, avi, webm, wmv', '{downloads}/Videos/{year}-{month}'),
  downloadsPreset('preset_audio', 'Sort Downloaded Music & Audio',
    'mp3, wav, flac, m4a, aac, ogg', '{downloads}/Audio/{year}-{month}'),
  downloadsPreset('preset_archives', 'Sort Downloaded Archives',
    'zip, rar, 7z, tar, gz', '{downloads}/Archives/{year}-{month}'),
  downloadsPreset('preset_installers', 'Sort Downloaded Installers',
    'exe, msi', '{downloads}/Installers/{year}-{month}')
];

class StoreService {
  private rulesPath: string;
  private settingsPath: string;
  private rules: Rule[] = [];
  private settings: AppSettings = defaultSettings;

  constructor() {
    const userDataPath = app ? app.getPath('userData') : process.cwd();
    this.rulesPath = path.join(userDataPath, 'rules.json');
    this.settingsPath = path.join(userDataPath, 'settings.json');
    this.init();
  }

  private init() {
    // Load Settings
    try {
      if (fs.existsSync(this.settingsPath)) {
        // Fill in settings added in later versions with their defaults
        this.settings = { ...defaultSettings, ...JSON.parse(fs.readFileSync(this.settingsPath, 'utf-8')) };
      } else {
        this.saveSettings();
      }
    } catch {
      this.settings = defaultSettings;
    }

    // Load Rules
    try {
      if (fs.existsSync(this.rulesPath)) {
        this.rules = JSON.parse(fs.readFileSync(this.rulesPath, 'utf-8'));
        this.migrateLegacyPresets();
      } else {
        // First install: no rules, so nothing is sorted until the user sets up a preset or rule
        this.rules = [];
        this.saveRules();
      }
    } catch (err) {
      console.error('Failed to load rules store:', err);
      this.rules = [];
    }
  }

  // v1.0.0 seeded presets that moved files out of Downloads into Pictures/Documents.
  // Replace them with the Downloads presets; the user's own rules are kept.
  private migrateLegacyPresets() {
    const legacyIds = ['preset_downloads_cleaner', 'preset_invoice_sorter', 'preset_photos_sorter'];
    const legacy = this.rules.filter(r => legacyIds.includes(r.id));
    if (legacy.length === 0) return;

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

  public getRules(): Rule[] {
    return this.rules;
  }

  public saveRules(rules?: Rule[]): Rule[] {
    if (rules) this.rules = rules;
    try {
      fs.writeFileSync(this.rulesPath, JSON.stringify(this.rules, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save rules:', err);
    }
    return this.rules;
  }

  public getRuleById(id: string): Rule | undefined {
    return this.rules.find(r => r.id === id);
  }

  public updateRule(rule: Rule): Rule {
    const idx = this.rules.findIndex(r => r.id === rule.id);
    if (idx >= 0) {
      this.rules[idx] = rule;
    } else {
      this.rules.push(rule);
    }
    this.saveRules();
    return rule;
  }

  public deleteRule(id: string): boolean {
    this.rules = this.rules.filter(r => r.id !== id);
    this.saveRules();
    return true;
  }

  public incrementRuleStat(id: string) {
    const rule = this.rules.find(r => r.id === id);
    if (rule) {
      rule.stats.timesTriggered += 1;
      rule.stats.lastTriggered = new Date().toISOString();
      this.saveRules();
    }
  }

  public getSettings(): AppSettings {
    return this.settings;
  }

  public saveSettings(settings?: Partial<AppSettings>): AppSettings {
    if (settings) {
      this.settings = { ...this.settings, ...settings };
    }
    try {
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
    return this.settings;
  }

  // Presets ready to import: watch Downloads ({downloads} in destinations is resolved when a rule runs)
  public getPresets(): Rule[] {
    return presetRules.map(r => ({
      ...r,
      monitoredFolders: [app.getPath('downloads')]
    }));
  }
}

export const storeService = new StoreService();
