// commands/hub-refresh.js
'use strict';

const vscode = require('vscode');
const { ensureLoggedIn } = require('./_helpers');

/**
 * @param {object} deps
 * @param {import('../hub/hub-client').HubClient} deps.client
 * @param {import('../views/hub-tree-provider').HubTreeProvider} deps.tree
 */
async function hubRefresh(deps) {
  const { client, tree } = deps;

  // ⭐ اطمینان از ورود (هویت واحد)
  if (!(await ensureLoggedIn(client))) return;

  try {
    await tree.forceReload();
  } catch (err) {
    vscode.window.showErrorMessage('خطا در بارگذاری: ' + err.message);
  }
}

module.exports = { hubRefresh };