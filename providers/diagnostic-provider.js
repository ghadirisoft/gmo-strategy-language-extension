// diagnostic-provider.js
// ============================================================
// Diagnostics (خطایابی زنده) برای GMO Strategy
//
// قواعد بررسی‌شده:
//   ساختاری:
//     1. END فراموش‌شده
//     2. STRATEGY یافت نشد
//     3. VERSION یافت نشد
//     4. VERSION نامعتبر (نه token، نه عدد)
//     5. TOKEN با فرمت نامعتبر (نه ۶۴ hex)
//     6. بلوک توکن بدون TOKEN
//
//   پارامترها:
//     7. نام پارامتر تکراری
//     8. نام پارامتر نامعتبر (شبیه کلمه رزرو)
//     9. عبارت پارامتر خالی
//
//   قوانین:
//     10. پارامتر تعریف‌نشده در RULES
//     11. تابع ناشناخته در RULES
//     12. LAST_DATETIME با value نامعتبر
//     13. BUY/SELL بدون واحد G
//     14. آرگومان‌های نامعتبر BUY/SELL (ساختار source:value)  ← جدید
//     15. قانون بدون ->
//     16. قانون بدون سیگنال
//     17. قانون بدون اکشن
//
//   هشدارها:
//     18. GmoML متناقض با نوع سیگنال
//     19. MARKET متناقض با نوع سیگنال
//     20. قانون غیرقابل‌دسترس (بعد از یک قانون بدون شرط برای همان سیگنال)
// ============================================================

'use strict';

const vscode = require('vscode');
const parser = require('../parser');
const C = require('../codes');

// ------------------------------------------------------------
// کمک‌تابع: ساخت Diagnostic با code
// ------------------------------------------------------------
function mkDiag(range, message, severity, code) {
  const d = new vscode.Diagnostic(range, message, severity);
  if (code) d.code = code;
  d.source = 'gmo';
  return d;
}

// ------------------------------------------------------------
// کمک‌تابع: Range روی یک خط کامل
// ------------------------------------------------------------
function fullLineRange(document, line) {
  return new vscode.Range(
    line,
    0,
    line,
    document.lineAt(line).text.length
  );
}

// ------------------------------------------------------------
// کمک‌تابع: Range روی یک کلمه در یک خط
// ------------------------------------------------------------
function wordRange(document, line, col, len) {
  const lineLen = document.lineAt(line).text.length;
  const safeCol = Math.max(0, Math.min(col, lineLen));
  const safeEnd = Math.max(safeCol, Math.min(col + len, lineLen));
  return new vscode.Range(line, safeCol, line, safeEnd);
}

// ------------------------------------------------------------
// کمک‌تابع: تجزیهٔ آرگومان‌های BUY/SELL
//   ورودی: محتوای داخل پرانتز (بدون پرانتز)
//   خروجی: آرایه‌ای از { raw, source, value, hasColon, colons, error }
//     error: null | 'multiple-colons' | 'empty-source' | 'empty-value'
// ------------------------------------------------------------
function parseActionArgs(argsText) {
  const result = [];
  if (!argsText || !argsText.trim()) return result;

  // جدا کردن با کاما در سطح بالا (نه داخل رشته)
  const parts = [];
  let current = '';
  let inString = false;
  for (let i = 0; i < argsText.length; i++) {
    const ch = argsText[i];
    if (ch === "'") inString = !inString;
    if (ch === ',' && !inString) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.length > 0 || parts.length > 0) {
    parts.push(current);
  }

  for (const rawPart of parts) {
    const raw = rawPart.trim();
    if (!raw) continue;

    const colons = (raw.match(/:/g) || []).length;
    let error = null;
    let source = null;
    let value = raw;

    if (colons > 1) {
      error = 'multiple-colons';
    } else if (colons === 1) {
      const idx = raw.indexOf(':');
      source = raw.slice(0, idx).trim();
      value = raw.slice(idx + 1).trim();
      if (!source) {
        error = 'empty-source';
      } else if (!value) {
        error = 'empty-value';
      }
    }

    result.push({ raw, source, value, hasColon: colons === 1, colons, error });
  }

  return result;
}

// ------------------------------------------------------------
// ثبت Provider
// ------------------------------------------------------------
function registerDiagnosticProvider(context) {
  const collection = vscode.languages.createDiagnosticCollection('gmo');
  context.subscriptions.push(collection);

  // ===== Debounce state =====
  let debounceTimer = null;
  let pendingDocument = null;

  // ----------------------------------------------------------
  // تابع اصلی بررسی
  // ----------------------------------------------------------
  function updateDiagnostics(document) {
    if (!document || document.languageId !== 'gmo') {
      if (document) collection.delete(document.uri);
      return;
    }

    // ===== بررسی تنظیمات =====
    const cfg = vscode.workspace.getConfiguration('gmo.diagnostics');
    if (!cfg.get('enabled', true)) {
      collection.delete(document.uri);
      return;
    }
    const showWarnings = cfg.get('showWarnings', true);

    const text = document.getText();
    const parsed = parser.parseDocument(text);
    const diags = [];

    // ==========================================================
    // بخش ۱: ساختاری
    // ==========================================================

    // ۱. END فراموش‌شده
    if (text.trim() && parsed.endLine === null) {
      const lastLine = Math.max(0, document.lineCount - 1);
      diags.push(
        mkDiag(
          fullLineRange(document, lastLine),
          'استراتژی با END بسته نشده است.',
          vscode.DiagnosticSeverity.Error,
          C.CODE_MISSING_END
        )
      );
    }

    // ۲. STRATEGY یافت نشد
    if (!parsed.strategyName) {
      diags.push(
        mkDiag(
          fullLineRange(document, 0),
          'خط STRATEGY <name> یافت نشد.',
          vscode.DiagnosticSeverity.Error,
          C.CODE_MISSING_STRATEGY
        )
      );
    }

    // ۳. VERSION یافت نشد
    if (!parsed.isTokenBlock && !parsed.strategyVersion) {
      diags.push(
        mkDiag(
          fullLineRange(document, 0),
          'خط VERSION <value> یافت نشد.',
          vscode.DiagnosticSeverity.Error,
          C.CODE_MISSING_VERSION
        )
      );
    }

    // ۴. VERSION نامعتبر
    for (const h of parsed.headers) {
      if (h.keyword !== 'VERSION') continue;
      const v = h.value;
      if (/^token\b/i.test(v)) continue; // بلوک توکن
      if (!/^\d+(\.\d+)*$/.test(v)) {
        const lineText = document.lineAt(h.line).text;
        const valIdx = lineText.indexOf(v);
        diags.push(
          mkDiag(
            wordRange(document, h.line, valIdx, v.length),
            'VERSION باید عدد باشد (مثلاً 1.0) یا "token" برای بلوک توکن.',
            vscode.DiagnosticSeverity.Warning,
            C.CODE_INVALID_VERSION
          )
        );
      }
    }

    // ۵ و ۶. TOKEN نامعتبر / بلوک توکن بدون TOKEN
    for (let i = 0; i < parsed.lines.length; i++) {
      const lineText = parsed.lines[i];
      const m = /^\s*token\s*:\s*(.*)$/i.exec(lineText);
      if (m) {
        const val = m[1].trim();
        if (!/^[a-fA-F0-9]{64}$/.test(val)) {
          const valIdx = lineText.indexOf(val);
          diags.push(
            mkDiag(
              wordRange(document, i, valIdx, Math.max(1, val.length)),
              'TOKEN باید ۶۴ کاراکتر hex باشد.',
              vscode.DiagnosticSeverity.Error,
              C.CODE_INVALID_TOKEN
            )
          );
        }
      }
    }
    if (parsed.isTokenBlock && !parsed.token) {
      diags.push(
        mkDiag(
          fullLineRange(document, 0),
          'بلوک توکن شناسایی شد اما TOKEN: <64 hex> یافت نشد.',
          vscode.DiagnosticSeverity.Warning,
          C.CODE_TOKEN_BLOCK_WITHOUT_TOKEN
        )
      );
    }

    // ==========================================================
    // بخش ۲: پارامترها
    // ==========================================================

    const paramNamesUpper = new Set();
    for (const p of parsed.parameters) {
      const upper = p.name.toUpperCase();

      // ۷. نام تکراری
      if (paramNamesUpper.has(upper)) {
        diags.push(
          mkDiag(
            wordRange(document, p.line, p.col, p.name.length),
            'پارامتر تکراری: ' + p.name,
            vscode.DiagnosticSeverity.Error,
            C.CODE_DUPLICATE_PARAM
          )
        );
      } else {
        paramNamesUpper.add(upper);
      }

      // ۸. نام نامعتبر (شبیه کلمه رزرو)
      if (
        parser.isSignal(upper) ||
        parser.isAction(upper) ||
        parser.isFunction(upper) ||
        parser.isKeyword(upper) ||
        parser.isLogicalOp(upper)
      ) {
        diags.push(
          mkDiag(
            wordRange(document, p.line, p.col, p.name.length),
            'نام «' + p.name + '» با کلمهٔ رزرو زبان تداخل دارد.',
            vscode.DiagnosticSeverity.Warning,
            C.CODE_INVALID_PARAM_NAME
          )
        );
      }

      // ۹. عبارت خالی
      if (!p.expr || p.expr.trim() === '') {
        diags.push(
          mkDiag(
            fullLineRange(document, p.line),
            'عبارت پارامتر «' + p.name + '» خالی است.',
            vscode.DiagnosticSeverity.Error,
            C.CODE_EMPTY_PARAM_EXPR
          )
        );
      }
    }

    // ==========================================================
    // بخش ۳: قوانین
    // ==========================================================

    // برای هشدار unreachable
    const seenUnconditional = new Set();

    for (const rule of parsed.rules) {
      const lineText = document.lineAt(rule.line).text;
      const trimmed = lineText.trim();
      if (!trimmed) continue;

      // --------------------------------------------------------
      // ۱۵. قانون بدون ->
      // --------------------------------------------------------
      const arrowIdx = trimmed.indexOf('->');
      if (arrowIdx < 0) {
        diags.push(
          mkDiag(
            fullLineRange(document, rule.line),
            'قانون باید شامل «->» باشد.',
            vscode.DiagnosticSeverity.Error,
            C.CODE_MISSING_ARROW
          )
        );
        continue;
      }

      const leftSide = trimmed.slice(0, arrowIdx).trim();
      const rightSide = trimmed.slice(arrowIdx + 2).trim();

      // --------------------------------------------------------
      // ۱۶. قانون بدون سیگنال (سمت چپ)
      // --------------------------------------------------------
      if (!leftSide) {
        diags.push(
          mkDiag(
            wordRange(document, rule.line, 0, arrowIdx),
            'سمت چپ قانون باید یک سیگنال باشد.',
            vscode.DiagnosticSeverity.Error,
            C.CODE_MISSING_SIGNAL
          )
        );
      }

      // --------------------------------------------------------
      // ۱۷. قانون بدون اکشن (سمت راست)
      // --------------------------------------------------------
      if (!rightSide) {
        diags.push(
          mkDiag(
            fullLineRange(document, rule.line),
            'سمت راست قانون باید شامل BUY یا SELL باشد.',
            vscode.DiagnosticSeverity.Error,
            C.CODE_MISSING_ACTION
          )
        );
        continue;
      }

      // --------------------------------------------------------
      // استخراج سیگنال از سمت چپ (اولین کلمه)
      // --------------------------------------------------------
      const signalMatch = /^\s*([A-Za-z_][A-Za-z0-9_]*)/.exec(leftSide);
      const signalName = signalMatch ? signalMatch[1].toUpperCase() : null;

      // --------------------------------------------------------
      // استخراج شرط (بعد از IF)
      // --------------------------------------------------------
      const ifMatch = /\bIF\b(.*)$/i.exec(rightSide);
      const conditionText = ifMatch ? ifMatch[1] : '';
      const hasCondition = !!ifMatch;

      // --------------------------------------------------------
      // ۲۰. هشدار unreachable
      // --------------------------------------------------------
      if (signalName && parser.isSignal(signalName)) {
        if (seenUnconditional.has(signalName)) {
          diags.push(
            mkDiag(
              fullLineRange(document, rule.line),
              'قانون غیرقابل‌دسترس: یک قانون بدون شرط برای ' +
                signalName +
                ' قبلاً تعریف شده است.',
              vscode.DiagnosticSeverity.Warning,
              C.CODE_UNREACHABLE_RULE
            )
          );
        }
        if (!hasCondition) {
          seenUnconditional.add(signalName);
        }
      }

      // --------------------------------------------------------
      // ۱۰ و ۱۱. پارامتر تعریف‌نشده / تابع ناشناخته در شرط
      // --------------------------------------------------------
      if (conditionText) {
        const idRe = /[A-Za-z_][A-Za-z0-9_]*/g;
        let im;
        while ((im = idRe.exec(conditionText)) !== null) {
          const id = im[0];
          const upper = id.toUpperCase();

          // رد کردن کلمات رزرو
          if (parser.isKeyword(upper)) continue;
          if (parser.isLogicalOp(upper)) continue;
          if (parser.isSignal(upper)) continue;
          if (parser.isAction(upper)) continue;
          if (parser.isFunction(upper)) continue;

          // رد کردن داخل رشته‌ها
          const before = conditionText.slice(0, im.index);
          const quotes = (before.match(/'/g) || []).length;
          if (quotes % 2 === 1) continue;

          // بعدش پرانتز باز است؟
          const after = conditionText.slice(im.index + id.length);
          const isCall = /^\s*\(/.test(after);

          // موقعیت واقعی در خط
          const condStartInLine = lineText.indexOf(conditionText);
          const colInLine = condStartInLine + im.index;

          if (isCall) {
            diags.push(
              mkDiag(
                wordRange(document, rule.line, colInLine, id.length),
                'تابع ناشناخته: ' + id,
                vscode.DiagnosticSeverity.Error,
                C.CODE_UNKNOWN_FUNCTION
              )
            );
          } else if (!paramNamesUpper.has(upper)) {
            diags.push(
              mkDiag(
                wordRange(document, rule.line, colInLine, id.length),
                'پارامتر تعریف‌نشده: ' + id + ' — ابتدا در PARAMETERS تعریف کنید.',
                vscode.DiagnosticSeverity.Error,
                C.CODE_UNDEFINED_PARAM
              )
            );
          }
        }
      }

      // --------------------------------------------------------
      // ۱۲. LAST_DATETIME با value نامعتبر
      // --------------------------------------------------------
      const lastDtRe = /LAST_DATETIME\s*\(\s*([^,()]+?)\s*,\s*([^(),]+?)\s*\)/gi;
      let ldm;
      while ((ldm = lastDtRe.exec(trimmed)) !== null) {
        const rawValue = ldm[2].trim();
        if (!/^-?\d+(\.\d+)?[MHD]$/.test(rawValue)) {
          const colStart = lineText.indexOf(ldm[0]) + ldm[0].indexOf(ldm[2]);
          diags.push(
            mkDiag(
              wordRange(document, rule.line, colStart, ldm[2].length),
              'value نامعتبر برای LAST_DATETIME. فرمت درست: عدد:واحد (مثلاً 36H، 3D، 90M).',
              vscode.DiagnosticSeverity.Error,
              C.CODE_INVALID_LAST_DATETIME
            )
          );
        }
      }

      // --------------------------------------------------------
      // ۱۳ و ۱۴. BUY/SELL — بررسی ساختار و واحد G
      // --------------------------------------------------------
      const actionRe = /\b(BUY|SELL)\s*\(([^)]*)\)/gi;
      let am;
      while ((am = actionRe.exec(trimmed)) !== null) {
        const actionName = am[1].toUpperCase();
        const argsText = am[2].trim();
        if (!argsText) continue;

        const argsStartInLine = lineText.indexOf(am[0]) + am[0].indexOf(am[2]);

        const parsedArgs = parseActionArgs(argsText);

        for (const arg of parsedArgs) {
          // محاسبه ستون دقیق این آرگومان در خط
          const partOffset = am[2].indexOf(arg.raw);
          const colStart = argsStartInLine + (partOffset >= 0 ? partOffset : 0);

          // ---- ۱۴. ساختار آرگومان نامعتبر ----
          if (arg.error) {
            let msg;
            if (arg.error === 'multiple-colons') {
              msg =
                actionName +
                ': آرگومان نامعتبر — فقط یک ":" بین source و value مجاز است.';
            } else if (arg.error === 'empty-source') {
              msg =
                actionName +
                ': منبع (source) خالی است. فرمت درست: SOURCE:value (مثلاً GREEN:1G).';
            } else if (arg.error === 'empty-value') {
              msg =
                actionName +
                ': مقدار (value) خالی است. فرمت درست: SOURCE:value (مثلاً GREEN:1G).';
            } else {
              msg = actionName + ': آرگومان نامعتبر.';
            }

            diags.push(
              mkDiag(
                wordRange(document, rule.line, colStart, arg.raw.length),
                msg,
                vscode.DiagnosticSeverity.Error,
                C.CODE_INVALID_ACTION_ARGS
              )
            );
            continue; // بررسی G را رد کن؛ ساختار خراب است
          }

          // ---- ۱۳. بررسی واحد G ----
          if (!/^\d+(\.\d+)?G$/i.test(arg.value)) {
            diags.push(
              mkDiag(
                wordRange(document, rule.line, colStart, arg.raw.length),
                actionName +
                  ' باید مقدار با واحد G داشته باشد (مثلاً 1G، 0.5G).',
                vscode.DiagnosticSeverity.Error,
                C.CODE_MISSING_G
              )
            );
          }
        }
      }

      // --------------------------------------------------------
      // ۱۸. هشدار GmoML متناقض (فقط اگر پارامتر GMOML تعریف شده باشد)
      // --------------------------------------------------------
      if (hasCondition && paramNamesUpper.has('GMOML') && signalName) {
        const gmomlMatch = /\bGMOML\b\s*=\s*([0-4])/i.exec(conditionText);
        if (gmomlMatch) {
          const gmomlVal = parseInt(gmomlMatch[1], 10);
          const conflicting =
            (signalName === 'GREEN' && (gmomlVal === 2 || gmomlVal === 4)) ||
            (signalName === 'BLUE' && (gmomlVal === 2 || gmomlVal === 4)) ||
            (signalName === 'RED' && (gmomlVal === 1 || gmomlVal === 3)) ||
            (signalName === 'YELLOW' && (gmomlVal === 1 || gmomlVal === 3));
          if (conflicting) {
            diags.push(
              mkDiag(
                fullLineRange(document, rule.line),
                'GmoML=' +
                  gmomlVal +
                  ' با سیگنال ' +
                  signalName +
                  ' متناقض است (هشدار).',
                vscode.DiagnosticSeverity.Warning,
                C.CODE_GMOML_CONFLICT
              )
            );
          }
        }
      }

      // --------------------------------------------------------
      // ۱۹. هشدار MARKET متناقض
      // --------------------------------------------------------
      if (hasCondition && paramNamesUpper.has('MARKET') && signalName) {
        const marketMatch = /\bMARKET\b\s*=\s*(-?1)/.exec(conditionText);
        if (marketMatch) {
          const marketVal = parseInt(marketMatch[1], 10);
          const conflicting =
            (signalName === 'GREEN' && marketVal === -1) ||
            (signalName === 'RED' && marketVal === 1);
          if (conflicting) {
            diags.push(
              mkDiag(
                fullLineRange(document, rule.line),
                'MARKET=' +
                  marketVal +
                  ' با سیگنال ' +
                  signalName +
                  ' متناقض است (هشدار).',
                vscode.DiagnosticSeverity.Warning,
                C.CODE_MARKET_CONFLICT
              )
            );
          }
        }
      }
    }

    // ==========================================================
    // فیلتر و ثبت
    // ==========================================================
    const finalDiags = showWarnings
      ? diags
      : diags.filter((d) => d.severity !== vscode.DiagnosticSeverity.Warning);

    collection.set(document.uri, finalDiags);
  }

  // ----------------------------------------------------------
  // Debounce
  // ----------------------------------------------------------
  function scheduleUpdate(document) {
    const ms = vscode.workspace
      .getConfiguration('gmo.diagnostics')
      .get('debounceMs', 250);
    pendingDocument = document;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const doc = pendingDocument;
      pendingDocument = null;
      debounceTimer = null;
      if (doc) updateDiagnostics(doc);
    }, Math.max(0, ms));
  }

  // ==========================================================
  // اجرای اولیه + رویدادها
  // ==========================================================
  vscode.workspace.textDocuments.forEach((d) => {
    if (d.languageId === 'gmo') updateDiagnostics(d);
  });

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (doc.languageId === 'gmo') updateDiagnostics(doc);
    }),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.languageId === 'gmo') scheduleUpdate(e.document);
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      collection.delete(doc.uri);
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('gmo.diagnostics')) {
        vscode.workspace.textDocuments.forEach((d) => {
          if (d.languageId === 'gmo') updateDiagnostics(d);
        });
      }
    })
  );

  // ==========================================================
  // دستور دستی: بررسی مجدد
  // ==========================================================
  context.subscriptions.push(
    vscode.commands.registerCommand('gmo.refreshDiagnostics', () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === 'gmo') {
        updateDiagnostics(editor.document);
        vscode.window.setStatusBarMessage(
          '$(check) GMO: Diagnostics به‌روزرسانی شد',
          2000
        );
      } else {
        vscode.window.showInformationMessage(
          'فایل فعال GMO نیست.'
        );
      }
    })
  );

  return collection;
}

module.exports = { registerDiagnosticProvider };