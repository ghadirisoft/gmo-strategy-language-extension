// rename-provider.js
// ============================================================
// Rename Symbol (F2) برای متغیرهای PARAMETERS
//
// رفتار:
//   - فقط نام پارامتر در تعریف و همهٔ استفاده‌ها را عوض می‌کند
//   - رشته‌ها، کامنت‌ها و سایر کلمات را دست نمی‌زند
//   - نام جدید باید با قاعدهٔ شناسه سازگار باشد
// ============================================================

'use strict';

const vscode = require('vscode');
const parser = require('../parser');

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * ثبت RenameProvider برای زبان gmo.
 * @param {vscode.ExtensionContext} context
 */
function registerRenameProvider(context) {
  const provider = vscode.languages.registerRenameProvider(
    { language: 'gmo', scheme: 'file' },
    {
      /**
       * آماده‌سازی تغییر نام: بررسی می‌کند آیا نام جدید مجاز است.
       * @param {vscode.TextDocument} document
       * @param {vscode.Position} position
       * @param {string} newName
       * @returns {vscode.WorkspaceEdit | null}
       * @throws {Error} اگر نام جدید نامعتبر باشد
       */
      prepareRename(document, position, token) {
        const wordRange = document.getWordRangeAtPosition(
          position,
          /[A-Za-z_][A-Za-z0-9_]*/
        );
        if (!wordRange) {
          throw new Error('روی یک شناسه کلیک کنید.');
        }

        const word = document.getText(wordRange);

        if (
          parser.isSignal(word) ||
          parser.isAction(word) ||
          parser.isFunction(word) ||
          parser.isKeyword(word) ||
          parser.isLogicalOp(word)
        ) {
          throw new Error('«' + word + '» یک کلمهٔ رزرو است و قابل تغییر نام نیست.');
        }

        const parsed = parser.parseDocument(document.getText());
        const param = parser.findParameter(parsed, word);
        if (!param) {
          throw new Error('«' + word + '» یک متغیر PARAMETERS نیست.');
        }

        return wordRange;
      },

      /**
       * اعمال تغییر نام روی تعریف و همهٔ استفاده‌ها.
       * @param {vscode.TextDocument} document
       * @param {vscode.Position} position
       * @param {string} newName
       * @param {vscode.CancellationToken} token
       * @returns {vscode.WorkspaceEdit | null}
       */
      provideRenameEdits(document, position, newName, token) {
        if (!IDENTIFIER_RE.test(newName)) {
          throw new Error(
            'نام جدید نامعتبر است. باید با حرف یا _ شروع شود و فقط شامل حروف، اعداد و _ باشد.'
          );
        }

        // بررسی عدم تداخل با نام موجود
        const parsed = parser.parseDocument(document.getText());
        const existing = parser.findParameter(parsed, newName);
        if (existing) {
          throw new Error('نام «' + newName + '» قبلاً استفاده شده است.');
        }

        // پیدا کردن پارامتر فعلی
        const wordRange = document.getWordRangeAtPosition(
          position,
          /[A-Za-z_][A-Za-z0-9_]*/
        );
        if (!wordRange) return null;

        const oldWord = document.getText(wordRange);
        const param = parser.findParameter(parsed, oldWord);
        if (!param) return null;

        // پیدا کردن همهٔ رخدادها
        const occurrences = parser.findAllOccurrences(
          document.getText(),
          param.name
        );

        const edit = new vscode.WorkspaceEdit();
        for (const occ of occurrences) {
          const start = new vscode.Position(occ.line, occ.col);
          const end = new vscode.Position(occ.line, occ.col + param.name.length);
          edit.replace(document.uri, new vscode.Range(start, end), newName);
        }

        return edit;
      },
    }
  );

  context.subscriptions.push(provider);
  return provider;
}

module.exports = { registerRenameProvider };