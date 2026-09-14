"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.undoRuleActions = exports.journalService = void 0;
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
                if (fs_1.default.existsSync(entry.originalPath)) {
                    return { success: false, message: `A file already exists at ${entry.originalPath}` };
                }
                // Ensure destination folder exists
                const origDir = path_1.default.dirname(entry.originalPath);
                if (!fs_1.default.existsSync(origDir)) {
                    fs_1.default.mkdirSync(origDir, { recursive: true });
                }
                try {
                    fs_1.default.renameSync(entry.newPath, entry.originalPath);
                }
                catch (err) {
                    // The move went to another drive: rename cannot cross drives, so copy back and delete
                    if (err.code !== 'EXDEV')
                        throw err;
                    fs_1.default.copyFileSync(entry.newPath, entry.originalPath);
                    fs_1.default.unlinkSync(entry.newPath);
                }
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
// Undo every action a rule made, newest first so chained rename + move steps unwind in order
async function undoRule(service, ruleId) {
    const pending = service
        .getEntries()
        .filter(e => e.ruleId === ruleId && !e.undone && ['move', 'rename', 'copy'].includes(e.actionType));
    let restored = 0;
    const failures = [];
    for (const entry of pending) {
        const res = await service.undoEntry(entry.id);
        if (res.success) {
            restored++;
            if (entry.newPath)
                removeEmptyDirs(path_1.default.dirname(entry.newPath), 3);
        }
        else {
            failures.push(res.message);
        }
    }
    const message = failures.length
        ? `Restored ${restored} file(s), ${failures.length} could not be restored. First problem: ${failures[0]}`
        : `Restored ${restored} file(s).`;
    return { success: failures.length === 0, restored, failed: failures.length, message };
}
// Tidy up folders a rule created (e.g. Images/png/2026-09) once they are empty
function removeEmptyDirs(dir, levels) {
    for (let i = 0; i < levels; i++) {
        try {
            if (fs_1.default.readdirSync(dir).length > 0)
                return;
            fs_1.default.rmdirSync(dir);
            dir = path_1.default.dirname(dir);
        }
        catch {
            return;
        }
    }
}
exports.journalService = new JournalService();
const undoRuleActions = (ruleId) => undoRule(exports.journalService, ruleId);
exports.undoRuleActions = undoRuleActions;
