// completion-provider.js
// ============================================================
// Completion Provider برای GMO Strategy
//
// رفتار:
//   - داخل PARAMETERS: پیشنهاد نام‌های استاندارد + توابع
//   - داخل RULES: پیشنهاد پارامترهای تعریف‌شده + سیگنال‌ها + اکشن‌ها + توابع
//   - بعد از IF: پیشنهاد پارامترها + عملگرها
//   - در بلوک توکن: پیشنهاد REVISION/PUBLISHER/TOKEN
//   - بعد از LAST_DATETIME(: پیشنهاد واحدهای M/H/D
// ============================================================

'use strict';

const vscode = require('vscode');
const parser = require('../parser');

// ------------------------------------------------------------
// آیتم‌های تکمیل استاندارد
// ------------------------------------------------------------

const STANDARD_PARAMETERS = [
  {
    name: 'SIGNAL',
    expr: 'FIELD(0)',
    doc: 'نام سیگنال (GREEN/BLUE/RED/YELLOW)',
  },
  { name: 'CONFIDENCE', expr: 'FIELD(1)', doc: 'درصد اعتماد (۰–۱۰۰)' },
  {
    name: 'DATETIME',
    expr: "FIELD(2) + ' ' + FIELD(4)",
    doc: 'تاریخ + ساعت سیگنال',
  },
  { name: 'PRICE', expr: 'FIELD(5)', doc: 'قیمت لحظه‌ای' },
  { name: 'GMOML', expr: 'FIELD(6)', doc: 'پیشنهاد GmoML (۰–۴)' },
  { name: 'MARKET', expr: 'FIELD(7)', doc: 'رژیم بازار (-1/0/1)' },
  { name: 'FACTOR', expr: 'FIELD(8)', doc: 'عامل رخداد سیگنال (0/1/2)' },
  {
    name: 'TRADERS',
    expr: 'FIELD(9)',
    doc: 'وضعیت معامله‌گران (0 = خنثی \n 1 = خریداران محتاط \n 2 = خریداران متوسط \n 3= خریداران قوی \n -1 = فروشندگان محتاط \n -2 = فروشندگان متوسط \n -3 فروشندگان قوی)',
  },
  {
    name: 'PIVOTPOINT',
    expr: 'FIELD(10)',
    doc: 'فاصله از سطح محوری (-10~-1/0/1~10)',
  },
];

const SIGNAL_ITEMS = [
  { name: 'GREEN', doc: 'سیگنال خرید قوی' },
  { name: 'BLUE', doc: 'سیگنال خرید ضعیف' },
  { name: 'RED', doc: 'سیگنال فروش قوی' },
  { name: 'YELLOW', doc: 'سیگنال فروش ضعیف' },
];

const FUNCTION_ITEMS = [
  {
    name: 'FIELD',
    snippet: 'FIELD(${1:0})',
    doc: 'دسترسی به فیلد index از رکورد سیگنال (۰ تا ۱۰)',
  },
  {
    name: 'LAST_CONFIDENCE',
    snippet: 'LAST_CONFIDENCE(${1|GREEN,BLUE,RED,YELLOW|})',
    doc: 'آخرین درصد اعتماد سیگنال source',
  },
  {
    name: 'LAST_PRICE',
    snippet: 'LAST_PRICE(${1|GREEN,BLUE,RED,YELLOW|})',
    doc: 'آخرین قیمت سیگنال source',
  },
  {
    name: 'LAST_DATETIME',
    snippet: 'LAST_DATETIME(${1|GREEN,BLUE,RED,YELLOW|}, ${2:36H})',
    doc: 'تاریخ/ساعت آخرین سیگنال source با offset',
  },
  {
    name: 'MIN_CONFIDENCE',
    snippet: 'MIN_CONFIDENCE(${1|GREEN,BLUE,RED,YELLOW|}, ${2:5})',
    doc: 'کمترین اعتماد source در n سیگنال آخر',
  },
  {
    name: 'MIN_PRICE',
    snippet: 'MIN_PRICE(${1|GREEN,BLUE,RED,YELLOW|}, ${2:5})',
    doc: 'کمترین قیمت source در n سیگنال آخر',
  },
  {
    name: 'MAX_CONFIDENCE',
    snippet: 'MAX_CONFIDENCE(${1|GREEN,BLUE,RED,YELLOW|}, ${2:5})',
    doc: 'بیشترین اعتماد source در n سیگنال آخر',
  },
  {
    name: 'MAX_PRICE',
    snippet: 'MAX_PRICE(${1|GREEN,BLUE,RED,YELLOW|}, ${2:5})',
    doc: 'بیشترین قیمت source در n سیگنال آخر',
  },
  {
    name: 'AVG_CONFIDENCE',
    snippet: 'AVG_CONFIDENCE(${1|GREEN,BLUE,RED,YELLOW|}, ${2:5})',
    doc: 'میانگین اعتماد source در n سیگنال آخر',
  },
  {
    name: 'AVG_PRICE',
    snippet: 'AVG_PRICE(${1|GREEN,BLUE,RED,YELLOW|}, ${2:5})',
    doc: 'میانگین قیمت source در n سیگنال آخر',
  },
];

const ACTION_ITEMS = [
  {
    name: 'BUY',
    snippet: 'BUY(${1:1G})',
    doc: 'خرید طلا در منبع CASH',
  },
  {
    name: 'BUY_SOURCE',
    label: 'BUY(source:value)',
    snippet: 'BUY(${1|GREEN,BLUE,RED,YELLOW,CASH|}:${2:1G})',
    doc: 'خرید در منبع مشخص',
  },
  {
    name: 'BUY_MULTI',
    label: 'BUY(src1:v1, src2:v2)',
    snippet:
      'BUY(${1|GREEN,BLUE,RED,YELLOW|}:${2:0.5G}, ${3|GREEN,BLUE,RED,YELLOW|}:${4:0.5G})',
    doc: 'خرید هم‌زمان از چند منبع',
  },
  {
    name: 'SELL',
    snippet: 'SELL(${1:1G})',
    doc: 'فروش از منبع CASH',
  },
  {
    name: 'SELL_SOURCE',
    label: 'SELL(source:value)',
    snippet: 'SELL(${1|GREEN,BLUE,RED,YELLOW,CASH|}:${2:1G})',
    doc: 'فروش از منبع مشخص',
  },
  {
    name: 'SELL_MULTI',
    label: 'SELL(src1:v1, src2:v2)',
    snippet:
      'SELL(${1|GREEN,BLUE,RED,YELLOW|}:${2:0.5G}, ${3|GREEN,BLUE,RED,YELLOW|}:${4:0.5G})',
    doc: 'فروش هم‌زمان از چند منبع',
  },
];

const LOGICAL_ITEMS = [
  { name: 'AND', doc: 'و منطقی' },
  { name: 'OR', doc: 'یا منطقی' },
  { name: 'NOT', doc: 'نقیض منطقی' },
];

const TIME_UNITS = [
  { name: 'M', doc: 'دقیقه' },
  { name: 'H', doc: 'ساعت' },
  { name: 'D', doc: 'روز' },
];

const TOKEN_BLOCK_ITEMS = [
  {
    name: 'REVISION',
    snippet: 'REVISION ${1:1.0}',
    doc: 'نسخه استراتژی از Hub',
  },
  {
    name: 'PUBLISHER',
    snippet: 'PUBLISHER: ${1:0914***3491}',
    doc: 'شماره ناشر (ماسک‌شده)',
  },
  { name: 'TOKEN', snippet: 'TOKEN: ${1:64 hex}', doc: 'توکن ۶۴ کاراکتری Hub' },
];

// ------------------------------------------------------------
// ساخت CompletionItem از آیتم ساده
// ------------------------------------------------------------

function mkItem(kind, label, detail, documentation, insertText, isSnippet) {
  const item = new vscode.CompletionItem(label, kind);
  if (detail) item.detail = detail;
  if (documentation) {
    item.documentation = new vscode.MarkdownString(documentation);
  }
  if (insertText !== undefined) {
    item.insertText = isSnippet
      ? new vscode.SnippetString(insertText)
      : insertText;
  }
  return item;
}

// ------------------------------------------------------------
// تشخیص context
// ------------------------------------------------------------

/**
 * بر اساس موقعیت مکان‌نما، context را تشخیص می‌دهد.
 * @param {vscode.TextDocument} document
 * @param {vscode.Position} position
 * @param {object} parsed
 * @returns {'parameters'|'rules'|'header'|'token'|'unknown'}
 */
function detectContext(document, position, parsed) {
  const line = position.line;

  // بالای PARAMETERS؟
  const firstParamLine =
    parsed.parameters.length > 0 ? parsed.parameters[0].line : Infinity;
  const firstRuleLine =
    parsed.rules.length > 0 ? parsed.rules[0].line : Infinity;

  const paramsSection = parsed.sections.find((s) => s.name === 'PARAMETERS');
  const rulesSection = parsed.sections.find((s) => s.name === 'RULES');

  if (parsed.isTokenBlock) {
    // داخل بلوک توکن: تا قبل از END
    if (parsed.endLine !== null && line < parsed.endLine) return 'token';
  }

  if (rulesSection && line > rulesSection.line) {
    if (parsed.endLine === null || line < parsed.endLine) return 'rules';
  }

  if (paramsSection && line > paramsSection.line) {
    // اگر بعدش RULES آمده، هنوز داخل PARAMETERS است؟
    if (!rulesSection || line < rulesSection.line) return 'parameters';
  }

  return 'header';
}

/**
 * آیا مکان‌نما داخل پرانتز یک تابع خاص است؟
 * مثلاً داخل `LAST_DATETIME(RED, |` → برمی‌گرداند { func: 'LAST_DATETIME', argIndex: 1 }
 * @param {string} lineText
 * @param {number} col
 * @returns {{ func: string, argIndex: number }|null}
 */
function detectInsideFunctionCall(lineText, col) {
  const before = lineText.slice(0, col);
  let depth = 0;
  let inString = false;

  for (let i = before.length - 1; i >= 0; i--) {
    const ch = before[i];
    if (ch === "'") inString = !inString;
    if (inString) continue;

    if (ch === ')') depth++;
    else if (ch === '(') {
      if (depth === 0) {
        // پیدا کردن نام تابع قبل از (
        const prefix = before.slice(0, i);
        const m = /([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(prefix);
        if (!m) return null;
        const funcName = m[1].toUpperCase();

        // شمارش کاما در آرگومان‌های فعلی
        const argsText = before.slice(i + 1);
        let commas = 0;
        let str = false;
        for (const c of argsText) {
          if (c === "'") str = !str;
          if (!str && c === ',') commas++;
        }
        return { func: funcName, argIndex: commas };
      }
      depth--;
    }
  }
  return null;
}

// ------------------------------------------------------------
// Provider
// ------------------------------------------------------------

/**
 * ثبت CompletionProvider برای زبان gmo.
 * @param {vscode.ExtensionContext} context
 */
function registerCompletionProvider(context) {
  const provider = vscode.languages.registerCompletionItemProvider(
    { language: 'gmo', scheme: 'file' },
    {
      /**
       * @param {vscode.TextDocument} document
       * @param {vscode.Position} position
       * @param {vscode.CancellationToken} token
       * @param {vscode.CompletionContext} completionContext
       * @returns {vscode.CompletionItem[]}
       */
      provideCompletionItems(document, position, token, completionContext) {
        const cfg = vscode.workspace.getConfiguration('gmo.completion');
        if (!cfg.get('enabled', true)) return undefined;
        const lineText = document.lineAt(position.line).text;
        const parsed = parser.parseDocument(document.getText());
        const ctx = detectContext(document, position, parsed);

        const items = [];

        // --------------------------------------------------------
        // داخل تابع خاص (مثلاً LAST_DATETIME)
        // --------------------------------------------------------
        const inside = detectInsideFunctionCall(lineText, position.character);
        if (inside) {
          if (inside.func === 'LAST_DATETIME' && inside.argIndex === 0) {
            // آرگومان اول: منبع
            for (const s of SIGNAL_ITEMS) {
              items.push(
                mkItem(
                  vscode.CompletionItemKind.EnumMember,
                  s.name,
                  'سیگنال',
                  s.doc,
                  s.name
                )
              );
            }
            return items;
          }
          if (inside.func === 'LAST_DATETIME' && inside.argIndex === 1) {
            // آرگومان دوم: offset زمانی — فقط واحدها
            for (const u of TIME_UNITS) {
              items.push(
                mkItem(
                  vscode.CompletionItemKind.Unit,
                  u.name,
                  'واحد زمان',
                  u.doc,
                  u.name
                )
              );
            }
            return items;
          }
          if (
            ['LAST_CONFIDENCE', 'LAST_PRICE'].includes(inside.func) &&
            inside.argIndex === 0
          ) {
            for (const s of SIGNAL_ITEMS) {
              items.push(
                mkItem(
                  vscode.CompletionItemKind.EnumMember,
                  s.name,
                  'سیگنال',
                  s.doc,
                  s.name
                )
              );
            }
            return items;
          }
          if (
            [
              'MIN_CONFIDENCE',
              'MIN_PRICE',
              'MAX_CONFIDENCE',
              'MAX_PRICE',
              'AVG_CONFIDENCE',
              'AVG_PRICE',
            ].includes(inside.func)
          ) {
            if (inside.argIndex === 0) {
              for (const s of SIGNAL_ITEMS) {
                items.push(
                  mkItem(
                    vscode.CompletionItemKind.EnumMember,
                    s.name,
                    'سیگنال',
                    s.doc,
                    s.name
                  )
                );
              }
            }
            return items;
          }
          if (inside.func === 'FIELD' && inside.argIndex === 0) {
            const meanings = {
              0: 'نوع سیگنال',
              1: 'درصد اعتماد',
              2: 'تاریخ میلادی',
              3: 'تاریخ شمسی',
              4: 'ساعت',
              5: 'قیمت',
              6: 'پیشنهاد GmoML',
              7: 'رژیم بازار',
              8: 'عامل رخداد',
            };
            for (const idx of Object.keys(meanings)) {
              items.push(
                mkItem(
                  vscode.CompletionItemKind.Constant,
                  idx,
                  'FIELD index',
                  meanings[idx],
                  idx
                )
              );
            }
            return items;
          }
          return [];
        }

        // --------------------------------------------------------
        // header: پیشنهاد STRATEGY / VERSION / DESCRIPTION / ...
        // --------------------------------------------------------
        if (ctx === 'header') {
          const headers = [
            { name: 'STRATEGY', snippet: 'STRATEGY ${1:MyStrategy}' },
            { name: 'VERSION', snippet: 'VERSION ${1:1.0}' },
            { name: 'DESCRIPTION', snippet: 'DESCRIPTION: ${1:توضیح اختیاری}' },
            { name: 'PARAMETERS', snippet: 'PARAMETERS:' },
            { name: 'RULES', snippet: 'RULES:' },
            { name: 'END', snippet: 'END' },
          ];
          for (const h of headers) {
            items.push(
              mkItem(
                vscode.CompletionItemKind.Keyword,
                h.name,
                'کلیدواژه ساختاری',
                undefined,
                h.snippet,
                true
              )
            );
          }
          return items;
        }

        // --------------------------------------------------------
        // token: پیشنهاد بلوک توکن
        // --------------------------------------------------------
        if (ctx === 'token') {
          for (const t of TOKEN_BLOCK_ITEMS) {
            items.push(
              mkItem(
                vscode.CompletionItemKind.Keyword,
                t.name,
                'فیلد بلوک توکن',
                t.doc,
                t.snippet,
                true
              )
            );
          }
          // END هم پیشنهاد شود
          items.push(
            mkItem(
              vscode.CompletionItemKind.Keyword,
              'END',
              'پایان استراتژی',
              undefined,
              'END',
              false
            )
          );
          return items;
        }

        // --------------------------------------------------------
        // parameters: پیشنهاد نام‌های استاندارد + توابع + FIELD
        // --------------------------------------------------------
        if (ctx === 'parameters') {
          for (const p of STANDARD_PARAMETERS) {
            items.push(
              mkItem(
                vscode.CompletionItemKind.Variable,
                p.name,
                'متغیر استاندارد',
                p.doc,
                p.name + '     = ' + p.expr,
                false
              )
            );
          }
          for (const f of FUNCTION_ITEMS) {
            items.push(
              mkItem(
                vscode.CompletionItemKind.Function,
                f.name,
                'تابع',
                f.doc,
                f.snippet,
                true
              )
            );
          }
          // پارامترهای تعریف‌شده قبلی (برای استفاده در تعریف جدید)
          for (const p of parsed.parameters) {
            items.push(
              mkItem(
                vscode.CompletionItemKind.Variable,
                p.name,
                'تعریف‌شده: ' + p.expr,
                undefined,
                p.name
              )
            );
          }
          return items;
        }

        // --------------------------------------------------------
        // rules: پیشنهاد پارامترها + سیگنال‌ها + اکشن‌ها + توابع + عملگرها
        // --------------------------------------------------------
        if (ctx === 'rules') {
          // سیگنال‌ها
          for (const s of SIGNAL_ITEMS) {
            items.push(
              mkItem(
                vscode.CompletionItemKind.EnumMember,
                s.name,
                'سیگنال',
                s.doc,
                s.name
              )
            );
          }

          // اکشن‌ها
          for (const a of ACTION_ITEMS) {
            items.push(
              mkItem(
                vscode.CompletionItemKind.Method,
                a.label || a.name,
                'اکشن',
                a.doc,
                a.snippet,
                true
              )
            );
          }

          // توابع
          for (const f of FUNCTION_ITEMS) {
            items.push(
              mkItem(
                vscode.CompletionItemKind.Function,
                f.name,
                'تابع',
                f.doc,
                f.snippet,
                true
              )
            );
          }

          // پارامترهای تعریف‌شده
          for (const p of parsed.parameters) {
            items.push(
              mkItem(
                vscode.CompletionItemKind.Variable,
                p.name,
                'پارامتر: ' + p.expr,
                undefined,
                p.name
              )
            );
          }

          // عملگرهای منطقی
          for (const op of LOGICAL_ITEMS) {
            items.push(
              mkItem(
                vscode.CompletionItemKind.Operator,
                op.name,
                'عملگر منطقی',
                op.doc,
                op.name
              )
            );
          }

          // IF
          items.push(
            mkItem(
              vscode.CompletionItemKind.Keyword,
              'IF',
              'شرط اختیاری',
              'شرط اجرای قانون',
              'IF ',
              false
            )
          );

          return items;
        }

        // --------------------------------------------------------
        // unknown: پیشنهاد کلی
        // --------------------------------------------------------
        for (const k of parser.KEYWORDS) {
          items.push(
            mkItem(
              vscode.CompletionItemKind.Keyword,
              k,
              'کلیدواژه',
              undefined,
              k
            )
          );
        }
        return items;
      },
    },
    // triggerCharacters: با تایپ این کاراکترها پیشنهاد باز شود
    ' ',
    '=',
    '(',
    ':',
    '.',
    ','
  );

  context.subscriptions.push(provider);
  return provider;
}

module.exports = { registerCompletionProvider };
