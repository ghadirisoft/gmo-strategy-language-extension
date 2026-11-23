// commands/hub-open-strategy.js
'use strict';

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { toFriendlyMessage } = require('../hub/hub-errors');
const { normalizeStrategyArg, ensureLoggedIn } = require('./_helpers');

function getDownloadFolder() {
  const cfg = vscode.workspace.getConfiguration();
  const custom = cfg.get('gmo.hub.downloadFolder');
  if (custom && typeof custom === 'string') return custom;

  const ws = vscode.workspace.workspaceFolders;
  if (ws && ws.length > 0) {
    return path.join(ws[0].uri.fsPath, '.gmo-hub');
  }
  return path.join(os.tmpdir(), 'gmo-hub');
}

function safeFileName(name, version) {
  const base = String(name || 'strategy')
    .replace(/[^\w\u0600-\u06FF\-() ]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const v = String(version || '0').replace(/[^\w.\-]+/g, '_');
  return `${base}-${v}.gmo`;
}

/**
 * @param {object} deps
 * @param {import('../hub/hub-client').HubClient} deps.client
 * @param {import('../hub/hub-session').HubSession} deps.session
 * @param {import('../views/hub-tree-provider').HubTreeProvider} deps.tree
 * @param {object} strategyArg
 */
async function hubOpenStrategy(deps, strategyArg) {
  const { client, session, tree } = deps;

  // ⭐ اطمینان از ورود (هویت واحد)
  if (!(await ensureLoggedIn(client))) return;

  // ⭐ normalize
  let strategy = normalizeStrategyArg(strategyArg);

  // اگر از Command Palette صدا زده شد (بدون آرگومان) → QuickPick
  if (!strategy) {
    const all = [...(tree.myStrategies || []), ...(tree.forkedStrategies || [])];
    if (!all.length) {
      vscode.window.showInformationMessage('هیچ استراتژی‌ای یافت نشد.');
      return;
    }
    const pick = await vscode.window.showQuickPick(
      all.map((s) => ({
        label: `${s.name} v${s.version}`,
        description: `win ${(s.winRate || 0).toFixed(1)}% · PF ${(s.profitFactor || 0).toFixed(2)}`,
        detail: s.description || '',
        _s: s,
      })),
      { placeHolder: 'استراتژی را انتخاب کنید' }
    );
    if (!pick) return;
    strategy = pick._s;
  }

  if (!strategy || typeof strategy.id === 'undefined') {
    vscode.window.showWarningMessage('استراتژی معتبر نیست.');
    return;
  }

  // مرحله ۱: دریافت کد با withProgress
  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `در حال دریافت ${strategy.name} v${strategy.version}...`,
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

  // مرحله ۲: پردازش نتیجه
  if (!result.ok) {
    vscode.window.showErrorMessage(toFriendlyMessage(result.error));
    return;
  }

  const data = result.strategy || {};
  const code = data.code;
  if (!code) {
    vscode.window.showWarningMessage(
      'کد این استراتژی خصوصی است و قابل مشاهده نیست.'
    );
    return;
  }

  // ذخیره روی دیسک
  const folder = getDownloadFolder();
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
  const fileName = safeFileName(data.name, data.version);
  const filePath = path.join(folder, fileName);

  // اگر فایل از قبل باز و dirty است → تأیید
  const existingUriStr = vscode.Uri.file(filePath).toString();
  for (const d of vscode.workspace.textDocuments) {
    if (d.uri.toString() === existingUriStr && d.isDirty) {
      const confirm = await vscode.window.showWarningMessage(
        'فایل باز با تغییرات ذخیره‌نشده وجود دارد. با بازکردن نسخه مخزن، تغییرات از دست می‌روند.',
        { modal: true },
        'بازکردن نسخه مخزن',
        'انصراف'
      );
      if (confirm !== 'بازکردن نسخه مخزن') return;
      break;
    }
  }

  fs.writeFileSync(filePath, code, 'utf8');

  // باز کردن
  const doc = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(doc, { preview: false });

  // ثبت در session
  session.set(
    doc.uri.toString(),
    {
      strategyId: data.id,
      name: data.name,
      version: data.version,
    },
    code
  );

  vscode.window.showInformationMessage(
    `✅ ${data.name} v${data.version} باز شد.`
  );
}

module.exports = { hubOpenStrategy, getDownloadFolder, safeFileName };