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

const presetRules: Rule[] = [
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
        this.settings = JSON.parse(fs.readFileSync(this.settingsPath, 'utf-8'));
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
      } else {
        // Seed default rule presets
        const defaultDocDir = app ? app.getPath('documents') : process.cwd();
        const defaultPicDir = app ? app.getPath('pictures') : process.cwd();
        
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
    } catch (err) {
      console.error('Failed to load rules store:', err);
      this.rules = [];
    }
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

  public getPresets(): Rule[] {
    return presetRules;
  }
}

export const storeService = new StoreService();
