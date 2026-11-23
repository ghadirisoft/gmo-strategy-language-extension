// folding-provider.js
// ============================================================
// Folding Range Provider برای GMO Strategy
//
// رفتار:
//   - PARAMETERS: → یک folding range تا خط قبل از RULES
//   - RULES: → یک folding range تا خط قبل از END
//   - STRATEGY (کل استراتژی) → folding از STRATEGY تا END
//   - بلوک توکن (VERSION token ... END) → یک folding
//   - کامنت‌های پشت سر هم (// ...) → folding
//   - قوانین چندخطی (اگر با \ ادامه یابند) → folding (اختیاری)
//
// کلید میانبر: Ctrl+Shift+[ (بستن) / Ctrl+Shift+] (باز کردن)
// ============================================================

'use strict';

const vscode = require('vscode');
const parser = require('../parser');

// ------------------------------------------------------------
// ثبت Provider
// ------------------------------------------------------------
function registerFoldingProvider(context) {
  const provider = vscode.languages.registerFoldingRangeProvider(
    { language: 'gmo', scheme: 'file' },
    {
      /**
       * @param {vscode.TextDocument} document
       * @param {vscode.CancellationToken} token
       * @returns {vscode.FoldingRange[]}
       */
      provideFoldingRanges(document, token) {
        const parsed = parser.parseDocument(document.getText());
        const lines = document.getText().split(/\r?\n/);
        const ranges = [];

        // ======================================================
        // ۱. STRATEGY → END (کل استراتژی)
        // ======================================================
        const stratHeader = parsed.headers.find(
          (h) => h.keyword === 'STRATEGY'
        );
        if (stratHeader && parsed.endLine !== null) {
          ranges.push(
            new vscode.FoldingRange(
              stratHeader.line,
              parsed.endLine,
              vscode.FoldingRangeKind.Region
            )
          );
        }

        // ======================================================
        // ۲. PARAMETERS: → تا خط قبل از RULES
        // ======================================================
        const paramsSection = parsed.sections.find(
          (s) => s.name === 'PARAMETERS'
        );
        const rulesSection = parsed.sections.find((s) => s.name === 'RULES');

        if (paramsSection) {
          // انتهای PARAMETERS: خط قبل از RULES، یا قبل از END
          let endLine;
          if (rulesSection) {
            endLine = rulesSection.line - 1;
          } else if (parsed.endLine !== null) {
            endLine = parsed.endLine - 1;
          } else {
            endLine = lines.length - 1;
          }

          // فقط اگر حداقل یک خط محتوا دارد
          if (endLine > paramsSection.line) {
            // حذف خطوط خالی انتهایی
            while (endLine > paramsSection.line && lines[endLine].trim() === '') {
              endLine--;
            }
            if (endLine > paramsSection.line) {
              ranges.push(
                new vscode.FoldingRange(
                  paramsSection.line,
                  endLine,
                  vscode.FoldingRangeKind.Region
                )
              );
            }
          }
        }

        // ======================================================
        // ۳. RULES: → تا خط قبل از END
        // ======================================================
        if (rulesSection) {
          let endLine;
          if (parsed.endLine !== null) {
            endLine = parsed.endLine - 1;
          } else {
            endLine = lines.length - 1;
          }

          if (endLine > rulesSection.line) {
            while (endLine > rulesSection.line && lines[endLine].trim() === '') {
              endLine--;
            }
            if (endLine > rulesSection.line) {
              ranges.push(
                new vscode.FoldingRange(
                  rulesSection.line,
                  endLine,
                  vscode.FoldingRangeKind.Region
                )
              );
            }
          }
        }

        // ======================================================
        // ۴. بلوک توکن (VERSION token → END)
        // ======================================================
        if (parsed.isTokenBlock && parsed.endLine !== null) {
          const versionHeader = parsed.headers.find(
            (h) => h.keyword === 'VERSION'
          );
          if (versionHeader && parsed.endLine > versionHeader.line) {
            // به‌عنوان Comment (نه Region) تا با STRATEGY تداخل نکند
            ranges.push(
              new vscode.FoldingRange(
                versionHeader.line,
                parsed.endLine,
                vscode.FoldingRangeKind.Comment
              )
            );
          }
        }

        // ======================================================
        // ۵. کامنت‌های پشت سر هم (// ...)
        // ======================================================
        let commentStart = -1;
        for (let i = 0; i < lines.length; i++) {
          const trimmed = lines[i].trim();
          const isComment = trimmed.startsWith('//');

          if (isComment && commentStart === -1) {
            commentStart = i;
          } else if (!isComment && commentStart !== -1) {
            // پایان بلوک کامنت
            if (i - commentStart >= 2) {
              // حداقل ۲ خط کامنت
              ranges.push(
                new vscode.FoldingRange(
                  commentStart,
                  i - 1,
                  vscode.FoldingRangeKind.Comment
                )
              );
            }
            commentStart = -1;
          }
        }
        // بلوک کامنت تا انتهای فایل
        if (commentStart !== -1 && lines.length - commentStart >= 2) {
          ranges.push(
            new vscode.FoldingRange(
              commentStart,
              lines.length - 1,
              vscode.FoldingRangeKind.Comment
            )
          );
        }

        // ======================================================
        // ۶. قوانین چندخطی با \ (اگر پشتیبانی شود)
        // ======================================================
        // اگر یک قانون با \ در انتهای خط ادامه یابد
        for (const rule of parsed.rules) {
          let endLine = rule.line;
          while (
            endLine < lines.length - 1 &&
            lines[endLine].trimEnd().endsWith('\\')
          ) {
            endLine++;
          }
          if (endLine > rule.line) {
            ranges.push(
              new vscode.FoldingRange(
                rule.line,
                endLine,
                vscode.FoldingRangeKind.Region
              )
            );
          }
        }

        return ranges;
      },
    }
  );

  context.subscriptions.push(provider);
  return provider;
}

module.exports = { registerFoldingProvider };