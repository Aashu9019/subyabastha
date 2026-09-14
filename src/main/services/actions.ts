import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import trash from 'trash';
import { app, Notification } from 'electron';
import type { Rule } from '../../types';
import type { FileMetadata } from './evaluator';
import { journalService } from './journal';
import { storeService } from './store';

export async function executeActions(
  rule: Rule,
  meta: FileMetadata
): Promise<{ success: boolean; newPath?: string; producedPaths: string[]; logs: string[] }> {
  let currentFilePath = meta.filePath;
  const producedPaths: string[] = [];
  const logs: string[] = [];

  for (const action of rule.actions) {
    try {
      switch (action.type) {
        case 'move': {
          if (!action.destination) break;
          const destDir = path.resolve(resolvePlaceholders(action.destination, meta));
          // Already sorted into the destination: nothing to do
          if (samePath(path.dirname(currentFilePath), destDir)) break;

          fs.mkdirSync(destDir, { recursive: true });
          const targetPath = uniquePath(path.join(destDir, path.basename(currentFilePath)));

          moveFile(currentFilePath, targetPath);
          journalService.logAction(rule.id, rule.name, currentFilePath, targetPath, 'move');

          logs.push(`Moved file to ${targetPath}`);
          currentFilePath = targetPath;
          producedPaths.push(targetPath);
          break;
        }

        case 'copy': {
          if (!action.destination) break;
          const destDir = path.resolve(resolvePlaceholders(action.destination, meta));
          if (samePath(path.dirname(currentFilePath), destDir)) break;

          fs.mkdirSync(destDir, { recursive: true });
          const plainTarget = path.join(destDir, path.basename(currentFilePath));
          // Skip when an identical copy is already there
          if (fs.existsSync(plainTarget) && fs.statSync(plainTarget).size === fs.statSync(currentFilePath).size) {
            break;
          }
          const targetPath = uniquePath(plainTarget);

          fs.copyFileSync(currentFilePath, targetPath);
          journalService.logAction(rule.id, rule.name, currentFilePath, targetPath, 'copy');

          logs.push(`Copied file to ${targetPath}`);
          producedPaths.push(targetPath);
          break;
        }

        case 'rename': {
          if (!action.pattern) break;
          const dir = path.dirname(currentFilePath);
          let finalName = resolvePlaceholders(action.pattern, meta);

          // Ensure correct extension
          if (!path.extname(finalName)) {
            finalName += `.${meta.extension}`;
          }

          // Windows forbids these characters in file names (e.g. a PDF author "Acme: Inc")
          // ({counter:001} tokens are kept intact so their ':' survives until the number is filled in)
          finalName = finalName
            .split(/({counter:\d+})/i)
            .map((part, i) => (i % 2 ? part : part.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')))
            .join('');
          finalName = applyCounter(finalName, dir);

          if (samePath(path.join(dir, finalName), currentFilePath)) break;
          const targetPath = uniquePath(path.join(dir, finalName));
          fs.renameSync(currentFilePath, targetPath);
          journalService.logAction(rule.id, rule.name, currentFilePath, targetPath, 'rename');

          logs.push(`Renamed file to ${path.basename(targetPath)}`);
          currentFilePath = targetPath;
          producedPaths.push(targetPath);
          break;
        }

        case 'delete': {
          await trash([currentFilePath]);
          journalService.logAction(rule.id, rule.name, currentFilePath, null, 'delete');
          logs.push(`Moved file to Recycle Bin`);
          return { success: true, newPath: undefined, producedPaths, logs };
        }

        case 'script': {
          if (!action.scriptPath || !action.scriptPath.trim()) break;
          // {file} marks where the file path goes; without it the quoted path is appended.
          // Windows file names cannot contain double quotes, so quoting the path is safe.
          const quoted = `"${currentFilePath}"`;
          const template = action.scriptPath.trim();
          const cmd = /{file}/i.test(template)
            ? template.replace(/"?{file}"?/gi, quoted)
            : `${template} ${quoted}`;

          exec(cmd, { timeout: 60000, windowsHide: true, cwd: path.dirname(currentFilePath) }, (err, stdout, stderr) => {
            if (err) console.error(`[${rule.name}] Command failed (${cmd}):`, stderr || err.message);
            else if (stdout.trim()) console.log(`[${rule.name}] Command output:`, stdout.trim());
          });
          // Recorded so the same file does not re-run the command on every rescan
          journalService.logAction(rule.id, rule.name, currentFilePath, currentFilePath, 'script');
          logs.push(`Ran command: ${cmd}`);
          break;
        }

        case 'notify': {
          const msg = action.notifyMessage
            ? resolvePlaceholders(action.notifyMessage, meta)
            : `Rule "${rule.name}" processed ${path.basename(currentFilePath)}`;

          if (storeService.getSettings().showNotifications && Notification.isSupported()) {
            new Notification({ title: 'Subyabastha Automation', body: msg }).show();
          }
          // A notify-only rule leaves the file in place; record it so rescans do not notify again
          if (!producedPaths.length && !rule.actions.some(a => a.type === 'script')) {
            journalService.logAction(rule.id, rule.name, currentFilePath, currentFilePath, 'notify');
          }
          logs.push(`Notification sent: ${msg}`);
          break;
        }

        default:
          break;
      }
    } catch (err: any) {
      logs.push(`Action ${action.type} failed: ${err.message}`);
      return { success: false, newPath: currentFilePath, producedPaths, logs };
    }
  }

  return { success: true, newPath: currentFilePath, producedPaths, logs };
}

function samePath(a: string, b: string): boolean {
  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
}

// Never overwrite an existing file: "report.pdf" becomes "report (1).pdf"
function uniquePath(targetPath: string): string {
  if (!fs.existsSync(targetPath)) return targetPath;
  const { dir, name, ext } = path.parse(targetPath);
  let i = 1;
  while (fs.existsSync(path.join(dir, `${name} (${i})${ext}`))) i++;
  return path.join(dir, `${name} (${i})${ext}`);
}

// renameSync fails across drives (EXDEV), so fall back to copy + delete
function moveFile(from: string, to: string) {
  try {
    fs.renameSync(from, to);
  } catch (err: any) {
    if (err.code !== 'EXDEV') throw err;
    fs.copyFileSync(from, to);
    fs.unlinkSync(from);
  }
}

export function resolveFolderTokens(template: string): string {
  return template
    .replace(/{userDocs}/gi, app.getPath('documents'))
    .replace(/{userPictures}/gi, app.getPath('pictures'))
    .replace(/{downloads}/gi, app.getPath('downloads'))
    .replace(/{desktop}/gi, app.getPath('desktop'));
}

function resolvePlaceholders(template: string, meta: FileMetadata): string {
  // Date tokens use when the file arrived (created on this disk), so older downloads land in their own month
  const created = meta.createdDate instanceof Date && !isNaN(meta.createdDate.getTime()) ? meta.createdDate : null;
  const now = created || new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');

  let result = resolveFolderTokens(template)
    .replace(/{name}/gi, meta.name)
    .replace(/{ext}/gi, meta.extension)
    .replace(/{year}/gi, year)
    .replace(/{month}/gi, month)
    .replace(/{day}/gi, day)
    .replace(/{date}/gi, `${year}-${month}-${day}`)
    .replace(/{extracted_date}/gi, meta.extractedDate || `${year}-${month}-${day}`)
    .replace(/{pdf_author}/gi, safeSegment(meta.pdfAuthor || '') || 'UnknownAuthor');

  return result;
}

// {counter:001} becomes the lowest number (padded to the given width) whose file name is free in dir
function applyCounter(fileName: string, dir: string): string {
  const match = fileName.match(/{counter:(\d+)}/i);
  if (!match) return fileName;
  const width = match[1].length;
  const start = parseInt(match[1], 10) || 1;
  for (let n = start; n < start + 100000; n++) {
    const candidate = fileName.replace(/{counter:\d+}/gi, String(n).padStart(width, '0'));
    if (!fs.existsSync(path.join(dir, candidate))) return candidate;
  }
  return fileName.replace(/{counter:\d+}/gi, String(Date.now()));
}

// Token values that come from file contents may contain characters not allowed in paths
function safeSegment(value: string): string {
  return value.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
}
