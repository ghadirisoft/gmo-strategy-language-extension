// commands/_helpers.js
'use strict';

const vscode = require('vscode');

/**
 * آرگومان دستور ممکن است:
 * - TreeItem (از راست‌کلیک یا کلیک چپ)
 * - object داده (از command.arguments در command palette)
 * - undefined (از Command Palette)
 *
 * این تابع دادهٔ واقعی استراتژی را برمی‌گرداند یا null.
 */
function normalizeStrategyArg(arg) {
  if (!arg) return null;
  // TreeItem با _strategy
  if (arg._strategy && typeof arg._strategy.id !== 'undefined') {
    return arg._strategy;
  }
  // object داده
  if (typeof arg.id !== 'undefined') {
    return arg;
  }
  return null;
}

/**
 * اطمینان از ورود کاربر (هویت واحد: gmo.token).
 * اگر وارد نشده باشد، پیام و دکمهٔ ورود نشان می‌دهد.
 *
 * @param {import('../hub/hub-client').HubClient} client
 * @returns {Promise<boolean>} آیا کاربر وارد است؟
 */
async function ensureLoggedIn(client) {
  const has = await client.hasToken();
  if (has) return true;

  const action = await vscode.window.showWarningMessage(
    'ابتدا باید در افزونه GMO وارد شوید.',
    'ورود به GMO',
    'انصراف'
  );
  if (action === 'ورود به GMO') {
    try {
      await vscode.commands.executeCommand('gmo.login');
    } catch (e) {
      console.warn('[GMO] login via command failed:', e && e.message);
    }
  }
  return await client.hasToken();
}

module.exports = { normalizeStrategyArg, ensureLoggedIn };