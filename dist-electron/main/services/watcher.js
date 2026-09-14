"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.watcherEngine = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const chokidar_1 = __importDefault(require("chokidar"));
const evaluator_1 = require("./evaluator");
const actions_1 = require("./actions");
const store_1 = require("./store");
const journal_1 = require("./journal");
// Browser downloads still in progress
const TEMP_EXTENSIONS = ['.crdownload', '.part', '.tmp', '.download', '.partial'];
class WatcherEngine {
    watchers = new Map();
    isPaused = false;
    processedCount = 0;
    pendingQueue = new Set();
    // Files the engine just created, so their own 'add' events are ignored
    recentlyProduced = new Set();
    startEngine() {
        this.isPaused = false;
        this.reloadWatchers();
    }
    pauseEngine() {
        this.isPaused = true;
        this.stopAllWatchers();
    }
    isRunning() {
        return !this.isPaused;
    }
    getProcessedCount() {
        return this.processedCount;
    }
    reloadWatchers() {
        this.stopAllWatchers();
        if (this.isPaused)
            return;
        const rules = store_1.storeService.getRules().filter(r => r.enabled);
        const folderMap = new Map();
        for (const rule of rules) {
            for (const folder of rule.monitoredFolders) {
                if (!fs_1.default.existsSync(folder))
                    continue;
                const existing = folderMap.get(folder) || [];
                existing.push(rule);
                folderMap.set(folder, existing);
            }
        }
        for (const [folder, assignedRules] of folderMap.entries()) {
            try {
                const watcher = chokidar_1.default.watch(folder, {
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
            }
            catch (err) {
                console.error(`Failed to watch folder ${folder}:`, err);
            }
        }
    }
    stopAllWatchers() {
        for (const watcher of this.watchers.values()) {
            watcher.close();
        }
        this.watchers.clear();
    }
    markProduced(filePath) {
        const key = filePath.toLowerCase();
        this.recentlyProduced.add(key);
        setTimeout(() => this.recentlyProduced.delete(key), 15000);
    }
    async handleFileEvent(filePath, rules) {
        if (this.isPaused)
            return;
        if (TEMP_EXTENSIONS.includes(path_1.default.extname(filePath).toLowerCase()))
            return;
        if (this.recentlyProduced.has(filePath.toLowerCase()))
            return;
        if (this.pendingQueue.has(filePath))
            return;
        if (!fs_1.default.existsSync(filePath))
            return;
        this.pendingQueue.add(filePath);
        try {
            // Small delay to ensure Windows file lock is released
            await new Promise(res => setTimeout(res, 500));
            if (!fs_1.default.existsSync(filePath))
                return;
            const meta = await (0, evaluator_1.extractFileMetadata)(filePath);
            for (const rule of rules) {
                if (journal_1.journalService.isHandledByRule(rule.id, filePath))
                    continue;
                const matches = await (0, evaluator_1.evaluateRule)(rule, meta);
                if (!matches)
                    continue;
                const result = await (0, actions_1.executeActions)(rule, meta);
                result.producedPaths.forEach(p => this.markProduced(p));
                if (result.logs.length > 0)
                    console.log(`[${rule.name}]`, result.logs.join(' | '));
                if (result.success && result.logs.length > 0) {
                    this.processedCount++;
                    store_1.storeService.incrementRuleStat(rule.id);
                }
                // If file was moved, renamed or deleted, stop processing remaining rules for this file
                if (result.newPath !== filePath)
                    break;
            }
        }
        catch (err) {
            console.error(`Error processing file ${filePath}:`, err);
        }
        finally {
            this.pendingQueue.delete(filePath);
        }
    }
    async dryRunFolder(folderPath, rules) {
        if (!fs_1.default.existsSync(folderPath))
            return [];
        const targetRules = rules || store_1.storeService.getRules().filter(r => r.enabled);
        const results = [];
        try {
            const files = fs_1.default.readdirSync(folderPath);
            for (const file of files) {
                const fullPath = path_1.default.join(folderPath, file);
                const stat = fs_1.default.statSync(fullPath);
                if (stat.isDirectory())
                    continue;
                const meta = await (0, evaluator_1.extractFileMetadata)(fullPath);
                const matchedRules = [];
                const proposedActions = [];
                for (const rule of targetRules) {
                    const matches = await (0, evaluator_1.evaluateRule)(rule, meta);
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
        }
        catch (err) {
            console.error(`Dry run failed for folder ${folderPath}:`, err);
        }
        return results;
    }
}
exports.watcherEngine = new WatcherEngine();
