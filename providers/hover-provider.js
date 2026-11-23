// hover-provider.js
// ============================================================
// Hover برای GMO Strategy
//
// رفتار:
//   - روی متغیر PARAMETERS: نمایش تعریف (نام = expr)
//   - روی FIELD(n): نمایش معنای آن فیلد
//   - روی تابع آماری: توضیح کوتاه + امضای تابع
//   - روی سیگنال‌ها (GREEN/RED/...): توضیح رنگی
//   - روی اکشن‌های BUY/SELL: توضیح
// ============================================================

'use strict';

const vscode = require('vscode');
const parser = require('../parser');

// ------------------------------------------------------------
// دیکشنری‌های محتوا
// ------------------------------------------------------------

const SIGNAL_DESCRIPTIONS = {
  GREEN: '**GREEN** — سیگنال خرید قوی (اعتماد بالاتر از آستانه)',
  BLUE: '**BLUE** — سیگنال خرید ضعیف (اعتماد پایین‌تر از آستانه)',
  RED: '**RED** — سیگنال فروش قوی (اعتماد بالاتر از آستانه)',
  YELLOW: '**YELLOW** — سیگنال فروش ضعیف (اعتماد پایین‌تر از آستانه)',
};

const ACTION_DESCRIPTIONS = {
  BUY:
    '**BUY(value)** — خرید طلا\n\n' +
    '- `BUY(1G)` → خرید ۱ گرم در منبع `CASH`\n' +
    '- `BUY(GREEN:1G)` → خرید ۱ گرم در منبع `GREEN`\n' +
    '- `BUY(BLUE:0.5G, GREEN:0.5G)` → خرید هم‌زمان از چند منبع',
  SELL:
    '**SELL(value)** — فروش طلا\n\n' +
    '- `SELL(1G)` → فروش ۱ گرم **فقط از `CASH`**\n' +
    '- `SELL(BLUE:1G)` → فروش ۱ گرم از منبع `BLUE`\n' +
    '- `SELL(GREEN:1G, BLUE:0.5G)` → فروش هم‌زمان از چند منبع',
};

const FUNCTION_DESCRIPTIONS = {
  FIELD: {
    signature: 'FIELD(index)',
    description:
      'دسترسی به فیلد `index` از رکورد سیگنال (۰ تا ۱۰).\n\n' +
      '| index | معنی |\n|---|---|\n' +
      '| 0  | نوع سیگنال |\n' +
      '| 1  | درصد اعتماد |\n' +
      '| 2  | تاریخ میلادی |\n' +
      '| 3  | تاریخ شمسی |\n' +
      '| 4  | ساعت |\n' +
      '| 5  | قیمت |\n' +
      '| 6  | پیشنهاد GmoML |\n' +
      '| 7  | رژیم بازار |\n' +
      '| 8  | عامل رخداد |\n' +
      '| 9  | معامله‌گران |\n' +
      '| 10 | سطوح محوری |',
  },
  LAST_CONFIDENCE: {
    signature: 'LAST_CONFIDENCE(source)',
    description: 'آخرین درصد اعتماد سیگنال `source` (اگر نبود: ۰).',
  },
  LAST_PRICE: {
    signature: 'LAST_PRICE(source)',
    description: 'آخرین قیمت سیگنال `source` (اگر نبود: ۰).',
  },
  LAST_DATETIME: {
    signature: 'LAST_DATETIME(source, value)',
    description:
      'تاریخ و ساعت آخرین سیگنال `source` با offset زمانی.\n\n' +
      '`value` = `عدد:واحد` — واحد: `M` (دقیقه)، `H` (ساعت)، `D` (روز)\n\n' +
      'مثال: `LAST_DATETIME(RED, 36H)` = ۳۶ ساعت بعد از آخرین قرمز',
  },
  MIN_CONFIDENCE: {
    signature: 'MIN_CONFIDENCE(source, n)',
    description: 'کمترین اعتماد `source` در `n` سیگنال آخر.',
  },
  MIN_PRICE: {
    signature: 'MIN_PRICE(source, n)',
    description: 'کمترین قیمت `source` در `n` سیگنال آخر.',
  },
  MAX_CONFIDENCE: {
    signature: 'MAX_CONFIDENCE(source, n)',
    description: 'بیشترین اعتماد `source` در `n` سیگنال آخر.',
  },
  MAX_PRICE: {
    signature: 'MAX_PRICE(source, n)',
    description: 'بیشترین قیمت `source` در `n` سیگنال آخر.',
  },
  AVG_CONFIDENCE: {
    signature: 'AVG_CONFIDENCE(source, n)',
    description: 'میانگین اعتماد `source` در `n` سیگنال آخر.',
  },
  AVG_PRICE: {
    signature: 'AVG_PRICE(source, n)',
    description: 'میانگین قیمت `source` در `n` سیگنال آخر.',
  },
};

const FIELD_INDEX_MEANINGS = {
  0: 'نوع سیگنال (GREEN/BLUE/RED/YELLOW)',
  1: 'درصد اعتماد (۰–۱۰۰)',
  2: 'تاریخ میلادی (YYYY/MM/DD)',
  3: 'تاریخ شمسی (YYYY/MM/DD)',
  4: 'ساعت (HH:MM:SS)',
  5: 'قیمت لحظه‌ای',
  6: 'پیشنهاد GmoML (۰–۴)',
  7: 'رژیم بازار (-1/0/1)',
  8: 'عامل رخداد سیگنال (0/1/2)',
  9: 'وضعیت معامله‌گران (0 = خنثی \n 1 = خریداران محتاط \n 2 = خریداران متوسط \n 3= خریداران قوی \n -1 = فروشندگان محتاط \n -2 = فروشندگان متوسط \n -3 فروشندگان قوی)',
  10: 'فاصله از سطح محوری (-10~-1/0/1~10)',
};

// ------------------------------------------------------------
// کمک‌تابع: ساخت Hover
// ------------------------------------------------------------

function makeHover(markdown, range) {
  const md = new vscode.MarkdownString(markdown);
  md.isTrusted = true;
  md.supportHtml = true;
  return new vscode.Hover(md, range);
}

/**
 * تلاش برای استخراج آرگومان‌های داخل پرانتز بعد از یک تابع.
 * مثلاً در خط `... BUY(1G) ...` برای `BUY` آرگومان `1G` را برمی‌گرداند.
 * @param {string} line
 * @param {number} funcCol ستون شروع تابع در خط
 * @returns {string|null}
 */
function extractCallArgs(line, funcCol) {
  const after = line.slice(funcCol);
  const open = after.indexOf('(');
  if (open < 0) return null;
  let depth = 0;
  let inString = false;
  for (let i = open; i < after.length; i++) {
    const ch = after[i];
    if (ch === "'") inString = !inString;
    if (inString) continue;
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) {
        return after.slice(open + 1, i);
      }
    }
  }
  return null;
}

// ------------------------------------------------------------
// Provider
// ------------------------------------------------------------

/**
 * ثبت HoverProvider برای زبان gmo.
 * @param {vscode.ExtensionContext} context
 */
function registerHoverProvider(context) {
  const provider = vscode.languages.registerHoverProvider(
    { language: 'gmo', scheme: 'file' },
    {
      /**
       * @param {vscode.TextDocument} document
       * @param {vscode.Position} position
       * @param {vscode.CancellationToken} token
       * @returns {vscode.Hover | null}
       */
      provideHover(document, position, token) {
        const cfg = vscode.workspace.getConfiguration('gmo.hover');
        if (!cfg.get('enabled', true)) return null;
        const wordRange = document.getWordRangeAtPosition(
          position,
          /[A-Za-z_][A-Za-z0-9_]*/
        );
        if (!wordRange) return null;

        const word = document.getText(wordRange);
        if (!word) return null;

        const upper = word.toUpperCase();
        const lineText = document.lineAt(position.line).text;

        // ۱. سیگنال‌ها
        if (SIGNAL_DESCRIPTIONS[upper]) {
          return makeHover(SIGNAL_DESCRIPTIONS[upper], wordRange);
        }

        // ۲. اکشن‌ها
        if (ACTION_DESCRIPTIONS[upper]) {
          return makeHover(ACTION_DESCRIPTIONS[upper], wordRange);
        }

        // ۳. توابع
        if (FUNCTION_DESCRIPTIONS[upper]) {
          const info = FUNCTION_DESCRIPTIONS[upper];

          // اگر FIELD است و شمارهٔ داخل پرانتز موجود، معنی آن فیلد را هم نشان بده
          if (upper === 'FIELD') {
            const args = extractCallArgs(lineText, wordRange.start.character);
            if (args !== null) {
              const idx = parseInt(args.trim(), 10);
              if (!isNaN(idx) && FIELD_INDEX_MEANINGS[idx] !== undefined) {
                return makeHover(
                  `**FIELD(${idx})**\n\n${FIELD_INDEX_MEANINGS[idx]}\n\n---\n\n${info.description}`,
                  wordRange
                );
              }
            }
          }

          return makeHover(
            `**${info.signature}**\n\n${info.description}`,
            wordRange
          );
        }

        // ۴. عملگرهای منطقی
        if (parser.isLogicalOp(upper)) {
          const map = {
            AND: '**AND** — «و» منطقی. هر دو شرط باید برقرار باشند.',
            OR: '**OR** — «یا» منطقی. کافی است یکی از شرط‌ها برقرار باشد.',
            NOT: '**NOT** — «نقیض» منطقی. شرط را برعکس می‌کند.',
          };
          return makeHover(map[upper], wordRange);
        }

        // ۵. کلیدواژه‌های ساختاری
        if (upper === 'IF') {
          return makeHover(
            '**IF** — شرط اختیاری روی یک قانون.\n\n' +
              'اگر شرط برقرار نباشد، قانون اجرا نمی‌شود.\n\n' +
              'مثال: `SIGNAL = GREEN -> BUY(1G) IF CONFIDENCE > 70`',
            wordRange
          );
        }
        if (upper === 'END') {
          return makeHover('**END** — پایان استراتژی.', wordRange);
        }
        if (upper === 'PARAMETERS') {
          return makeHover(
            '**PARAMETERS:** — بخش تعریف متغیرها.\n\n' +
              'هر متغیر یک نام (حروف بزرگ) و یک مقدار دارد.\n\n' +
              'مثال: `CONFIDENCE = FIELD(1)`',
            wordRange
          );
        }
        if (upper === 'RULES') {
          return makeHover(
            '**RULES:** — بخش قوانین.\n\n' +
              'هر قانون: `SIGNAL = X -> ACTION(...) IF CONDITION`',
            wordRange
          );
        }

        // ۶. متغیرهای PARAMETERS (این باید آخرین چک باشد)
        const parsed = parser.parseDocument(document.getText());
        const param = parser.findParameter(parsed, word);
        if (param) {
          return makeHover(
            `**${param.name}** = \`${param.expr}\`\n\n` +
              `تعریف‌شده در خط ${param.line + 1}`,
            wordRange
          );
        }

        return null;
      },
    }
  );

  context.subscriptions.push(provider);
  return provider;
}

module.exports = { registerHoverProvider };
