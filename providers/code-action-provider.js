// code-action-provider.js
// ============================================================
// Code Actions (Quick Fix) برای GMO Strategy
//
// پشتیبانی از Quick Fix برای کدهای تشخیصی:
//   ساختاری:
//     - missing-end → افزودن END در انتهای فایل
//     - missing-strategy → افزودن STRATEGY
//     - missing-version → افزودن VERSION 1.0 بعد از STRATEGY
//     - invalid-token → جایگزینی با placeholder 64 hex
//   پارامترها:
//     - undefined-param → تعریف خودکار در PARAMETERS
//     - duplicate-param → حذف خط تکراری
//     - empty-param-expr → افزودن FIELD(0) به‌عنوان مقدار پیش‌فرض
//   قوانین:
//     - missing-g → افزودن G به مقدار
//     - missing-arrow → درج -> در محل مناسب
//     - invalid-last-datetime → افزودن واحد H (پیش‌فرض)
//     - unknown-function → (بدون Quick Fix — نیاز به دانش دامنه)
//
// همچنین Code Actions سفارشی (بدون Diagnostic):
//   - Convert to token block (تبدیل استراتژی معمولی به بلوک توکن)
//   - Add missing standard PARAMETERS
// ============================================================

'use strict';

const vscode = require('vscode');
const parser = require('../parser');
const C = require('../codes');

// ------------------------------------------------------------
// کمک‌تابع: Range روی یک خط کامل
// ------------------------------------------------------------
function fullLineRange(document, line) {
  return new vscode.Range(line, 0, line, document.lineAt(line).text.length);
}

// ------------------------------------------------------------
// کمک‌تابع: ساخت CodeAction با edit و diagnostics
// ------------------------------------------------------------
function mkAction(title, kind, diag, edit, isPreferred) {
  const action = new vscode.CodeAction(title, kind);
  if (diag) action.diagnostics = [diag];
  if (edit) action.edit = edit;
  if (isPreferred) action.isPreferred = true;
  return action;
}

// ------------------------------------------------------------
// ثبت Provider
// ------------------------------------------------------------
function registerCodeActionProvider(context) {
  const provider = vscode.languages.registerCodeActionsProvider(
    { language: 'gmo', scheme: 'file' },
    {
      /**
       * @param {vscode.TextDocument} document
       * @param {vscode.Range | vscode.Selection} range
       * @param {vscode.CodeActionContext} codeActionContext
       * @param {vscode.CancellationToken} token
       * @returns {vscode.CodeAction[]}
       */
      provideCodeActions(document, range, codeActionContext, token) {
        const actions = [];
        const parsed = parser.parseDocument(document.getText());

        // ======================================================
        // بخش ۱: Quick Fix برای Diagnosticهای موجود
        // ======================================================
        for (const diag of codeActionContext.diagnostics) {
          const code = diag.code;

          // ----------------------------------------------------
          // missing-end → افزودن END
          // ----------------------------------------------------
          if (code === C.CODE_MISSING_END) {
            const edit = new vscode.WorkspaceEdit();
            const lastLine = document.lineCount - 1;
            const lastLineText = document.lineAt(lastLine).text;
            const pos = new vscode.Position(lastLine, lastLineText.length);
            const prefix = lastLineText.trim() === '' ? '' : '\n';
            edit.insert(document.uri, pos, prefix + '\nEND');

            actions.push(
              mkAction(
                'افزودن END در انتهای فایل',
                vscode.CodeActionKind.QuickFix,
                diag,
                edit,
                true
              )
            );
          }

          // ----------------------------------------------------
          // missing-strategy → افزودن STRATEGY
          // ----------------------------------------------------
          if (code === C.CODE_MISSING_STRATEGY) {
            const edit = new vscode.WorkspaceEdit();
            const pos = new vscode.Position(0, 0);
            edit.insert(document.uri, pos, 'STRATEGY MyStrategy\n');

            actions.push(
              mkAction(
                'افزودن STRATEGY MyStrategy در ابتدای فایل',
                vscode.CodeActionKind.QuickFix,
                diag,
                edit,
                true
              )
            );
          }

          // ----------------------------------------------------
          // missing-version → افزودن VERSION 1.0
          // ----------------------------------------------------
          if (code === C.CODE_MISSING_VERSION) {
            const edit = new vscode.WorkspaceEdit();

            const stratHeader = parsed.headers.find(
              (h) => h.keyword === 'STRATEGY'
            );

            let insertLine;
            if (stratHeader) {
              insertLine = stratHeader.line + 1;
            } else {
              insertLine = 0;
            }

            const pos = new vscode.Position(insertLine, 0);
            edit.insert(document.uri, pos, 'VERSION 1.0\n\n');

            actions.push(
              mkAction(
                'افزودن VERSION 1.0',
                vscode.CodeActionKind.QuickFix,
                diag,
                edit,
                true
              )
            );
          }

          // ----------------------------------------------------
          // invalid-token → جایگزینی با placeholder
          // ----------------------------------------------------
          if (code === C.CODE_INVALID_TOKEN) {
            const edit = new vscode.WorkspaceEdit();
            edit.replace(
              document.uri,
              diag.range,
              'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'
            );

            actions.push(
              mkAction(
                'جایگزینی با placeholder معتبر (64 hex)',
                vscode.CodeActionKind.QuickFix,
                diag,
                edit,
                true
              )
            );

            // گزینهٔ دوم: حذف کامل خط TOKEN
            const edit2 = new vscode.WorkspaceEdit();
            const line = diag.range.start.line;
            const lineText = document.lineAt(line).text;
            // حذف خط به‌همراه newline
            const deleteEnd = new vscode.Position(line, lineText.length);
            const deleteStart = new vscode.Position(line, 0);
            edit2.delete(
              document.uri,
              new vscode.Range(deleteStart, deleteEnd)
            );

            actions.push(
              mkAction(
                'حذف خط TOKEN نامعتبر',
                vscode.CodeActionKind.QuickFix,
                diag,
                edit2,
                false
              )
            );
          }

          // ----------------------------------------------------
          // undefined-param → تعریف خودکار در PARAMETERS
          // ----------------------------------------------------
          if (code === C.CODE_UNDEFINED_PARAM) {
            const word = document.getText(diag.range);

            const edit = new vscode.WorkspaceEdit();

            if (parsed.parameters.length > 0) {
              const lastParam = parsed.parameters[parsed.parameters.length - 1];
              const insertLine = lastParam.line + 1;
              const insertPos = new vscode.Position(insertLine, 0);

              const maxNameLen = Math.max(
                ...parsed.parameters.map((p) => p.name.length),
                word.length
              );
              const pad = ' '.repeat(maxNameLen - word.length);
              const newLine =
                '  ' + word + pad + ' = FIELD(0)  // TODO: تعریف دقیق\n';

              edit.insert(document.uri, insertPos, newLine);
            } else {
              // اگر PARAMETERS وجود ندارد، آن را بساز
              const paramsSection = parsed.sections.find(
                (s) => s.name === 'PARAMETERS'
              );
              if (paramsSection) {
                const insertPos = new vscode.Position(
                  paramsSection.line + 1,
                  0
                );
                edit.insert(
                  document.uri,
                  insertPos,
                  '  ' + word + ' = FIELD(0)  // TODO: تعریف دقیق\n'
                );
              } else {
                // ساخت PARAMETERS از صفر بعد از VERSION
                const versionHeader = parsed.headers.find(
                  (h) => h.keyword === 'VERSION'
                );
                const insertLine = versionHeader ? versionHeader.line + 1 : 1;
                const insertPos = new vscode.Position(insertLine, 0);
                edit.insert(
                  document.uri,
                  insertPos,
                  '\nPARAMETERS:\n  ' + word + ' = FIELD(0)  // TODO\n\n'
                );
              }
            }

            actions.push(
              mkAction(
                'تعریف خودکار «' + word + '» در PARAMETERS',
                vscode.CodeActionKind.QuickFix,
                diag,
                edit,
                true
              )
            );
          }

          // ----------------------------------------------------
          // duplicate-param → حذف خط تکراری
          // ----------------------------------------------------
          if (code === C.CODE_DUPLICATE_PARAM) {
            const line = diag.range.start.line;
            const lineText = document.lineAt(line).text;

            // پیدا کردن پارامتر تکراری
            const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(lineText);
            const dupName = m ? m[1] : null;

            const edit = new vscode.WorkspaceEdit();
            // حذف کل خط
            const start = new vscode.Position(line, 0);
            const end = new vscode.Position(line, lineText.length);
            edit.delete(document.uri, new vscode.Range(start, end));

            // حذف newline بعدی اگر وجود دارد
            if (line < document.lineCount - 1) {
              const nextStart = new vscode.Position(line, 0);
              const nextEnd = new vscode.Position(line + 1, 0);
              edit.delete(document.uri, new vscode.Range(nextStart, nextEnd));
            }

            actions.push(
              mkAction(
                'حذف خط پارامتر تکراری' + (dupName ? ' «' + dupName + '»' : ''),
                vscode.CodeActionKind.QuickFix,
                diag,
                edit,
                true
              )
            );
          }

          // ----------------------------------------------------
          // empty-param-expr → افزودن FIELD(0) به‌عنوان مقدار پیش‌فرض
          // ----------------------------------------------------
          if (code === C.CODE_EMPTY_PARAM_EXPR) {
            const line = diag.range.start.line;
            const lineText = document.lineAt(line).text;
            const eqIdx = lineText.indexOf('=');

            if (eqIdx >= 0) {
              const edit = new vscode.WorkspaceEdit();
              const insertPos = new vscode.Position(line, eqIdx + 1);
              edit.insert(document.uri, insertPos, ' FIELD(0)');

              actions.push(
                mkAction(
                  'افزودن FIELD(0) به‌عنوان مقدار پیش‌فرض',
                  vscode.CodeActionKind.QuickFix,
                  diag,
                  edit,
                  true
                )
              );
            }
          }

          // ----------------------------------------------------
          // missing-g → افزودن G به مقدار
          // ----------------------------------------------------
          if (code === C.CODE_MISSING_G) {
            const text = document.getText(diag.range);

            // حالت ۱: فقط عدد (مثلاً 1)
            const edit = new vscode.WorkspaceEdit();
            edit.replace(document.uri, diag.range, text + 'G');
            actions.push(
              mkAction(
                'افزودن G به «' + text + '»',
                vscode.CodeActionKind.QuickFix,
                diag,
                edit,
                true
              )
            );

            // حالت ۲: اگر source:value است، فقط value را اصلاح کن
            const colonIdx = text.lastIndexOf(':');
            if (colonIdx >= 0) {
              const valuePart = text.slice(colonIdx + 1).trim();
              if (!/G$/i.test(valuePart)) {
                const edit2 = new vscode.WorkspaceEdit();
                const newText = text.slice(0, colonIdx + 1) + valuePart + 'G';
                edit2.replace(document.uri, diag.range, newText);
                actions.push(
                  mkAction(
                    'افزودن G فقط به مقدار',
                    vscode.CodeActionKind.QuickFix,
                    diag,
                    edit2,
                    false
                  )
                );
              }
            }
          }

          // ----------------------------------------------------
          // missing-arrow → درج -> در محل مناسب
          // ----------------------------------------------------
          if (code === C.CODE_MISSING_ARROW) {
            const line = diag.range.start.line;
            const lineText = document.lineAt(line).text;

            // پیدا کردن اولین فاصله بعد از سیگنال یا بعد از BUY/SELL
            // استراتژی: درج -> بعد از اولین سیگنال (GREEN/BLUE/RED/YELLOW)
            let insertCol = -1;

            const signalMatch = /\b(GREEN|BLUE|RED|YELLOW)\b/i.exec(lineText);
            if (signalMatch) {
              insertCol = signalMatch.index + signalMatch[0].length;
            } else {
              insertCol = lineText.length;
            }

            const edit = new vscode.WorkspaceEdit();
            const insertPos = new vscode.Position(line, insertCol);
            edit.insert(document.uri, insertPos, ' -> ');

            actions.push(
              mkAction(
                'درج «->» بعد از سیگنال',
                vscode.CodeActionKind.QuickFix,
                diag,
                edit,
                true
              )
            );
          }

          // ----------------------------------------------------
          // invalid-last-datetime → افزودن واحد H (پیش‌فرض)
          // ----------------------------------------------------
          if (code === C.CODE_INVALID_LAST_DATETIME) {
            const text = document.getText(diag.range);

            // اگر فقط عدد است (بدون واحد)
            if (/^-?\d+(\.\d+)?$/.test(text)) {
              const edit = new vscode.WorkspaceEdit();
              edit.replace(document.uri, diag.range, text + 'H');
              actions.push(
                mkAction(
                  'افزودن واحد H (ساعت) به «' + text + '»',
                  vscode.CodeActionKind.QuickFix,
                  diag,
                  edit,
                  true
                )
              );

              // جایگزین‌های دیگر
              const edit2 = new vscode.WorkspaceEdit();
              edit2.replace(document.uri, diag.range, text + 'D');
              actions.push(
                mkAction(
                  'افزودن واحد D (روز) به «' + text + '»',
                  vscode.CodeActionKind.QuickFix,
                  diag,
                  edit2,
                  false
                )
              );

              const edit3 = new vscode.WorkspaceEdit();
              edit3.replace(document.uri, diag.range, text + 'M');
              actions.push(
                mkAction(
                  'افزودن واحد M (دقیقه) به «' + text + '»',
                  vscode.CodeActionKind.QuickFix,
                  diag,
                  edit3,
                  false
                )
              );
            }
          }
        }

        // ======================================================
        // بخش ۲: Code Actionهای سفارشی (بدون Diagnostic)
        // ======================================================

        // ------------------------------------------------------
        // اگر روی یک استراتژی معمولی هستیم → «تبدیل به بلوک توکن»
        // ------------------------------------------------------
        if (
          parsed.strategyName &&
          !parsed.isTokenBlock &&
          parsed.endLine !== null
        ) {
          const edit = new vscode.WorkspaceEdit();

          // VERSION را به token تغییر بده
          const versionHeader = parsed.headers.find(
            (h) => h.keyword === 'VERSION'
          );

          if (versionHeader) {
            const lineText = document.lineAt(versionHeader.line).text;
            edit.replace(
              document.uri,
              fullLineRange(document, versionHeader.line),
              'VERSION token\nREVISION: ' + (versionHeader.value || '1.0')
            );
          }

          // TOKEN را بعد از DESCRIPTION یا قبل از PARAMETERS/RULES اضافه کن
          const descHeader = parsed.headers.find(
            (h) => h.keyword === 'DESCRIPTION'
          );
          const insertLine = descHeader
            ? descHeader.line + 1
            : versionHeader
              ? versionHeader.line + 1
              : 2;

          edit.insert(
            document.uri,
            new vscode.Position(insertLine, 0),
            '\nPUBLISHER: 0000***0000\n\nTOKEN: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2\n'
          );

          actions.push(
            mkAction(
              'تبدیل به بلوک توکن (Strategy Hub)',
              vscode.CodeActionKind.RefactorRewrite,
              null,
              edit,
              false
            )
          );
        }

        // ------------------------------------------------------
        // اگر PARAMETERS خالی است → «افزودن پارامترهای استاندارد»
        // ------------------------------------------------------
        if (parsed.parameters.length === 0 && parsed.strategyName) {
          const edit = new vscode.WorkspaceEdit();

          const paramsSection = parsed.sections.find(
            (s) => s.name === 'PARAMETERS'
          );
          const rulesSection = parsed.sections.find((s) => s.name === 'RULES');

          const block =
            '  SIGNAL     = FIELD(0)\n' +
            '  CONFIDENCE = FIELD(1)\n' +
            "  DATETIME   = FIELD(2) + ' ' + FIELD(4)\n" +
            '  PRICE      = FIELD(5)\n' +
            '  GMOML      = FIELD(6)\n' +
            '  MARKET     = FIELD(7)\n' +
            '  FACTOR     = FIELD(8)\n' +
            '  TRADERS    = FIELD(9)\n' +
            '  PIVOTPOINT = FIELD(10)\n';

          if (paramsSection) {
            edit.insert(
              document.uri,
              new vscode.Position(paramsSection.line + 1, 0),
              block
            );
          } else if (rulesSection) {
            // ساخت PARAMETERS قبل از RULES
            edit.insert(
              document.uri,
              new vscode.Position(rulesSection.line, 0),
              'PARAMETERS:\n' + block + '\n'
            );
          } else if (parsed.endLine !== null) {
            edit.insert(
              document.uri,
              new vscode.Position(parsed.endLine, 0),
              '\nPARAMETERS:\n' + block + '\n'
            );
          }

          actions.push(
            mkAction(
              'افزودن پارامترهای استاندارد',
              vscode.CodeActionKind.Refactor,
              null,
              edit,
              false
            )
          );
        }

        return actions;
      },
    },
    {
      providedCodeActionKinds: [
        vscode.CodeActionKind.QuickFix,
        vscode.CodeActionKind.Refactor,
        vscode.CodeActionKind.RefactorRewrite,
      ],
    }
  );

  context.subscriptions.push(provider);
  return provider;
}

module.exports = {
  registerCodeActionProvider,
};
