// definition-provider.js
// ============================================================
// Go to Definition برای متغیرهای PARAMETERS در GMO Strategy
//
// رفتار:
//   - Ctrl+Click / F12 روی یک نام در RULES یا در متن PARAMETERS
//     کاربر را به خط تعریف آن پارامتر می‌برد.
//   - روی خود تعریف، یا روی سیگنال/اکشن/تابع/کلیدواژه، null برمی‌گرداند.
// ============================================================

'use strict';

const vscode = require('vscode');
const parser = require('../parser');

/**
 * ثبت DefinitionProvider برای زبان gmo.
 * @param {vscode.ExtensionContext} context
 */
function registerDefinitionProvider(context) {
  const provider = vscode.languages.registerDefinitionProvider(
    { language: 'gmo', scheme: 'file' },
    {
      /**
       * @param {vscode.TextDocument} document
       * @param {vscode.Position} position
       * @param {vscode.CancellationToken} token
       * @returns {vscode.Location | vscode.Location[] | null}
       */
      provideDefinition(document, position, token) {
        // ۱. کلمه زیر مکان‌نما را بگیر
        const wordRange = document.getWordRangeAtPosition(
          position,
          /[A-Za-z_][A-Za-z0-9_]*/
        );
        if (!wordRange) return null;

        const word = document.getText(wordRange);
        if (!word) return null;

        // ۲. متن را پارس کن
        const parsed = parser.parseDocument(document.getText());

        // ۳. اگر کلمه یک سیگنال/اکشن/تابع/کلیدواژه است، تعریف PARAMETERS نیست
        if (
          parser.isSignal(word) ||
          parser.isAction(word) ||
          parser.isFunction(word) ||
          parser.isKeyword(word) ||
          parser.isLogicalOp(word)
        ) {
          return null;
        }

        // ۴. جستجوی پارامتر
        const param = parser.findParameter(parsed, word);
        if (!param) return null;

        // ۵. اگر مکان‌نما روی خود تعریف است، null برگردان (جلوگیری از پرش به خود)
        const defLine = param.line;
        const defColStart = Math.max(0, param.col);
        const defColEnd = defColStart + param.name.length;

        if (
          position.line === defLine &&
          position.character >= defColStart &&
          position.character <= defColEnd
        ) {
          return null;
        }

        // ۶. مکان تعریف را برگردان
        const defPos = new vscode.Position(defLine, defColStart);
        return new vscode.Location(document.uri, defPos);
      },
    }
  );

  context.subscriptions.push(provider);
  return provider;
}

module.exports = { registerDefinitionProvider };