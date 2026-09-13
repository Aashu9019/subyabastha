"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeActions = executeActions;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const trash_1 = __importDefault(require("trash"));
const electron_1 = require("electron");
const journal_1 = require("./journal");
async function executeActions(rule, meta) {
    let currentFilePath = meta.filePath;
    const logs = [];
    for (const action of rule.actions) {
        try {
            switch (action.type) {
                case 'move': {
                    if (!action.destination)
                        break;
                    const destDir = resolvePlaceholders(action.destination, meta);
                    if (!fs_1.default.existsSync(destDir)) {
                        fs_1.default.mkdirSync(destDir, { recursive: true });
                    }
                    const fileName = path_1.default.basename(currentFilePath);
                    const targetPath = path_1.default.join(destDir, fileName);
                    fs_1.default.renameSync(currentFilePath, targetPath);
                    journal_1.journalService.logAction(rule.id, rule.name, currentFilePath, targetPath, 'move');
                    logs.push(`Moved file to ${targetPath}`);
                    currentFilePath = targetPath;
                    break;
                }
                case 'copy': {
                    if (!action.destination)
                        break;
                    const destDir = resolvePlaceholders(action.destination, meta);
                    if (!fs_1.default.existsSync(destDir)) {
                        fs_1.default.mkdirSync(destDir, { recursive: true });
                    }
                    const fileName = path_1.default.basename(currentFilePath);
                    const targetPath = path_1.default.join(destDir, fileName);
                    fs_1.default.copyFileSync(currentFilePath, targetPath);
                    journal_1.journalService.logAction(rule.id, rule.name, currentFilePath, targetPath, 'copy');
                    logs.push(`Copied file to ${targetPath}`);
                    break;
                }
                case 'rename': {
                    if (!action.pattern)
                        break;
                    const dir = path_1.default.dirname(currentFilePath);
                    const newNameFormatted = resolvePlaceholders(action.pattern, meta);
                    // Ensure correct extension
                    let finalName = newNameFormatted;
                    if (!path_1.default.extname(finalName)) {
                        finalName += `.${meta.extension}`;
                    }
                    const targetPath = path_1.default.join(dir, finalName);
                    fs_1.default.renameSync(currentFilePath, targetPath);
                    journal_1.journalService.logAction(rule.id, rule.name, currentFilePath, targetPath, 'rename');
                    logs.push(`Renamed file to ${finalName}`);
                    currentFilePath = targetPath;
                    break;
                }
                case 'delete': {
                    await (0, trash_1.default)([currentFilePath]);
                    journal_1.journalService.logAction(rule.id, rule.name, currentFilePath, null, 'delete');
                    logs.push(`Moved file to Recycle Bin`);
                    break;
                }
                case 'script': {
                    if (!action.scriptPath)
                        break;
                    const cmd = `${action.scriptPath} "${currentFilePath}"`;
                    (0, child_process_1.exec)(cmd, (err, stdout, stderr) => {
                        if (err)
                            console.error(`Script error:`, stderr);
                        else
                            console.log(`Script output:`, stdout);
                    });
                    logs.push(`Executed script: ${cmd}`);
                    break;
                }
                case 'notify': {
                    const msg = action.notifyMessage
                        ? resolvePlaceholders(action.notifyMessage, meta)
                        : `Rule "${rule.name}" processed ${path_1.default.basename(currentFilePath)}`;
                    if (electron_1.Notification.isSupported()) {
                        new electron_1.Notification({ title: 'FileSarathi Automation', body: msg }).show();
                    }
                    logs.push(`Notification sent: ${msg}`);
                    break;
                }
                default:
                    break;
            }
        }
        catch (err) {
            logs.push(`Action ${action.type} failed: ${err.message}`);
            return { success: false, newPath: currentFilePath, logs };
        }
    }
    return { success: true, newPath: currentFilePath, logs };
}
function resolvePlaceholders(template, meta) {
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
