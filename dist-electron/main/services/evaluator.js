"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractFileMetadata = extractFileMetadata;
exports.evaluateRule = evaluateRule;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const { PDFParse } = require('pdf-parse');
async function extractFileMetadata(filePath) {
    const stats = fs_1.default.statSync(filePath);
    const parsedPath = path_1.default.parse(filePath);
    const ext = parsedPath.ext.replace('.', '').toLowerCase();
    const meta = {
        filePath,
        name: parsedPath.name,
        extension: ext,
        size: stats.size,
        createdDate: stats.birthtime,
        modifiedDate: stats.mtime
    };
    // Text content extraction for text-based formats
    const textExtensions = ['txt', 'md', 'csv', 'json', 'log', 'xml', 'html', 'js', 'ts', 'py'];
    if (textExtensions.includes(ext) && stats.size < 5 * 1024 * 1024) { // max 5MB text
        try {
            meta.textContent = fs_1.default.readFileSync(filePath, 'utf-8');
            meta.extractedDate = findDateInText(meta.textContent);
        }
        catch (err) {
            console.warn(`Could not read text file ${filePath}:`, err);
        }
    }
    // PDF content & metadata extraction
    if (ext === 'pdf' && stats.size < 20 * 1024 * 1024) { // max 20MB PDF
        // pdf-parse v2 API: a PDFParse instance per document, destroyed after use
        const parser = new PDFParse({ data: fs_1.default.readFileSync(filePath) });
        try {
            const textResult = await parser.getText();
            const infoResult = await parser.getInfo();
            meta.pdfContent = textResult.text;
            meta.pdfAuthor = infoResult.info?.Author || infoResult.info?.Creator || '';
            meta.extractedDate = findDateInText(textResult.text);
        }
        catch (err) {
            console.warn(`Could not parse PDF file ${filePath}:`, err);
        }
        finally {
            await parser.destroy().catch(() => { });
        }
    }
    return meta;
}
function findDateInText(text) {
    if (!text)
        return undefined;
    // Standard YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = text.match(/\b(20\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b/);
    if (isoMatch)
        return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    // DD-MM-YYYY or DD/MM/YYYY
    const euMatch = text.match(/\b(0[1-9]|[12]\d|3[01])[-/.](0[1-9]|1[0-2])[-/.](20\d{2})\b/);
    if (euMatch)
        return `${euMatch[3]}-${euMatch[2]}-${euMatch[1]}`;
    return undefined;
}
async function evaluateRule(rule, meta) {
    if (!rule.enabled)
        return false;
    if (rule.conditions.length === 0)
        return false;
    const results = [];
    for (const condition of rule.conditions) {
        const matched = evaluateCondition(condition, meta);
        results.push(matched);
    }
    if (rule.matchType === 'ALL') {
        return results.every(Boolean);
    }
    else {
        return results.some(Boolean);
    }
}
function evaluateCondition(condition, meta) {
    let targetValue;
    switch (condition.field) {
        case 'name':
            targetValue = meta.name;
            break;
        case 'extension':
            targetValue = meta.extension;
            break;
        case 'size':
            targetValue = meta.size;
            break;
        case 'createdDate':
            targetValue = meta.createdDate.toISOString();
            break;
        case 'modifiedDate':
            targetValue = meta.modifiedDate.toISOString();
            break;
        case 'textContent':
            targetValue = meta.textContent;
            break;
        case 'pdfContent':
            targetValue = meta.pdfContent;
            break;
        case 'pdfAuthor':
            targetValue = meta.pdfAuthor;
            break;
        default:
            return false;
    }
    if (targetValue === undefined || targetValue === null)
        return false;
    // Extensions may be typed as ".png" or "png"
    const normalize = (v) => {
        const s = v.trim().toLowerCase();
        return condition.field === 'extension' ? s.replace(/^\./, '') : s;
    };
    const condVal = normalize(condition.value);
    const stringVal = String(targetValue).toLowerCase();
    if (condition.field === 'createdDate' || condition.field === 'modifiedDate') {
        const fileDate = condition.field === 'createdDate' ? meta.createdDate : meta.modifiedDate;
        const dateResult = compareDate(condition, fileDate);
        if (dateResult !== undefined)
            return dateResult;
    }
    // An extension value like "zip, rar, 7z" is always a list, whichever of equals / contains / in was picked
    const listValues = condition.value.split(',').map(normalize).filter(Boolean);
    const isExtensionList = condition.field === 'extension' && listValues.length > 1;
    if (isExtensionList && ['equals', 'contains', 'in'].includes(condition.operator)) {
        return listValues.includes(stringVal);
    }
    switch (condition.operator) {
        case 'equals':
            return stringVal === condVal;
        case 'in':
            // Comma-separated list, e.g. "png, jpg, webp"
            return condition.value.split(',').map(normalize).filter(Boolean).includes(stringVal);
        case 'contains':
            return stringVal.includes(condVal);
        case 'starts_with':
            return stringVal.startsWith(condVal);
        case 'ends_with':
            return stringVal.endsWith(condVal);
        case 'regex':
            try {
                const regex = new RegExp(condition.value, 'i');
                return regex.test(String(targetValue));
            }
            catch {
                return false;
            }
        case 'greater_than':
            if (condition.field === 'size') {
                const bytes = parseSizeToBytes(condition.value);
                return typeof targetValue === 'number' && targetValue > bytes;
            }
            return false;
        case 'less_than':
            if (condition.field === 'size') {
                const bytes = parseSizeToBytes(condition.value);
                return typeof targetValue === 'number' && targetValue < bytes;
            }
            return false;
        default:
            return false;
    }
}
const AGE_UNITS = { h: 3600e3, d: 86400e3, w: 7 * 86400e3, m: 30 * 86400e3, y: 365 * 86400e3 };
// Date conditions accept a calendar date ("2026-01-31") or an age ("30d", "2w", "6m", "1y", "12h").
//   date: equals = same day, greater_than = after that day, less_than = before it
//   age:  greater_than = older than, less_than = newer than
// Returns undefined for operators that should fall back to text matching (contains, regex, ...).
function compareDate(condition, fileDate) {
    const value = condition.value.trim().toLowerCase();
    const age = value.match(/^(\d+(?:\.\d+)?)\s*([hdwmy])$/);
    if (age) {
        const ageMs = Date.now() - fileDate.getTime();
        const limit = parseFloat(age[1]) * AGE_UNITS[age[2]];
        if (condition.operator === 'greater_than')
            return ageMs > limit;
        if (condition.operator === 'less_than')
            return ageMs < limit;
        return undefined;
    }
    const day = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!day)
        return undefined;
    const start = new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
    const end = new Date(start.getTime() + 86400e3);
    if (condition.operator === 'equals')
        return fileDate >= start && fileDate < end;
    if (condition.operator === 'greater_than')
        return fileDate >= end;
    if (condition.operator === 'less_than')
        return fileDate < start;
    return undefined;
}
function parseSizeToBytes(valStr) {
    const num = parseFloat(valStr);
    if (isNaN(num))
        return 0;
    const lower = valStr.toLowerCase();
    if (lower.includes('gb'))
        return num * 1024 * 1024 * 1024;
    if (lower.includes('mb'))
        return num * 1024 * 1024;
    if (lower.includes('kb'))
        return num * 1024;
    return num; // bytes
}
