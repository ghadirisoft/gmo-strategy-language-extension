// inlay-hints-provider.js
// ============================================================
// Inlay Hints Provider برای GMO Strategy
//
// رفتار:
//   ۱. کنار FIELD(n) → نمایش معنی فیلد (مثلاً «اعتماد»)
//   ۲. کنار LAST_* / MIN_* / MAX_* / AVG_* → نمایش نوع خروجی
//      (مثلاً «عدد» یا «تاریخ»)
//   ۳. کنار سیگنال‌ها در RULES → نمایش رنگ/معنی
//      (اختیاری، ممکن است شلوغ کند)
//   ۴. کنار پارامترها در PARAMETERS → نمایش نوع مقدار
//      (مثلاً «عدد» برای FIELD(1)، «رشته» برای DATETIME)
//
// فعال/غیرفعال: از تنظیمات editor.inlayHints.enabled
// ============================================================

'use strict';

const vscode = require('vscode');
const parser = require('../parser');

// ------------------------------------------------------------
// دیکشنری‌ها
// ------------------------------------------------------------

const FIELD_MEANINGS = {
  0: 'سیگنال',
  1: 'اعتماد',
  2: 'تاریخ',
  3: 'تاریخ شمسی',
  4: 'ساعت',
  5: 'قیمت',
  6: 'GmoML',
  7: 'بازار',
  8: 'عامل',
  9: 'معامله‌گران',
  10: 'سطوح محوری',
};

// نوع خروجی توابع آماری
const FUNCTION_RETURN_TYPES = {
  FIELD: '?', // بستگی به index دارد
  LAST_CONFIDENCE: 'عدد',
  LAST_PRICE: 'عدد',
  LAST_DATETIME: 'تاریخ',
  MIN_CONFIDENCE: 'عدد',
  MIN_PRICE: 'عدد',
  MAX_CONFIDENCE: 'عدد',
  MAX_PRICE: 'عدد',
  AVG_CONFIDENCE: 'عدد',
  AVG_PRICE: 'عدد',
};

// نوع پارامترها (بر اساس عبارت)
const EXPR_TYPE_HINTS = [
  { re: /^FIELD\(0\)$/i, type: 'رشته' },
  { re: /^FIELD\([1-8]\)$/i, type: 'عدد' },
  { re: /^FIELD\(2\)\s*\+\s*' '\s*\+\s*FIELD\(4\)$/i, type: 'تاریخ+ساعت' },
  { re: /^FIELD\(3\)$/i, type: 'رشته' },
  { re: /^FIELD\(9\)$/i, type: 'عدد' },
  { re: /^FIELD\(10\)$/i, type: 'عدد' },
  { re: /^FIELD\([0-8]\)\s*[+\-*/]/i, type: 'ترکیب' },
  { re: /^(LAST|MIN|MAX|AVG)_/i, type: 'عدد' },
  { re: /^LAST_DATETIME\s*\(/i, type: 'تاریخ' },
  { re: /^['"]/, type: 'رشته' },
  { re: /^\d+(\.\d+)?$/, type: 'عدد' },
];

// ------------------------------------------------------------
// کمک‌تابع: نوع عبارت
// ------------------------------------------------------------
function inferExprType(expr) {
  const trimmed = expr.trim();
  for (const h of EXPR_TYPE_HINTS) {
    if (h.re.test(trimmed)) return h.type;
  }
  return null;
}

// ------------------------------------------------------------
// ثبت Provider
// ------------------------------------------------------------
function registerInlayHintsProvider(context) {
  const provider = vscode.languages.registerInlayHintsProvider(
    { language: 'gmo', scheme: 'file' },
    {
      /**
       * @param {vscode.TextDocument} document
       * @param {vscode.Range} range
       * @param {vscode.CancellationToken} token
       * @returns {vscode.InlayHint[]}
       */
      provideInlayHints(document, range, token) {
        const cfg = vscode.workspace.getConfiguration('gmo.inlayHints');
        const showFieldMeaning = cfg.get('showFieldMeaning', true);
        const showReturnType = cfg.get('showReturnType', true);
        const showParamType = cfg.get('showParamType', true);

        const hints = [];
        const text = document.getText();
        const parsed = parser.parseDocument(text);
        const lines = text.split(/\r?\n/);

        // ======================================================
        // ۱. FIELD(n) → معنی فیلد
        // ======================================================
        if (showFieldMeaning) {
          const fieldRe = /\bFIELD\s*\(\s*(\d+)\s*\)/gi;
          for (let i = 0; i < lines.length; i++) {
            const lineText = lines[i];
            // اگر خط داخل range نیست، رد شو
            if (i < range.start.line || i > range.end.line) {
              continue;
            }

            let m;
            while ((m = fieldRe.exec(lineText)) !== null) {
              const idx = parseInt(m[1], 10);
              const meaning = FIELD_MEANINGS[idx];
              if (meaning) {
                const endCol = m.index + m[0].length;
                hints.push(
                  new vscode.InlayHint(
                    new vscode.Position(i, endCol),
                    ' ' + meaning,
                    vscode.InlayHintKind.Type
                  )
                );
              }
            }
          }
        }

        // ======================================================
        // ۲. توابع آماری → نوع خروجی
        // ======================================================
        if (showReturnType) {
          const fnNames = Object.keys(FUNCTION_RETURN_TYPES).filter(
            (n) => n !== 'FIELD'
          );
          const fnRe = new RegExp(
            '\\b(' + fnNames.join('|') + ')\\s*\\([^)]*\\)',
            'gi'
          );

          for (let i = 0; i < lines.length; i++) {
            if (i < range.start.line || i > range.end.line) continue;

            const lineText = lines[i];
            let m;
            while ((m = fnRe.exec(lineText)) !== null) {
              const fnName = m[1].toUpperCase();
              const retType = FUNCTION_RETURN_TYPES[fnName];
              if (retType) {
                const endCol = m.index + m[0].length;
                hints.push(
                  new vscode.InlayHint(
                    new vscode.Position(i, endCol),
                    ' → ' + retType,
                    vscode.InlayHintKind.Type
                  )
                );
              }
            }
          }
        }

        // ======================================================
        // ۳. پارامترها → نوع مقدار (کنار =)
        // ======================================================
        if (showParamType) {
          for (const p of parsed.parameters) {
            // اگر خط پارامتر در range نیست، رد شو
            if (p.line < range.start.line || p.line > range.end.line) {
              continue;
            }

            const type = inferExprType(p.expr);
            if (!type) continue;

            // موقعیت: بعد از عبارت (انتهای خط)
            const lineText = lines[p.line];
            const exprIdx = lineText.indexOf(p.expr);
            if (exprIdx < 0) continue;
            const endCol = exprIdx + p.expr.length;

            hints.push(
              new vscode.InlayHint(
                new vscode.Position(p.line, endCol),
                ' : ' + type,
                vscode.InlayHintKind.Type
              )
            );
          }
        }

        // ======================================================
        // ۴. تزئین: padding برای خوانایی
        // ======================================================
        for (const h of hints) {
          h.paddingLeft = false;
          h.paddingRight = false;
        }

        return hints;
      },
    }
  );

  context.subscriptions.push(provider);
  return provider;
}

module.exports = { registerInlayHintsProvider };
