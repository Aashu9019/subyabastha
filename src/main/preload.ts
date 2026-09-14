import { contextBridge, ipcRenderer } from 'electron';
import type { Rule, AppSettings } from '../types';

contextBridge.exposeInMainWorld('api', {
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:select-folder'),
  
  getRules: (): Promise<Rule[]> => ipcRenderer.invoke('rules:get'),
  saveRules: (rules: Rule[]): Promise<Rule[]> => ipcRenderer.invoke('rules:save', rules),
  saveRule: (rule: Rule): Promise<Rule> => ipcRenderer.invoke('rules:save-one', rule),
  deleteRule: (id: string): Promise<boolean> => ipcRenderer.invoke('rules:delete', id),
  dryRun: (folderPath: string, rules?: Rule[]): Promise<any> => ipcRenderer.invoke('rules:dry-run', folderPath, rules),

  getJournal: (): Promise<any[]> => ipcRenderer.invoke('journal:get'),
  undoJournalEntry: (id: string): Promise<{ success: boolean; message: string }> => 
    ipcRenderer.invoke('journal:undo', id),
  undoRule: (ruleId: string): Promise<{ success: boolean; restored: number; failed: number; message: string }> =>
    ipcRenderer.invoke('journal:undo-rule', ruleId),

  getEngineStatus: (): Promise<{ isRunning: boolean; processedCount: number }> => 
    ipcRenderer.invoke('engine:status'),
  toggleEngine: (running: boolean): Promise<boolean> => 
    ipcRenderer.invoke('engine:toggle', running),

  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: Partial<AppSettings>): Promise<AppSettings> => 
    ipcRenderer.invoke('settings:save', settings),
    
  getPresets: (): Promise<Rule[]> => ipcRenderer.invoke('settings:get-presets')
});
