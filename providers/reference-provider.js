// reference-provider.js
// ============================================================
// Find All References (Shift+F12) برای متغیرهای PARAMETERS
//
// رفتار:
//   - روی یک پارامتر (تعریف یا استفاده) → همهٔ مکان‌های استفاده را نشان می‌دهد
//   - روی سیگنال/اکشن/تابع/کلیدواژه → null (چون تعریف PARAMETERS نیست)
// ============================================================

'use strict';

const vscode = require('vscode');
const parser = require('../parser');

/**
 * ثبت ReferenceProvider برای زبان gmo.
 * @param {vscode.ExtensionContext} context
 */
function registerReferenceProvider(context) {
  const provider = vscode.languages.registerReferenceProvider(
    { language: 'gmo', scheme: 'file' },
    {
      /**
       * @param {vscode.TextDocument} document
       * @param {vscode.Position} position
       * @param {object} referenceContext  // { includeDeclaration: boolean }
       * @param {vscode.CancellationToken} token
       * @returns {vscode.Location[] | null}
       */
      provideReferences(document, position, referenceContext, token) {
        const wordRange = document.getWordRangeAtPosition(
          position,
          /[A-Za-z_][A-Za-z0-9_]*/
        );
        if (!wordRange) return null;

        const word = document.getText(wordRange);
        if (!word) return null;

        // اگر کلمه رزرو است، تعریف PARAMETERS نیست
        if (
          parser.isSignal(word) ||
          parser.isAction(word) ||
          parser.isFunction(word) ||
          parser.isKeyword(word) ||
          parser.isLogicalOp(word)
        ) {
          return null;
        }

        const parsed = parser.parseDocument(document.getText());
        const param = parser.findParameter(parsed, word);
        if (!param) return null;

        // همهٔ رخدادها (شامل تعریف)
        const occurrences = parser.findAllOccurrences(document.getText(), word);

        // اگر includeDeclaration=false، تعریف را حذف کن
        const defPos = { line: param.line, col: param.col };
        const filtered = referenceContext.includeDeclaration
          ? occurrences
          : occurrences.filter(
              (o) => !(o.line === defPos.line && o.col === defPos.col)
            );

        return filtered.map(
          (o) =>
            new vscode.Location(
              document.uri,
              new vscode.Position(o.line, o.col)
            )
        );
      },
    }
  );

  context.subscriptions.push(provider);
  return provider;
}

module.exports = { registerReferenceProvider };