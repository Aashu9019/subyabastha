import fs from 'fs';
import path from 'path';
const { PDFParse } = require('pdf-parse');
import type { Rule, RuleCondition } from '../../types';

export interface FileMetadata {
  filePath: string;
  name: string;
  extension: string;
  size: number;
  createdDate: Date;
  modifiedDate: Date;
  textContent?: string;
  pdfContent?: string;
  pdfAuthor?: string;
  extractedDate?: string;
}

export async function extractFileMetadata(filePath: string): Promise<FileMetadata> {
  const stats = fs.statSync(filePath);
  const parsedPath = path.parse(filePath);
  const ext = parsedPath.ext.replace('.', '').toLowerCase();
  
  const meta: FileMetadata = {
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
      meta.textContent = fs.readFileSync(filePath, 'utf-8');
      meta.extractedDate = findDateInText(meta.textContent);
    } catch (err) {
      console.warn(`Could not read text file ${filePath}:`, err);
    }
  }

  // PDF content & metadata extraction
  if (ext === 'pdf' && stats.size < 20 * 1024 * 1024) { // max 20MB PDF
    // pdf-parse v2 API: a PDFParse instance per document, destroyed after use
    const parser = new PDFParse({ data: fs.readFileSync(filePath) });
    try {
      const textResult = await parser.getText();
      const infoResult = await parser.getInfo();
      meta.pdfContent = textResult.text;
      meta.pdfAuthor = infoResult.info?.Author || infoResult.info?.Creator || '';
      meta.extractedDate = findDateInText(textResult.text);
    } catch (err) {
      console.warn(`Could not parse PDF file ${filePath}:`, err);
    } finally {
      await parser.destroy().catch(() => {});
    }
  }

  return meta;
}

function findDateInText(text: string): string | undefined {
  if (!text) return undefined;
  
  // Standard YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = text.match(/\b(20\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // DD-MM-YYYY or DD/MM/YYYY
  const euMatch = text.match(/\b(0[1-9]|[12]\d|3[01])[-/.](0[1-9]|1[0-2])[-/.](20\d{2})\b/);
  if (euMatch) return `${euMatch[3]}-${euMatch[2]}-${euMatch[1]}`;

  return undefined;
}

export async function evaluateRule(rule: Rule, meta: FileMetadata): Promise<boolean> {
  if (!rule.enabled) return false;
  if (rule.conditions.length === 0) return false;

  const results: boolean[] = [];

  for (const condition of rule.conditions) {
    const matched = evaluateCondition(condition, meta);
    results.push(matched);
  }

  if (rule.matchType === 'ALL') {
    return results.every(Boolean);
  } else {
    return results.some(Boolean);
  }
}

function evaluateCondition(condition: RuleCondition, meta: FileMetadata): boolean {
  let targetValue: string | number | undefined;

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

  if (targetValue === undefined || targetValue === null) return false;

  // Extensions may be typed as ".png" or "png"
  const normalize = (v: string) => {
    const s = v.trim().toLowerCase();
    return condition.field === 'extension' ? s.replace(/^\./, '') : s;
  };
  const condVal = normalize(condition.value);
  const stringVal = String(targetValue).toLowerCase();

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
      } catch {
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

function parseSizeToBytes(valStr: string): number {
  const num = parseFloat(valStr);
  if (isNaN(num)) return 0;
  
  const lower = valStr.toLowerCase();
  if (lower.includes('gb')) return num * 1024 * 1024 * 1024;
  if (lower.includes('mb')) return num * 1024 * 1024;
  if (lower.includes('kb')) return num * 1024;
  return num; // bytes
}
