// parser.js
// ============================================================
// پارسر مشترک GMO Strategy
//   - استخراج ساختار سند (هدرها، PARAMETERS، RULES، توکن)
//   - مکان‌یابی متغیرها، توابع، سیگنال‌ها و اکشن‌ها
//   - قابل استفاده در: formatter، definition-provider، hover-provider
// ============================================================

'use strict';

// ------------------------------------------------------------
// ثابت‌ها
// ------------------------------------------------------------
const SIGNALS = ['GREEN', 'BLUE', 'YELLOW', 'RED'];

const ACTIONS = ['BUY', 'SELL'];

const FUNCTIONS = [
  'FIELD',
  'LAST_CONFIDENCE',
  'LAST_PRICE',
  'LAST_DATETIME',
  'MIN_CONFIDENCE',
  'MIN_PRICE',
  'MAX_CONFIDENCE',
  'MAX_PRICE',
  'AVG_CONFIDENCE',
  'AVG_PRICE',
];

const KEYWORDS = [
  'STRATEGY',
  'VERSION',
  'REVISION',
  'DESCRIPTION',
  'PUBLISHER',
  'TOKEN',
  'PARAMETERS',
  'RULES',
  'PRIORITY',
  'IF',
  'END',
];

const LOGICAL_OPS = ['AND', 'OR', 'NOT'];

// ------------------------------------------------------------
// ابزارک‌ها
// ------------------------------------------------------------

/**
 * جدا کردن کامنت از کد، با احترام به رشته‌های تک‌کوتیشنی.
 * @param {string} line
 * @returns {{ code: string, comment: string }}
 */
function splitLineComment(line) {
  let inString = false;
  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i];
    if (ch === "'") {
      inString = !inString;
    } else if (!inString && ch === '/' && line[i + 1] === '/') {
      return { code: line.slice(0, i), comment: line.slice(i) };
    }
  }
  return { code: line, comment: '' };
}

/**
 * شماره ستون یک کلمه در یک خط (نسبت به ابتدای سند قابل استفاده نیست؛
 * نسبت به ابتدای خط است). اگر پیدا نشد -1 برمی‌گرداند.
 * @param {string} line
 * @param {string} word
 * @returns {number}
 */
function indexOfWord(line, word) {
  const re = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
  const m = re.exec(line);
  return m ? m.index : -1;
}

/**
 * تمام رخدادهای یک کلمه در یک خط را برمی‌گرداند.
 * @param {string} line
 * @param {string} word
 * @returns {Array<number>}
 */
function allIndexOfWord(line, word) {
  const re = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
  const out = [];
  let m;
  while ((m = re.exec(line)) !== null) {
    out.push(m.index);
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}

/**
 * استخراج همهٔ رخدادهای یک کلمه در کل متن، با موقعیت.
 * @param {string} text
 * @param {string} word
 * @returns {Array<{ line: number, col: number }>}
 */
function findAllOccurrences(text, word) {
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const cols = allIndexOfWord(lines[i], word);
    for (const col of cols) {
      out.push({ line: i, col });
    }
  }
  return out;
}

// ------------------------------------------------------------
// هستهٔ پارسر
// ------------------------------------------------------------

/**
 * ساختار سند را پارس می‌کند.
 *
 * خروجی:
 * {
 *   headers: [{ keyword, value, line }],
 *   parameters: [{ name, expr, line, col }],
 *   rules: [{ line, code }],
 *   sections: [{ name, line }],       // PARAMETERS، RULES
 *   endLine: number | null,
 *   isTokenBlock: boolean,
 *   token: string | null,
 *   revision: string | null,
 *   publisher: string | null,
 *   strategyName: string | null,
 *   strategyVersion: string | null,
 * }
 *
 * @param {string} text
 * @returns {object}
 */
function parseDocument(text) {
  const lines = text.split(/\r?\n/);

  const result = {
    headers: [],
    parameters: [],
    rules: [],
    sections: [],
    endLine: null,
    isTokenBlock: false,
    token: null,
    revision: null,
    publisher: null,
    strategyName: null,
    strategyVersion: null,
    lines, // برای دسترسی سریع
  };

  let section = null; // 'parameters' | 'rules' | null

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const { code } = splitLineComment(raw);
    const trimmed = code.trim();

    if (trimmed === '') continue;

    let m;

    // STRATEGY <name>
    if ((m = /^strategy\s+(.+)$/i.exec(trimmed))) {
      result.strategyName = m[1].trim();
      result.headers.push({ keyword: 'STRATEGY', value: m[1].trim(), line: i });
      continue;
    }

    // VERSION <value>
    if ((m = /^version\s+(.+)$/i.exec(trimmed))) {
      const v = m[1].trim();
      // VERSION token یعنی بلوک توکن
      if (/^token\b/i.test(v)) {
        result.isTokenBlock = true;
      } else {
        result.strategyVersion = v;
      }
      result.headers.push({ keyword: 'VERSION', value: v, line: i });
      continue;
    }

    // REVISION <value>
    if ((m = /^revision\s*:?\s*(.+)$/i.exec(trimmed))) {
      result.revision = m[1].trim();
      result.headers.push({ keyword: 'REVISION', value: m[1].trim(), line: i });
      continue;
    }

    // PUBLISHER: ...
    if ((m = /^publisher\s*:\s*(.+)$/i.exec(trimmed))) {
      result.publisher = m[1].trim();
      result.headers.push({ keyword: 'PUBLISHER', value: m[1].trim(), line: i });
      continue;
    }

    // DESCRIPTION: ...
    if ((m = /^description\s*:?\s*(.*)$/i.exec(trimmed))) {
      result.headers.push({ keyword: 'DESCRIPTION', value: m[1].trim(), line: i });
      continue;
    }

    // TOKEN: <hex64>
    if ((m = /^token\s*:\s*([a-fA-F0-9]{64})$/i.exec(trimmed))) {
      result.isTokenBlock = true;
      result.token = m[1];
      result.headers.push({ keyword: 'TOKEN', value: m[1], line: i });
      continue;
    }

    // PARAMETERS:
    if (/^parameters\s*:/i.test(trimmed)) {
      section = 'parameters';
      result.sections.push({ name: 'PARAMETERS', line: i });
      continue;
    }

    // RULES:
    if (/^rules\s*:/i.test(trimmed)) {
      section = 'rules';
      result.sections.push({ name: 'RULES', line: i });
      continue;
    }

    // END
    if (/^end\b/i.test(trimmed)) {
      section = null;
      result.endLine = i;
      continue;
    }

    // داخل PARAMETERS
    if (section === 'parameters') {
      if ((m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/i.exec(trimmed))) {
        result.parameters.push({
          name: m[1],
          expr: m[2].trim(),
          line: i,
          col: indexOfWord(lines[i], m[1]),
        });
        continue;
      }
    }

    // داخل RULES
    if (section === 'rules') {
      result.rules.push({ line: i, code: trimmed });
      continue;
    }

    // (خطوط ناشناخته نادیده گرفته می‌شوند)
  }

  return result;
}

// ------------------------------------------------------------
// کمک‌تابع‌های معنایی
// ------------------------------------------------------------

/**
 * آیا کلمه یک متغیر PARAMETERS است؟
 * @param {object} parsed
 * @param {string} word
 * @returns {object|null} پارامتر تعریف‌شده یا null
 */
function findParameter(parsed, word) {
  if (!word) return null;
  const upper = word.toUpperCase();
  return parsed.parameters.find((p) => p.name.toUpperCase() === upper) || null;
}

/**
 * آیا کلمه یک سیگنال است؟
 * @param {string} word
 * @returns {boolean}
 */
function isSignal(word) {
  if (!word) return false;
  return SIGNALS.includes(word.toUpperCase());
}

/**
 * آیا کلمه یک اکشن است؟
 * @param {string} word
 * @returns {boolean}
 */
function isAction(word) {
  if (!word) return false;
  return ACTIONS.includes(word.toUpperCase());
}

/**
 * آیا کلمه یک تابع است؟
 * @param {string} word
 * @returns {boolean}
 */
function isFunction(word) {
  if (!word) return false;
  return FUNCTIONS.includes(word.toUpperCase());
}

/**
 * آیا کلمه یک کلیدواژه است؟
 * @param {string} word
 * @returns {boolean}
 */
function isKeyword(word) {
  if (!word) return false;
  return KEYWORDS.includes(word.toUpperCase());
}

/**
 * آیا کلمه یک عملگر منطقی است؟
 * @param {string} word
 * @returns {boolean}
 */
function isLogicalOp(word) {
  if (!word) return false;
  return LOGICAL_OPS.includes(word.toUpperCase());
}

/**
 * مقدار عددی یک فیلد سیگنال را با توجه به قواعد زبان GMO برمی‌گرداند.
 * (برای hover استفاده می‌شود)
 * @param {string} word
 * @returns {string|null}
 */
function describeSignalField(word) {
  if (!/^FIELD$/i.test(word)) return null;
  return null; // نیاز به شمارهٔ داخل پرانتز دارد؛ در hover-provider حل می‌شود
}

// ------------------------------------------------------------
// صادرات
// ------------------------------------------------------------

module.exports = {
  SIGNALS,
  ACTIONS,
  FUNCTIONS,
  KEYWORDS,
  LOGICAL_OPS,

  splitLineComment,
  indexOfWord,
  allIndexOfWord,
  findAllOccurrences,

  parseDocument,
  findParameter,
  isSignal,
  isAction,
  isFunction,
  isKeyword,
  isLogicalOp,
  describeSignalField,
};