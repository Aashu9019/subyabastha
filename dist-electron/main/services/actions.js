"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeActions = executeActions;
exports.resolveFolderTokens = resolveFolderTokens;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const trash_1 = __importDefault(require("trash"));
const electron_1 = require("electron");
const journal_1 = require("./journal");
const store_1 = require("./store");
async function executeActions(rule, meta) {
    let currentFilePath = meta.filePath;
    const producedPaths = [];
    const logs = [];
    for (const action of rule.actions) {
        try {
            switch (action.type) {
                case 'move': {
                    if (!action.destination)
                        break;
                    const destDir = path_1.default.resolve(resolvePlaceholders(action.destination, meta));
                    // Already sorted into the destination: nothing to do
                    if (samePath(path_1.default.dirname(currentFilePath), destDir))
                        break;
                    fs_1.default.mkdirSync(destDir, { recursive: true });
                    const targetPath = uniquePath(path_1.default.join(destDir, path_1.default.basename(currentFilePath)));
                    moveFile(currentFilePath, targetPath);
                    journal_1.journalService.logAction(rule.id, rule.name, currentFilePath, targetPath, 'move');
                    logs.push(`Moved file to ${targetPath}`);
                    currentFilePath = targetPath;
                    producedPaths.push(targetPath);
                    break;
                }
                case 'copy': {
                    if (!action.destination)
                        break;
                    const destDir = path_1.default.resolve(resolvePlaceholders(action.destination, meta));
                    if (samePath(path_1.default.dirname(currentFilePath), destDir))
                        break;
                    fs_1.default.mkdirSync(destDir, { recursive: true });
                    const plainTarget = path_1.default.join(destDir, path_1.default.basename(currentFilePath));
                    // Skip when an identical copy is already there
                    if (fs_1.default.existsSync(plainTarget) && fs_1.default.statSync(plainTarget).size === fs_1.default.statSync(currentFilePath).size) {
                        break;
                    }
                    const targetPath = uniquePath(plainTarget);
                    fs_1.default.copyFileSync(currentFilePath, targetPath);
                    journal_1.journalService.logAction(rule.id, rule.name, currentFilePath, targetPath, 'copy');
                    logs.push(`Copied file to ${targetPath}`);
                    producedPaths.push(targetPath);
                    break;
                }
                case 'rename': {
                    if (!action.pattern)
                        break;
                    const dir = path_1.default.dirname(currentFilePath);
                    let finalName = resolvePlaceholders(action.pattern, meta);
                    // Ensure correct extension
                    if (!path_1.default.extname(finalName)) {
                        finalName += `.${meta.extension}`;
                    }
                    if (samePath(path_1.default.join(dir, finalName), currentFilePath))
                        break;
                    const targetPath = uniquePath(path_1.default.join(dir, finalName));
                    fs_1.default.renameSync(currentFilePath, targetPath);
                    journal_1.journalService.logAction(rule.id, rule.name, currentFilePath, targetPath, 'rename');
                    logs.push(`Renamed file to ${path_1.default.basename(targetPath)}`);
                    currentFilePath = targetPath;
                    producedPaths.push(targetPath);
                    break;
                }
                case 'delete': {
                    await (0, trash_1.default)([currentFilePath]);
                    journal_1.journalService.logAction(rule.id, rule.name, currentFilePath, null, 'delete');
                    logs.push(`Moved file to Recycle Bin`);
                    return { success: true, newPath: undefined, producedPaths, logs };
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
                    if (store_1.storeService.getSettings().showNotifications && electron_1.Notification.isSupported()) {
                        new electron_1.Notification({ title: 'Subyabastha Automation', body: msg }).show();
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
            return { success: false, newPath: currentFilePath, producedPaths, logs };
        }
    }
    return { success: true, newPath: currentFilePath, producedPaths, logs };
}
function samePath(a, b) {
    return path_1.default.resolve(a).toLowerCase() === path_1.default.resolve(b).toLowerCase();
}
// Never overwrite an existing file: "report.pdf" becomes "report (1).pdf"
function uniquePath(targetPath) {
    if (!fs_1.default.existsSync(targetPath))
        return targetPath;
    const { dir, name, ext } = path_1.default.parse(targetPath);
    let i = 1;
    while (fs_1.default.existsSync(path_1.default.join(dir, `${name} (${i})${ext}`)))
        i++;
    return path_1.default.join(dir, `${name} (${i})${ext}`);
}
// renameSync fails across drives (EXDEV), so fall back to copy + delete
function moveFile(from, to) {
    try {
        fs_1.default.renameSync(from, to);
    }
    catch (err) {
        if (err.code !== 'EXDEV')
            throw err;
        fs_1.default.copyFileSync(from, to);
        fs_1.default.unlinkSync(from);
    }
}
function resolveFolderTokens(template) {
    return template
        .replace(/{userDocs}/gi, electron_1.app.getPath('documents'))
        .replace(/{userPictures}/gi, electron_1.app.getPath('pictures'))
        .replace(/{downloads}/gi, electron_1.app.getPath('downloads'))
        .replace(/{desktop}/gi, electron_1.app.getPath('desktop'));
}
function resolvePlaceholders(template, meta) {
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
        .replace(/{pdf_author}/gi, meta.pdfAuthor || 'UnknownAuthor');
    // Handle counter e.g. {counter:001}
    result = result.replace(/{counter:(\d+)}/gi, (_, pad) => {
        const randomNum = Math.floor(Math.random() * 100) + 1;
        return randomNum.toString().padStart(pad.length, '0');
    });
    return result;
}
