import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import trash from 'trash';
import { Notification } from 'electron';
import { Rule, RuleAction } from '../../types';
import { FileMetadata } from './evaluator';
import { journalService } from './journal';

export async function executeActions(
  rule: Rule,
  meta: FileMetadata
): Promise<{ success: boolean; newPath?: string; logs: string[] }> {
  let currentFilePath = meta.filePath;
  const logs: string[] = [];

  for (const action of rule.actions) {
    try {
      switch (action.type) {
        case 'move': {
          if (!action.destination) break;
          const destDir = resolvePlaceholders(action.destination, meta);
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          const fileName = path.basename(currentFilePath);
          const targetPath = path.join(destDir, fileName);
          
          fs.renameSync(currentFilePath, targetPath);
          journalService.logAction(rule.id, rule.name, currentFilePath, targetPath, 'move');
          
          logs.push(`Moved file to ${targetPath}`);
          currentFilePath = targetPath;
          break;
        }

        case 'copy': {
          if (!action.destination) break;
          const destDir = resolvePlaceholders(action.destination, meta);
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          const fileName = path.basename(currentFilePath);
          const targetPath = path.join(destDir, fileName);
          
          fs.copyFileSync(currentFilePath, targetPath);
          journalService.logAction(rule.id, rule.name, currentFilePath, targetPath, 'copy');
          
          logs.push(`Copied file to ${targetPath}`);
          break;
        }

        case 'rename': {
          if (!action.pattern) break;
          const dir = path.dirname(currentFilePath);
          const newNameFormatted = resolvePlaceholders(action.pattern, meta);
          
          // Ensure correct extension
          let finalName = newNameFormatted;
          if (!path.extname(finalName)) {
            finalName += `.${meta.extension}`;
          }

          const targetPath = path.join(dir, finalName);
          fs.renameSync(currentFilePath, targetPath);
          journalService.logAction(rule.id, rule.name, currentFilePath, targetPath, 'rename');
          
          logs.push(`Renamed file to ${finalName}`);
          currentFilePath = targetPath;
          break;
        }

        case 'delete': {
          await trash([currentFilePath]);
          journalService.logAction(rule.id, rule.name, currentFilePath, null, 'delete');
          logs.push(`Moved file to Recycle Bin`);
          break;
        }

        case 'script': {
          if (!action.scriptPath) break;
          const cmd = `${action.scriptPath} "${currentFilePath}"`;
          exec(cmd, (err, stdout, stderr) => {
            if (err) console.error(`Script error:`, stderr);
            else console.log(`Script output:`, stdout);
          });
          logs.push(`Executed script: ${cmd}`);
          break;
        }

        case 'notify': {
          const msg = action.notifyMessage
            ? resolvePlaceholders(action.notifyMessage, meta)
            : `Rule "${rule.name}" processed ${path.basename(currentFilePath)}`;
            
          if (Notification.isSupported()) {
            new Notification({ title: 'FileSarathi Automation', body: msg }).show();
          }
          logs.push(`Notification sent: ${msg}`);
          break;
        }

        default:
          break;
      }
    } catch (err: any) {
      logs.push(`Action ${action.type} failed: ${err.message}`);
      return { success: false, newPath: currentFilePath, logs };
    }
  }

  return { success: true, newPath: currentFilePath, logs };
}

function resolvePlaceholders(template: string, meta: FileMetadata): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');

  let result = template
    .replace(/{name}/gi, meta.name)
    .replace(/{ext}/gi, meta.extension)
    .replace(/{year}/gi, year)
    .replace(/{month}/gi, month)
    .replace(/{day}/gi, day)
    .replace(/{date}/gi, `${year}-${month}-${day}`)
    .replace(/{extracted_date}/gi, meta.extractedDate || `${year}-${month}-${day}`)
    .replace(/{pdf_author}/gi, meta.pdfAuthor || 'UnknownAuthor');

  // Handle counter e.g. {counter:001}
  result = result.replace(/{counter:(\d+)}/gi, (_, pad) => {
    const randomNum = Math.floor(Math.random() * 100) + 1;
    return randomNum.toString().padStart(pad.length, '0');
  });

  return result;
}
