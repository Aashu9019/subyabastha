"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.journalService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
const trash_1 = __importDefault(require("trash"));
class JournalService {
    journalPath;
    entries = [];
    constructor() {
        const userDataPath = electron_1.app ? electron_1.app.getPath('userData') : process.cwd();
        this.journalPath = path_1.default.join(userDataPath, 'journal.json');
        this.loadJournal();
    }
    loadJournal() {
        try {
            if (fs_1.default.existsSync(this.journalPath)) {
                const raw = fs_1.default.readFileSync(this.journalPath, 'utf-8');
                this.entries = JSON.parse(raw);
            }
        }
        catch (err) {
            console.error('Failed to load journal:', err);
            this.entries = [];
        }
    }
    saveJournal() {
        try {
            fs_1.default.writeFileSync(this.journalPath, JSON.stringify(this.entries, null, 2), 'utf-8');
        }
        catch (err) {
            console.error('Failed to save journal:', err);
        }
    }
    getEntries() {
        return [...this.entries].reverse(); // newest first
    }
    // True when this rule already produced the file, or the user undid this rule's action on it
    isHandledByRule(ruleId, filePath) {
        const target = path_1.default.resolve(filePath).toLowerCase();
        return this.entries.some(e => {
            if (e.ruleId !== ruleId)
                return false;
            if (!e.undone && e.newPath)
                return path_1.default.resolve(e.newPath).toLowerCase() === target;
            if (e.undone)
                return path_1.default.resolve(e.originalPath).toLowerCase() === target;
            return false;
        });
    }
    logAction(ruleId, ruleName, originalPath, newPath, actionType) {
        const entry = {
            id: 'jnl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            timestamp: new Date().toISOString(),
            ruleId,
            ruleName,
            originalPath,
            newPath,
            actionType,
            undone: false
        };
        this.entries.push(entry);
        // Keep max 500 recent journal entries
        if (this.entries.length > 500) {
            this.entries = this.entries.slice(-500);
        }
        this.saveJournal();
        return entry;
    }
    async undoEntry(id) {
        const entry = this.entries.find(e => e.id === id);
        if (!entry) {
            return { success: false, message: 'Journal entry not found.' };
        }
        if (entry.undone) {
            return { success: false, message: 'Action has already been undone.' };
        }
        try {
            if (entry.actionType === 'move' || entry.actionType === 'rename') {
                if (!entry.newPath || !fs_1.default.existsSync(entry.newPath)) {
                    return { success: false, message: `Moved file no longer exists at ${entry.newPath}` };
                }
                // Ensure destination folder exists
                const origDir = path_1.default.dirname(entry.originalPath);
                if (!fs_1.default.existsSync(origDir)) {
                    fs_1.default.mkdirSync(origDir, { recursive: true });
                }
                fs_1.default.renameSync(entry.newPath, entry.originalPath);
                entry.undone = true;
                this.saveJournal();
                return { success: true, message: `Restored file back to ${entry.originalPath}` };
            }
            if (entry.actionType === 'copy') {
                if (entry.newPath && fs_1.default.existsSync(entry.newPath)) {
                    await (0, trash_1.default)([entry.newPath]);
                }
                entry.undone = true;
                this.saveJournal();
                return { success: true, message: `Removed copied file at ${entry.newPath}` };
            }
            return { success: false, message: `Undo not supported for action type: ${entry.actionType}` };
        }
        catch (err) {
            return { success: false, message: `Undo failed: ${err.message}` };
        }
    }
}
exports.journalService = new JournalService();
