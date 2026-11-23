// signature-help-provider.js
// ============================================================
// Signature Help Provider برای GMO Strategy
//
// رفتار:
//   - هنگام تایپ داخل پرانتز یک تابع، امضای آن را نمایش می‌دهد
//   - آرگومان فعال را bold می‌کند
//   - توضیح مختصر هر آرگومان را زیر امضا نشان می‌دهد
//
// تریگرها: ( و ,
// ============================================================

'use strict';

const vscode = require('vscode');

// ------------------------------------------------------------
// دیکشنری امضاها
// ------------------------------------------------------------
const SIGNATURES = {
  FIELD: {
    label: 'FIELD(index)',
    documentation: 'دسترسی به فیلد index از رکورد سیگنال (۰ تا ۱۰)',
    parameters: [
      {
        label: 'index',
        documentation:
          'شماره فیلد:\n' +
          '- 0: نوع سیگنال\n' +
          '- 1: درصد اعتماد\n' +
          '- 2: تاریخ میلادی\n' +
          '- 3: تاریخ شمسی\n' +
          '- 4: ساعت\n' +
          '- 5: قیمت\n' +
          '- 6: پیشنهاد GmoML\n' +
          '- 7: رژیم بازار\n' +
          '- 8: عامل رخداد\n' +
          '- 9: معامله‌گران\n' +
          '- 10: سطوح محوری',
      },
    ],
  },
  LAST_CONFIDENCE: {
    label: 'LAST_CONFIDENCE(source)',
    documentation: 'آخرین درصد اعتماد سیگنال source (اگر نبود: ۰)',
    parameters: [
      {
        label: 'source',
        documentation: 'GREEN، BLUE، RED یا YELLOW',
      },
    ],
  },
  LAST_PRICE: {
    label: 'LAST_PRICE(source)',
    documentation: 'آخرین قیمت سیگنال source (اگر نبود: ۰)',
    parameters: [
      {
        label: 'source',
        documentation: 'GREEN، BLUE، RED یا YELLOW',
      },
    ],
  },
  LAST_DATETIME: {
    label: 'LAST_DATETIME(source, value)',
    documentation: 'تاریخ و ساعت آخرین سیگنال source با offset زمانی value',
    parameters: [
      {
        label: 'source',
        documentation: 'GREEN، BLUE، RED یا YELLOW',
      },
      {
        label: 'value',
        documentation:
          'offset زمانی به فرمت عدد:واحد\n' +
          '- M: دقیقه\n' +
          '- H: ساعت\n' +
          '- D: روز\n' +
          'مثال: 36H، 3D، 90M، -12H',
      },
    ],
  },
  MIN_CONFIDENCE: {
    label: 'MIN_CONFIDENCE(source, count)',
    documentation: 'کمترین اعتماد source در count سیگنال آخر',
    parameters: [
      { label: 'source', documentation: 'GREEN، BLUE، RED یا YELLOW' },
      { label: 'count', documentation: 'تعداد سیگنال‌های آخر (عدد صحیح مثبت)' },
    ],
  },
  MIN_PRICE: {
    label: 'MIN_PRICE(source, count)',
    documentation: 'کمترین قیمت source در count سیگنال آخر',
    parameters: [
      { label: 'source', documentation: 'GREEN، BLUE، RED یا YELLOW' },
      { label: 'count', documentation: 'تعداد سیگنال‌های آخر' },
    ],
  },
  MAX_CONFIDENCE: {
    label: 'MAX_CONFIDENCE(source, count)',
    documentation: 'بیشترین اعتماد source در count سیگنال آخر',
    parameters: [
      { label: 'source', documentation: 'GREEN، BLUE، RED یا YELLOW' },
      { label: 'count', documentation: 'تعداد سیگنال‌های آخر' },
    ],
  },
  MAX_PRICE: {
    label: 'MAX_PRICE(source, count)',
    documentation: 'بیشترین قیمت source در count سیگنال آخر',
    parameters: [
      { label: 'source', documentation: 'GREEN، BLUE، RED یا YELLOW' },
      { label: 'count', documentation: 'تعداد سیگنال‌های آخر' },
    ],
  },
  AVG_CONFIDENCE: {
    label: 'AVG_CONFIDENCE(source, count)',
    documentation: 'میانگین اعتماد source در count سیگنال آخر',
    parameters: [
      { label: 'source', documentation: 'GREEN، BLUE، RED یا YELLOW' },
      { label: 'count', documentation: 'تعداد سیگنال‌های آخر' },
    ],
  },
  AVG_PRICE: {
    label: 'AVG_PRICE(source, count)',
    documentation: 'میانگین قیمت source در count سیگنال آخر',
    parameters: [
      { label: 'source', documentation: 'GREEN، BLUE، RED یا YELLOW' },
      { label: 'count', documentation: 'تعداد سیگنال‌های آخر' },
    ],
  },
  BUY: {
    label: 'BUY(value | source:value | src1:v1, src2:v2)',
    documentation:
      'خرید طلا\n' +
      '- BUY(1G) → خرید ۱ گرم در CASH\n' +
      '- BUY(GREEN:1G) → خرید ۱ گرم در GREEN\n' +
      '- BUY(BLUE:0.5G, GREEN:0.5G) → خرید هم‌زمان',
    parameters: [
      {
        label: 'value',
        documentation:
          'مقدار با واحد G (مثلاً 1G، 0.5G)\n' +
          'یا source:value (مثلاً GREEN:1G)\n' +
          'یا چند source:value با کاما',
      },
    ],
  },
  SELL: {
    label: 'SELL(value | source:value | src1:v1, src2:v2)',
    documentation:
      'فروش طلا\n' +
      '- SELL(1G) → فروش ۱ گرم از CASH\n' +
      '- SELL(BLUE:1G) → فروش ۱ گرم از BLUE\n' +
      '⚠️ SELL(1G) فقط از CASH فروش می‌کند',
    parameters: [
      {
        label: 'value',
        documentation:
          'مقدار با واحد G (مثلاً 1G، 0.5G)\n' +
          'یا source:value (مثلاً BLUE:1G)',
      },
    ],
  },
};

// ------------------------------------------------------------
// کمک‌تابع: پیدا کردن تابع فعال و شماره آرگومان
// ------------------------------------------------------------
/**
 * با اسکن خط به عقب از موقعیت مکان‌نما، تابع در حال تایپ را پیدا می‌کند.
 * @param {string} lineText
 * @param {number} col
 * @returns {{ funcName: string, activeParameter: number } | null}
 */
function findActiveCall(lineText, col) {
  const before = lineText.slice(0, col);
  let depth = 0;
  let inString = false;

  for (let i = before.length - 1; i >= 0; i--) {
    const ch = before[i];

    if (ch === "'") inString = !inString;
    if (inString) continue;

    if (ch === ')') {
      depth++;
    } else if (ch === '(') {
      if (depth === 0) {
        // پیدا کردن نام تابع قبل از (
        const prefix = before.slice(0, i);
        const m = /([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(prefix);
        if (!m) return null;

        const funcName = m[1].toUpperCase();

        // شمارش کاما در آرگومان‌های فعلی (بعد از پرانتز باز)
        const argsText = before.slice(i + 1);
        let commas = 0;
        let str = false;
        for (const c of argsText) {
          if (c === "'") str = !str;
          if (!str && c === ',') commas++;
        }

        return { funcName, activeParameter: commas };
      }
      depth--;
    }
  }
  return null;
}

// ------------------------------------------------------------
// ثبت Provider
// ------------------------------------------------------------
function registerSignatureHelpProvider(context) {
  const provider = vscode.languages.registerSignatureHelpProvider(
    { language: 'gmo', scheme: 'file' },
    {
      /**
       * @param {vscode.TextDocument} document
       * @param {vscode.Position} position
       * @param {vscode.CancellationToken} token
       * @param {vscode.SignatureHelpContext} context
       * @returns {vscode.SignatureHelp | null}
       */
      provideSignatureHelp(document, position, token, context) {
        const lineText = document.lineAt(position.line).text;
        const active = findActiveCall(lineText, position.character);
        if (!active) return null;

        const sig = SIGNATURES[active.funcName];
        if (!sig) return null;

        // ساخت SignatureHelp
        const help = new vscode.SignatureHelp();

        const parameterInfos = sig.parameters.map((p) => {
          const info = new vscode.ParameterInformation(
            p.label,
            new vscode.MarkdownString(p.documentation)
          );
          return info;
        });

        const signatureInfo = new vscode.SignatureInformation(
          sig.label,
          new vscode.MarkdownString(sig.documentation)
        );
        signatureInfo.parameters = parameterInfos;

        help.signatures = [signatureInfo];

        // تعیین پارامتر فعال (با محدودیت تعداد)
        help.activeSignature = 0;
        help.activeParameter = Math.min(
          active.activeParameter,
          parameterInfos.length - 1
        );

        return help;
      },
    },
    // triggerCharacters: با تایپ این کاراکترها Signature Help باز شود
    '(',
    ','
  );

  context.subscriptions.push(provider);
  return provider;
}

module.exports = { registerSignatureHelpProvider };
