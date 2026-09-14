import fs from 'fs';
import path from 'path';
import chokidar, { FSWatcher } from 'chokidar';
import { extractFileMetadata, evaluateRule } from './evaluator';
import { executeActions } from './actions';
import { storeService } from './store';
import { journalService } from './journal';
import type { Rule, DryRunResult } from '../../types';

// Browser downloads still in progress
const TEMP_EXTENSIONS = ['.crdownload', '.part', '.tmp', '.download', '.partial'];

class WatcherEngine {
  private watchers: Map<string, FSWatcher> = new Map();
  private isPaused: boolean = false;
  private processedCount: number = 0;
  private pendingQueue: Set<string> = new Set();
  // Files the engine just created, so their own 'add' events are ignored
  private recentlyProduced: Set<string> = new Set();

  public startEngine() {
    this.isPaused = false;
    this.reloadWatchers();
  }

  public pauseEngine() {
    this.isPaused = true;
    this.stopAllWatchers();
  }

  public isRunning(): boolean {
    return !this.isPaused;
  }

  public getProcessedCount(): number {
    return this.processedCount;
  }

  public reloadWatchers() {
    this.stopAllWatchers();
    if (this.isPaused) return;

    const rules = storeService.getRules().filter(r => r.enabled);
    const folderMap = new Map<string, Rule[]>();

    for (const rule of rules) {
      for (const folder of rule.monitoredFolders) {
        if (!fs.existsSync(folder)) continue;
        const existing = folderMap.get(folder) || [];
        existing.push(rule);
        folderMap.set(folder, existing);
      }
    }

    for (const [folder, assignedRules] of folderMap.entries()) {
      try {
        const watcher = chokidar.watch(folder, {
          persistent: true,
          // Emit 'add' for files already in the folder so they get sorted too
          ignoreInitial: false,
          depth: 0,
          awaitWriteFinish: {
            stabilityThreshold: 1500,
            pollInterval: 200
          }
        });

        watcher.on('add', (filePath) => this.handleFileEvent(filePath, assignedRules));
        watcher.on('error', (err) => console.error(`Watcher error in ${folder}:`, err));

        this.watchers.set(folder, watcher);
      } catch (err) {
        console.error(`Failed to watch folder ${folder}:`, err);
      }
    }
  }

  private stopAllWatchers() {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
  }

  private markProduced(filePath: string) {
    const key = filePath.toLowerCase();
    this.recentlyProduced.add(key);
    setTimeout(() => this.recentlyProduced.delete(key), 15000);
  }

  private async handleFileEvent(filePath: string, rules: Rule[]) {
    if (this.isPaused) return;
    if (TEMP_EXTENSIONS.includes(path.extname(filePath).toLowerCase())) return;
    if (this.recentlyProduced.has(filePath.toLowerCase())) return;
    if (this.pendingQueue.has(filePath)) return;
    if (!fs.existsSync(filePath)) return;

    this.pendingQueue.add(filePath);

    try {
      // Small delay to ensure Windows file lock is released
      await new Promise(res => setTimeout(res, 500));
      if (!fs.existsSync(filePath)) return;

      const meta = await extractFileMetadata(filePath);

      for (const rule of rules) {
        if (journalService.isHandledByRule(rule.id, filePath)) continue;

        const matches = await evaluateRule(rule, meta);
        if (!matches) continue;

        const result = await executeActions(rule, meta);
        result.producedPaths.forEach(p => this.markProduced(p));
        if (result.logs.length > 0) console.log(`[${rule.name}]`, result.logs.join(' | '));

        if (result.success && result.producedPaths.length > 0) {
          this.processedCount++;
          storeService.incrementRuleStat(rule.id);
        }
        // If file was moved, renamed or deleted, stop processing remaining rules for this file
        if (result.newPath !== filePath) break;
      }
    } catch (err) {
      console.error(`Error processing file ${filePath}:`, err);
    } finally {
      this.pendingQueue.delete(filePath);
    }
  }

  public async dryRunFolder(folderPath: string, rules?: Rule[]): Promise<DryRunResult[]> {
    if (!fs.existsSync(folderPath)) return [];

    const targetRules = rules || storeService.getRules().filter(r => r.enabled);
    const results: DryRunResult[] = [];

    try {
      const files = fs.readdirSync(folderPath);
      for (const file of files) {
        const fullPath = path.join(folderPath, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) continue;

        const meta = await extractFileMetadata(fullPath);
        const matchedRules: string[] = [];
        const proposedActions: { type: any; details: string }[] = [];

        for (const rule of targetRules) {
          const matches = await evaluateRule(rule, meta);
          if (matches) {
            matchedRules.push(rule.name);
            for (const act of rule.actions) {
              proposedActions.push({
                type: act.type,
                details: act.destination
                  ? `Target Folder: ${act.destination}`
                  : act.pattern
                  ? `Rename Pattern: ${act.pattern}`
                  : act.type
              });
            }
          }
        }

        if (matchedRules.length > 0) {
          results.push({
            filePath: fullPath,
            matchedRules,
            proposedActions
          });
        }
      }
    } catch (err) {
      console.error(`Dry run failed for folder ${folderPath}:`, err);
    }

    return results;
  }
}

export const watcherEngine = new WatcherEngine();
