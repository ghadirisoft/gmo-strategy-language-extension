// commands/hub-save-to-hub.js
'use strict';

const vscode = require('vscode');
const { toFriendlyMessage } = require('../hub/hub-errors');
const { ensureLoggedIn } = require('./_helpers');

/**
 * @param {object} deps
 * @param {import('../hub/hub-client').HubClient} deps.client
 * @param {import('../hub/hub-session').HubSession} deps.session
 * @param {import('../views/hub-tree-provider').HubTreeProvider} deps.tree
 */
async function hubSaveToHub(deps) {
  const { client, session, tree } = deps;

  // ⭐ اطمینان از ورود (هویت واحد)
  if (!(await ensureLoggedIn(client))) return;

  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'gmo') {
    vscode.window.showWarningMessage('فایل فعال GMO نیست.');
    return;
  }

  const doc = editor.document;
  const uriStr = doc.uri.toString();

  const meta = session.get(uriStr);
  if (!meta) {
    vscode.window.showWarningMessage(
      'این فایل از مخزن نیامده است. برای ذخیره به مخزن، ابتدا از نوارکناری باز کنید.'
    );
    return;
  }

  const currentCode = doc.getText();
  if (!session.hasChanged(uriStr, currentCode)) {
    vscode.window.showInformationMessage(
      'تغییری نسبت به نسخه مخزن وجود ندارد.'
    );
    return;
  }

  if (doc.isDirty) {
    await doc.save();
  }

  const codeDescription = extractDescription(currentCode);
  const descriptionToSend = codeDescription || null;

  // مرحله ۱: آپلود با withProgress
  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `در حال ذخیره ${meta.name} در Hub...`,
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: 'ارسال به سرور...' });
      try {
        return await client.update(
          meta.strategyId,
          currentCode,
          descriptionToSend
        );
      } catch (err) {
        return {
          ok: false,
          error: { code: 'NETWORK_ERROR', message: err.message },
        };
      }
    }
  );

  // مرحله ۲: نمایش نتیجه
  if (!result.ok) {
    vscode.window.showErrorMessage(toFriendlyMessage(result.error));
    return;
  }

  session.updateHash(uriStr, currentCode);

  if (result.codeChanged) {
    const newVersion = result.version || meta.version;
    const metaEntry = session.get(uriStr);
    if (metaEntry) metaEntry.version = newVersion;

    const action = await vscode.window.showInformationMessage(
      `✅ ${meta.name} در Hub ذخیره شد (نسخه ${newVersion}). بک‌تست اجرا شد.`,
      'مشاهده آمار'
    );
    if (action === 'مشاهده آمار') {
      vscode.commands.executeCommand('gmo.hub.showDetails', {
        id: meta.strategyId,
      });
    }
  } else {
    vscode.window.showInformationMessage(
      `✅ ${meta.name} در Hub ذخیره شد (فقط توضیحات تغییر کرد).`
    );
  }

  // مرحله ۳: reload جداگانه (بدون بلوکه کردن Notification)
  try {
    tree.cache.clear();
    await tree.load();
  } catch (err) {
    console.warn('[GMO Hub] reload failed:', err);
  }
}

function extractDescription(code) {
  const m = /^\s*DESCRIPTION\s*:\s*(.+)$/im.exec(code || '');
  return m ? m[1].trim() : '';
}

module.exports = { hubSaveToHub };