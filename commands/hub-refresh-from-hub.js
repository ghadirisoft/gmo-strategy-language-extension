// commands/hub-refresh-from-hub.js
'use strict';

const vscode = require('vscode');
const fs = require('fs');
const { toFriendlyMessage } = require('../hub/hub-errors');
const { normalizeStrategyArg, ensureLoggedIn } = require('./_helpers');

/**
 * @param {object} deps
 * @param {import('../hub/hub-client').HubClient} deps.client
 * @param {import('../hub/hub-session').HubSession} deps.session
 */
async function hubRefreshFromHub(deps, strategyArg) {
  const { client, session } = deps;

  // ⭐ اطمینان از ورود (هویت واحد)
  if (!(await ensureLoggedIn(client))) return;

  const strategy = normalizeStrategyArg(strategyArg);
  if (!strategy) {
    vscode.window.showWarningMessage(
      'از منوی راست‌کلیک روی استراتژی استفاده کنید.'
    );
    return;
  }

  // پیدا کردن فایل باز مربوطه
  let targetUri = null;
  for (const [uriStr, meta] of session.entries.entries()) {
    if (meta.strategyId === strategy.id) {
      targetUri = uriStr;
      break;
    }
  }

  if (!targetUri) {
    // فایل باز نیست — فقط باز کن
    await vscode.commands.executeCommand('gmo.hub.openStrategy', strategy);
    return;
  }

  // چک تغییرات محلی
  let openDoc = null;
  for (const d of vscode.workspace.textDocuments) {
    if (d.uri.toString() === targetUri) {
      openDoc = d;
      break;
    }
  }

  if (openDoc && openDoc.isDirty) {
    const confirm = await vscode.window.showWarningMessage(
      'تغییرات محلی ذخیره‌نشده دارید. با بارگذاری از مخزن، این تغییرات از دست می‌روند.',
      { modal: true },
      'بارگذاری مجدد',
      'انصراف'
    );
    if (confirm !== 'بارگذاری مجدد') return;
  }

  // دریافت
  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `در حال دریافت ${strategy.name} از Hub...`,
      cancellable: false,
    },
    async () => {
      try {
        return await client.get(strategy.id);
      } catch (err) {
        return {
          ok: false,
          error: { code: 'NETWORK_ERROR', message: err.message },
        };
      }
    }
  );

  if (!result.ok) {
    vscode.window.showErrorMessage(toFriendlyMessage(result.error));
    return;
  }

  const data = result.strategy || {};
  if (!data.code) {
    vscode.window.showWarningMessage('کد قابل دسترسی نیست.');
    return;
  }

  const filePath = vscode.Uri.parse(targetUri).fsPath;
  fs.writeFileSync(filePath, data.code, 'utf8');

  const doc = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(doc, { preview: false });

  session.set(
    targetUri,
    {
      strategyId: data.id,
      name: data.name,
      version: data.version,
    },
    data.code
  );

  vscode.window.showInformationMessage(
    `✅ ${data.name} v${data.version} از Hub بارگذاری شد.`
  );
}

module.exports = { hubRefreshFromHub };