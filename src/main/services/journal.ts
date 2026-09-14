import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type { JournalEntry, ActionType } from '../../types';
import trash from 'trash';

class JournalService {
  private journalPath: string;
  private entries: JournalEntry[] = [];

  constructor() {
    const userDataPath = app ? app.getPath('userData') : process.cwd();
    this.journalPath = path.join(userDataPath, 'journal.json');
    this.loadJournal();
  }

  private loadJournal() {
    try {
      if (fs.existsSync(this.journalPath)) {
        const raw = fs.readFileSync(this.journalPath, 'utf-8');
        this.entries = JSON.parse(raw);
      }
    } catch (err) {
      console.error('Failed to load journal:', err);
      this.entries = [];
    }
  }

  private saveJournal() {
    try {
      fs.writeFileSync(this.journalPath, JSON.stringify(this.entries, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save journal:', err);
    }
  }

  public getEntries(): JournalEntry[] {
    return [...this.entries].reverse(); // newest first
  }

  // True when this rule already produced the file, or the user undid this rule's action on it
  public isHandledByRule(ruleId: string, filePath: string): boolean {
    const target = path.resolve(filePath).toLowerCase();
    return this.entries.some(e => {
      if (e.ruleId !== ruleId) return false;
      if (!e.undone && e.newPath) return path.resolve(e.newPath).toLowerCase() === target;
      if (e.undone) return path.resolve(e.originalPath).toLowerCase() === target;
      return false;
    });
  }

  public logAction(
    ruleId: string,
    ruleName: string,
    originalPath: string,
    newPath: string | null,
    actionType: ActionType
  ): JournalEntry {
    const entry: JournalEntry = {
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

  public async undoEntry(id: string): Promise<{ success: boolean; message: string }> {
    const entry = this.entries.find(e => e.id === id);
    if (!entry) {
      return { success: false, message: 'Journal entry not found.' };
    }
    if (entry.undone) {
      return { success: false, message: 'Action has already been undone.' };
    }

    try {
      if (entry.actionType === 'move' || entry.actionType === 'rename') {
        if (!entry.newPath || !fs.existsSync(entry.newPath)) {
          return { success: false, message: `Moved file no longer exists at ${entry.newPath}` };
        }
        
        if (fs.existsSync(entry.originalPath)) {
          return { success: false, message: `A file already exists at ${entry.originalPath}` };
        }

        // Ensure destination folder exists
        const origDir = path.dirname(entry.originalPath);
        if (!fs.existsSync(origDir)) {
          fs.mkdirSync(origDir, { recursive: true });
        }

        try {
          fs.renameSync(entry.newPath, entry.originalPath);
        } catch (err: any) {
          // The move went to another drive: rename cannot cross drives, so copy back and delete
          if (err.code !== 'EXDEV') throw err;
          fs.copyFileSync(entry.newPath, entry.originalPath);
          fs.unlinkSync(entry.newPath);
        }
        entry.undone = true;
        this.saveJournal();
        return { success: true, message: `Restored file back to ${entry.originalPath}` };
      }

      if (entry.actionType === 'copy') {
        if (entry.newPath && fs.existsSync(entry.newPath)) {
          await trash([entry.newPath]);
        }
        entry.undone = true;
        this.saveJournal();
        return { success: true, message: `Removed copied file at ${entry.newPath}` };
      }

      return { success: false, message: `Undo not supported for action type: ${entry.actionType}` };
    } catch (err: any) {
      return { success: false, message: `Undo failed: ${err.message}` };
    }
  }
}

export interface BulkUndoResult {
  success: boolean;
  restored: number;
  failed: number;
  message: string;
}

// Undo every action a rule made, newest first so chained rename + move steps unwind in order
async function undoRule(service: JournalService, ruleId: string): Promise<BulkUndoResult> {
  const pending = service
    .getEntries()
    .filter(e => e.ruleId === ruleId && !e.undone && ['move', 'rename', 'copy'].includes(e.actionType));

  let restored = 0;
  const failures: string[] = [];
  for (const entry of pending) {
    const res = await service.undoEntry(entry.id);
    if (res.success) {
      restored++;
      if (entry.newPath) removeEmptyDirs(path.dirname(entry.newPath), 3);
    } else {
      failures.push(res.message);
    }
  }

  const message = failures.length
    ? `Restored ${restored} file(s), ${failures.length} could not be restored. First problem: ${failures[0]}`
    : `Restored ${restored} file(s).`;
  return { success: failures.length === 0, restored, failed: failures.length, message };
}

// Tidy up folders a rule created (e.g. Images/png/2026-09) once they are empty
function removeEmptyDirs(dir: string, levels: number) {
  for (let i = 0; i < levels; i++) {
    try {
      if (fs.readdirSync(dir).length > 0) return;
      fs.rmdirSync(dir);
      dir = path.dirname(dir);
    } catch {
      return;
    }
  }
}

export const journalService = new JournalService();
export const undoRuleActions = (ruleId: string) => undoRule(journalService, ruleId);
