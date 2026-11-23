// commands/hub-disconnect.js
// ============================================================
// قطع اتصال فایل باز از Hub (فایل محلی می‌شود)
// ============================================================

'use strict';

const vscode = require('vscode');

/**
 * @param {object} deps
 * @param {import('../hub/hub-session').HubSession} deps.session
 */
async function hubDisconnect(deps) {
  const { session } = deps;

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('هیچ فایلی باز نیست.');
    return;
  }

  const uriStr = editor.document.uri.toString();

  if (!session.has(uriStr)) {
    vscode.window.showInformationMessage('این فایل به مخزن متصل نیست.');
    return;
  }

  session.delete(uriStr);
  vscode.window.showInformationMessage(
    '🔗 اتصال فایل از مخزن قطع شد. اکنون یک فایل محلی است.'
  );
}

module.exports = { hubDisconnect };