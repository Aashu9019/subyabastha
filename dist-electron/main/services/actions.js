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
                    // Windows forbids these characters in file names (e.g. a PDF author "Acme: Inc")
                    // ({counter:001} tokens are kept intact so their ':' survives until the number is filled in)
                    finalName = finalName
                        .split(/({counter:\d+})/i)
                        .map((part, i) => (i % 2 ? part : part.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')))
                        .join('');
                    finalName = applyCounter(finalName, dir);
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
                    if (!action.scriptPath || !action.scriptPath.trim())
                        break;
                    // {file} marks where the file path goes; without it the quoted path is appended.
                    // Windows file names cannot contain double quotes, so quoting the path is safe.
                    const quoted = `"${currentFilePath}"`;
                    const template = action.scriptPath.trim();
                    const cmd = /{file}/i.test(template)
                        ? template.replace(/"?{file}"?/gi, quoted)
                        : `${template} ${quoted}`;
                    (0, child_process_1.exec)(cmd, { timeout: 60000, windowsHide: true, cwd: path_1.default.dirname(currentFilePath) }, (err, stdout, stderr) => {
                        if (err)
                            console.error(`[${rule.name}] Command failed (${cmd}):`, stderr || err.message);
                        else if (stdout.trim())
                            console.log(`[${rule.name}] Command output:`, stdout.trim());
                    });
                    // Recorded so the same file does not re-run the command on every rescan
                    journal_1.journalService.logAction(rule.id, rule.name, currentFilePath, currentFilePath, 'script');
                    logs.push(`Ran command: ${cmd}`);
                    break;
                }
                case 'notify': {
                    const msg = action.notifyMessage
                        ? resolvePlaceholders(action.notifyMessage, meta)
                        : `Rule "${rule.name}" processed ${path_1.default.basename(currentFilePath)}`;
                    if (store_1.storeService.getSettings().showNotifications && electron_1.Notification.isSupported()) {
                        new electron_1.Notification({ title: 'Subyabastha Automation', body: msg }).show();
                    }
                    // A notify-only rule leaves the file in place; record it so rescans do not notify again
                    if (!producedPaths.length && !rule.actions.some(a => a.type === 'script')) {
                        journal_1.journalService.logAction(rule.id, rule.name, currentFilePath, currentFilePath, 'notify');
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
        .replace(/{pdf_author}/gi, safeSegment(meta.pdfAuthor || '') || 'UnknownAuthor');
    return result;
}
// {counter:001} becomes the lowest number (padded to the given width) whose file name is free in dir
function applyCounter(fileName, dir) {
    const match = fileName.match(/{counter:(\d+)}/i);
    if (!match)
        return fileName;
    const width = match[1].length;
    const start = parseInt(match[1], 10) || 1;
    for (let n = start; n < start + 100000; n++) {
        const candidate = fileName.replace(/{counter:\d+}/gi, String(n).padStart(width, '0'));
        if (!fs_1.default.existsSync(path_1.default.join(dir, candidate)))
            return candidate;
    }
    return fileName.replace(/{counter:\d+}/gi, String(Date.now()));
}
// Token values that come from file contents may contain characters not allowed in paths
function safeSegment(value) {
    return value.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
}
