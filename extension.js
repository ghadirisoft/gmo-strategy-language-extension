// extension.js
'use strict';

const vscode = require('vscode');
const https = require('https');
const formatter = require('./formatter');
const {
  registerDefinitionProvider,
} = require('./providers/definition-provider');
const { registerHoverProvider } = require('./providers/hover-provider');
const { registerReferenceProvider } = require('./providers/reference-provider');
const { registerRenameProvider } = require('./providers/rename-provider');
const {
  registerDiagnosticProvider,
} = require('./providers/diagnostic-provider');
const {
  registerCompletionProvider,
} = require('./providers/completion-provider');
const {
  registerCodeActionProvider,
} = require('./providers/code-action-provider');
const {
  registerDocumentSymbolProvider,
} = require('./providers/document-symbol-provider');
const { registerFoldingProvider } = require('./providers/folding-provider');
const {
  registerSignatureHelpProvider,
} = require('./providers/signature-help-provider');
const {
  registerInlayHintsProvider,
} = require('./providers/inlay-hints-provider');
// ===== Hub =====
const { HubClient } = require('./hub/hub-client');
const { HubCache } = require('./hub/hub-cache');
const { HubSession } = require('./hub/hub-session');
const { HubTreeProvider } = require('./views/hub-tree-provider');
const { hubRefresh } = require('./commands/hub-refresh');
const { hubOpenStrategy } = require('./commands/hub-open-strategy');
const { hubSaveToHub } = require('./commands/hub-save-to-hub');
const { hubRefreshFromHub } = require('./commands/hub-refresh-from-hub');
const { hubDisconnect } = require('./commands/hub-disconnect');
const { hubShowDetails } = require('./commands/hub-show-details');

// ===== Strategy Runner (اجرای استراتژی) =====
const { runStrategyCommand } = require('./strategy/strategy-runner');

// ============================================================
// آدرس‌های سرور
// ============================================================
const VS_LOGIN_URL = 'https://www.ghadirinews.ir/cmd/account/vslogin/';
const BACKTEST_URL = 'https://www.ghadirinews.ir/cmd/gmo/v1/backtest/';
const PARSER_URL = 'https://www.ghadirinews.ir/cmd/gmo/v1/STRATEGY/parser/';

// ============================================================
// کلیدهای ذخیره‌سازی (هویت واحد)
// ============================================================
const TOKEN_KEY = 'gmo.token';
const PHONE_KEY = 'gmo.phone';

// ============================================================
// scope ماژول برای دسترسی logout به Hub
// ============================================================
let hubDeps = null;
let updateHubStatusFn = null;

// ============================================================
// Helper: درخواست HTTPS
// ============================================================
function httpsPost(url, bodyStr, extraHeaders) {
  if (!extraHeaders) extraHeaders = {};

  return new Promise(function (resolve, reject) {
    var u;
    try {
      u = new URL(url);
    } catch (e) {
      return reject(new Error('URL نامعتبر: ' + url));
    }

    var options = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Content-Length': Buffer.byteLength(bodyStr, 'utf8'),
        'User-Agent': 'GMO-VSCode-Extension/2.0.0',
        Accept: '*/*',
        Connection: 'close',
      },
      timeout: 60000,
    };

    for (var k in extraHeaders) {
      if (Object.prototype.hasOwnProperty.call(extraHeaders, k)) {
        options.headers[k] = extraHeaders[k];
      }
    }

    console.log('[GMO] === REQUEST ===');
    console.log('[GMO] URL:', url);
    console.log('[GMO] Body length:', bodyStr.length);
    console.log('[GMO] Body preview:', bodyStr.substring(0, 200));

    var req = https.request(options, function (res) {
      var chunks = [];
      var totalLen = 0;

      console.log('[GMO] === RESPONSE HEADERS ===');
      console.log('[GMO] Status:', res.statusCode);
      console.log('[GMO] Content-Type:', res.headers['content-type'] || 'none');

      res.on('data', function (chunk) {
        chunks.push(chunk);
        totalLen += chunk.length;
      });

      res.on('end', function () {
        var text = Buffer.concat(chunks).toString('utf8');
        console.log('[GMO] Total bytes:', totalLen);
        console.log('[GMO] Text length:', text.length);
        resolve({
          status: res.statusCode,
          headers: res.headers,
          text: text,
        });
      });

      res.on('error', function (err) {
        console.error('[GMO] Response stream error:', err.message);
        reject(err);
      });
    });

    req.on('error', function (err) {
      console.error('[GMO] Request error:', err.code, err.message);
      reject(new Error('HTTPS ' + (err.code || '') + ': ' + err.message));
    });

    req.on('timeout', function () {
      console.error('[GMO] Request timeout');
      req.destroy(new Error('timeout بعد از ۶۰ ثانیه'));
    });

    req.write(bodyStr);
    req.end();
  });
}

// ============================================================
// Helper: توکن
// ============================================================
async function getStoredToken(context) {
  return await context.secrets.get(TOKEN_KEY);
}

async function clearToken(context) {
  await context.secrets.delete(TOKEN_KEY);
  await context.secrets.delete(PHONE_KEY);
}

// ============================================================
// Helper: خواندن تنظیمات قالب‌بندی
// ============================================================
function getFormatOptions(document) {
  const cfg = vscode.workspace.getConfiguration('gmo.format');
  const editorCfg = vscode.workspace.getConfiguration('editor', document);

  const tabSize = editorCfg.get('tabSize', cfg.get('indentSize', 2));
  const insertSpaces = editorCfg.get(
    'insertSpaces',
    !cfg.get('useTabs', false)
  );

  return {
    indentSize: tabSize,
    useTabs: !insertSpaces,
    alignAssignments: cfg.get('alignAssignments', true),
    alignArrow: cfg.get('alignArrow', true),
    uppercaseKeywords: cfg.get('uppercaseKeywords', true),
    addSpaceAroundOperators: cfg.get('addSpaceAroundOperators', true),
    trimTrailingSpaces: cfg.get('trimTrailingSpaces', true),
    finalNewline: cfg.get('finalNewline', true),
  };
}

async function formatActiveDocument(editor) {
  if (!editor || editor.document.languageId !== 'gmo') return false;

  const document = editor.document;
  const original = document.getText();
  if (!original.trim()) return false;

  const opts = getFormatOptions(document);
  const formatted = formatter.formatGmoText(original, opts);

  if (formatted === original) return false;

  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(original.length)
  );

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, fullRange, formatted);

  const success = await vscode.workspace.applyEdit(edit);
  if (!success) {
    throw new Error('اعمال تغییرات قالب‌بندی ممکن نشد.');
  }

  console.log('[GMO] Auto-format applied before backtest.');
  return true;
}

// ============================================================
// ورود — هویت واحد (بک‌تست + Hub)
// ============================================================
async function loginCommand(context) {
  var phone = await vscode.window.showInputBox({
    prompt: 'شماره تلفن همراه',
    placeHolder: '09123456789',
    validateInput: function (v) {
      if (!/^09\d{9}$/.test(v)) return 'شماره معتبر نیست (۱۱ رقم، شروع با ۰۹)';
      return null;
    },
  });
  if (!phone) return;

  var password = await vscode.window.showInputBox({
    prompt: 'کلمه عبور',
    password: true,
    ignoreFocusOut: true,
  });
  if (!password) return;

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'در حال ورود...' },
    async function () {
      try {
        var body =
          'p=' +
          encodeURIComponent(phone) +
          '&w=' +
          encodeURIComponent(password) +
          '&s=gmo&client=vscode';

        var res = await httpsPost(VS_LOGIN_URL, body);

        console.log('[GMO] === LOGIN RESPONSE ===');
        console.log('[GMO] status:', res.status);
        console.log(
          '[GMO] body length:',
          res.text ? res.text.length : 'undefined'
        );

        if (res.status !== 200) {
          throw new Error('سرور کد ' + res.status);
        }
        if (!res.text || res.text.length === 0) {
          throw new Error('پاسخ سرور خالی است');
        }

        var cleaned = res.text.replace(/^\uFEFF/, '').trim();

        if (cleaned.charAt(0) === '<') {
          throw new Error('سرور HTML برگرداند: ' + cleaned.substring(0, 150));
        }

        var data;
        try {
          data = JSON.parse(cleaned);
        } catch (parseErr) {
          throw new Error(
            'پاسخ JSON نیست. متن: [' + cleaned.substring(0, 200) + ']'
          );
        }

        if (!data.ok) {
          throw new Error(data.error || 'ورود ناموفق');
        }
        if (!data.token) {
          throw new Error('پاسخ توکن ندارد');
        }

        await context.secrets.store(TOKEN_KEY, data.token);
        await context.secrets.store(PHONE_KEY, phone);

        vscode.window.showInformationMessage('✅ ورود موفق');

        await updateStatusBar(context);

        // ⭐ هویت واحد: Hub هم تازه شود
        if (hubDeps && hubDeps.tree) {
          try {
            await hubDeps.tree.forceReload();
          } catch (e) {
            console.warn(
              '[GMO Hub] reload after login failed:',
              e && e.message
            );
          }
        }
      } catch (err) {
        console.error('[GMO] Login error:', err.message);
        vscode.window.showErrorMessage('❌ خطا در ورود: ' + err.message);
        throw err;
      }
    }
  );
}

// ============================================================
// خروج — هویت واحد (بک‌تست + Hub)
// ============================================================
async function logoutCommand(context) {
  const confirm = await vscode.window.showWarningMessage(
    'آیا قصد خروج از حساب را دارید؟',
    { modal: true },
    'خروج'
  );
  if (confirm !== 'خروج') return;

  await clearToken(context);
  await updateStatusBar(context);

  // ⭐ Hub را کامل ریست کن
  if (hubDeps) {
    if (hubDeps.session && hubDeps.session.entries) {
      try {
        hubDeps.session.entries.clear();
      } catch (e) {
        console.warn('[GMO Hub] session clear failed:', e && e.message);
      }
    }
    if (hubDeps.tree) {
      try {
        hubDeps.tree.reset('not-logged-in');
      } catch (e) {
        console.warn('[GMO Hub] tree reset failed:', e && e.message);
      }
    }
  }
  if (typeof updateHubStatusFn === 'function') {
    try {
      updateHubStatusFn();
    } catch (e) {
      console.warn('[GMO Hub] status update failed:', e && e.message);
    }
  }

  vscode.window.showInformationMessage('از حساب GMO خارج شدید.');
}

// ============================================================
// Status Bar
// ============================================================
var statusBarItem = null;

async function updateStatusBar(context) {
  if (!statusBarItem) return;

  var phone = await context.secrets.get(PHONE_KEY);
  if (phone) {
    statusBarItem.text = '$(account) GMO: ' + phone;
    statusBarItem.tooltip = 'کلیک برای تغییر حساب';
    statusBarItem.command = 'gmo.login';
  } else {
    statusBarItem.text = '$(account) GMO: ورود';
    statusBarItem.tooltip = 'کلیک برای ورود';
    statusBarItem.command = 'gmo.login';
  }
  statusBarItem.show();
}

// ============================================================
// activate
// ============================================================
function activate(context) {
  console.log('[GMO] Extension activating...');

  // ===== Status Bar =====
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  context.subscriptions.push(statusBarItem);
  updateStatusBar(context);

  // ===== Language providers =====
  formatter.registerFormatter(context);
  registerDefinitionProvider(context);
  registerHoverProvider(context);
  registerReferenceProvider(context);
  registerRenameProvider(context);
  registerDiagnosticProvider(context);
  registerCompletionProvider(context);
  registerCodeActionProvider(context);
  registerDocumentSymbolProvider(context);
  registerFoldingProvider(context);
  registerSignatureHelpProvider(context);
  registerInlayHintsProvider(context);

  // ============================================================
  // Hub Integration — هویت واحد
  // ============================================================
  const hubEnabled = vscode.workspace
    .getConfiguration()
    .get('gmo.hub.enabled', true);

  if (hubEnabled) {
    const hubClient = new HubClient(context);
    const hubCache = new HubCache();
    const hubSession = new HubSession();

    const treeProvider = new HubTreeProvider({
      client: hubClient,
      cache: hubCache,
    });

    const treeView = vscode.window.createTreeView('gmoHubView', {
      treeDataProvider: treeProvider,
      showCollapseAll: true,
    });
    context.subscriptions.push(treeView);

    hubDeps = {
      context,
      client: hubClient,
      cache: hubCache,
      session: hubSession,
      tree: treeProvider,
    };

    // ===== Register Hub commands (بدون login/logout) =====
    context.subscriptions.push(
      vscode.commands.registerCommand('gmo.hub.refresh', () =>
        hubRefresh(hubDeps)
      ),
      vscode.commands.registerCommand('gmo.hub.openStrategy', (s) =>
        hubOpenStrategy(hubDeps, s)
      ),
      vscode.commands.registerCommand('gmo.hub.saveToHub', () =>
        hubSaveToHub(hubDeps)
      ),
      vscode.commands.registerCommand('gmo.hub.refreshFromHub', (s) =>
        hubRefreshFromHub(hubDeps, s)
      ),
      vscode.commands.registerCommand('gmo.hub.disconnect', () =>
        hubDisconnect(hubDeps)
      ),
      vscode.commands.registerCommand('gmo.hub.showDetails', (s) =>
        hubShowDetails(hubDeps, s)
      )
    );

    // ===== بارگذاری اولیه (اگر توکن هست) =====
    treeProvider.load().catch((err) => {
      console.error('[GMO Hub] load error:', err);
    });

    // ===== Status Bar: وضعیت اتصال فایل =====
    const hubStatus = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      50
    );
    context.subscriptions.push(hubStatus);

    function updateHubStatus() {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'gmo') {
        hubStatus.hide();
        return;
      }
      const meta = hubSession.get(editor.document.uri.toString());
      if (meta) {
        hubStatus.text = `$(cloud) Hub: ${meta.name} v${meta.version}`;
        hubStatus.tooltip = 'این فایل به Hub متصل است';
        hubStatus.show();
      } else {
        hubStatus.hide();
      }
    }

    updateHubStatusFn = updateHubStatus;

    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(updateHubStatus),
      vscode.workspace.onDidSaveTextDocument(updateHubStatus),
      vscode.workspace.onDidCloseTextDocument(() => {
        updateHubStatus();
      })
    );
    updateHubStatus();
  }

  // ===== Format دستی =====
  context.subscriptions.push(
    vscode.commands.registerCommand('gmo.formatDocument', async function () {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'gmo') {
        vscode.window.showWarningMessage('فایل فعال GMO نیست.');
        return;
      }
      await vscode.commands.executeCommand('editor.action.formatDocument');
    })
  );

  // ===== ورود =====
  context.subscriptions.push(
    vscode.commands.registerCommand('gmo.login', function () {
      return loginCommand(context);
    })
  );

  // ===== خروج =====
  context.subscriptions.push(
    vscode.commands.registerCommand('gmo.logout', function () {
      return logoutCommand(context);
    })
  );

  // ===== Backtest =====
  context.subscriptions.push(
    vscode.commands.registerCommand('gmo.runBacktest', async function () {
      console.log('[GMO] runBacktest START');

      var editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('هیچ فایلی باز نیست.');
        return;
      }
      if (editor.document.languageId !== 'gmo') {
        vscode.window.showWarningMessage(
          'این فایل GMO نیست. زبان: ' + editor.document.languageId
        );
        return;
      }

      var rawCode = editor.document.getText();
      if (!rawCode.trim()) {
        vscode.window.showWarningMessage('استراتژی خالی است.');
        return;
      }

      // فرمت خودکار قبل از ارسال
      const shouldAutoFormat = vscode.workspace
        .getConfiguration('gmo.runBacktest')
        .get('autoFormat', true);

      if (shouldAutoFormat) {
        try {
          await formatActiveDocument(editor);
        } catch (fmtErr) {
          console.error('[GMO] Auto-format failed:', fmtErr.message);
          var proceed = await vscode.window.showWarningMessage(
            'قالب‌بندی خودکار ناموفق بود: ' + fmtErr.message,
            'ادامه بدون قالب‌بندی',
            'انصراف'
          );
          if (proceed !== 'ادامه بدون قالب‌بندی') return;
        }
      }

      var code = editor.document.getText();
      if (!code.trim()) {
        vscode.window.showWarningMessage('استراتژی خالی است.');
        return;
      }

      // چک توکن
      var token = await getStoredToken(context);
      if (!token) {
        var action = await vscode.window.showWarningMessage(
          'ابتدا وارد حساب خود شوید.',
          'ورود',
          'انصراف'
        );
        if (action !== 'ورود') return;
        try {
          await loginCommand(context);
        } catch (e) {
          return;
        }
        token = await getStoredToken(context);
        if (!token) return;
      }

      // انتخاب بازه
      var periodPick = await vscode.window.showQuickPick(
        [
          { label: '۳۰ روز اخیر', value: '30' },
          { label: '۶۰ روز اخیر', value: '60' },
        ],
        { placeHolder: 'بازه زمانی شبیه‌سازی را انتخاب کنید' }
      );
      if (!periodPick) return;

      // تلاش (با retry)
      for (var attempt = 0; attempt < 2; attempt++) {
        var result = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'در حال اجرای شبیه‌سازی...',
            cancellable: false,
          },
          async function (progress) {
            try {
              progress.report({ message: 'ارسال به سرور...' });

              var backtestBody =
                'sc=' +
                encodeURIComponent(code) +
                '&v=' +
                encodeURIComponent(periodPick.value) +
                '&token=' +
                encodeURIComponent(token);

              var parserBody =
                'sc=' +
                encodeURIComponent(code) +
                '&token=' +
                encodeURIComponent(token);

              var backtestRes = await httpsPost(BACKTEST_URL, backtestBody);
              var parserRes = await httpsPost(PARSER_URL, parserBody);

              return {
                ok: true,
                backtestStatus: backtestRes.status,
                backtestText: backtestRes.text,
                parserStatus: parserRes.status,
                parserText: parserRes.text,
              };
            } catch (err) {
              return { ok: false, error: err.message };
            }
          }
        );

        if (!result.ok) {
          vscode.window.showErrorMessage('خطا در ارتباط: ' + result.error);
          return;
        }

        console.log('[GMO] backtest status:', result.backtestStatus);
        console.log('[GMO] backtest length:', result.backtestText.length);
        console.log(
          '[GMO] backtest preview:',
          result.backtestText.substring(0, 200)
        );
        console.log('[GMO] parser status:', result.parserStatus);
        console.log('[GMO] parser length:', result.parserText.length);
        console.log(
          '[GMO] parser preview:',
          result.parserText.substring(0, 200)
        );

        // توکن معتبر نبود
        if (result.backtestText.trim() === '..!') {
          await clearToken(context);
          await updateStatusBar(context);

          // ⭐ Hub را هم ریست کن (توکن باطل شده)
          if (hubDeps && hubDeps.tree) {
            try {
              if (hubDeps.session && hubDeps.session.entries) {
                hubDeps.session.entries.clear();
              }
              hubDeps.tree.reset('not-logged-in');
            } catch (e) {
              console.warn('[GMO Hub] reset after invalid token failed:', e);
            }
          }

          var act = await vscode.window.showErrorMessage(
            'توکن معتبر نیست. لطفاً مجدداً وارد شوید.',
            'ورود مجدد',
            'انصراف'
          );
          if (act !== 'ورود مجدد') return;
          try {
            await loginCommand(context);
          } catch (e) {
            return;
          }
          token = await getStoredToken(context);
          if (!token) return;
          continue;
        }

        // موفق
        showResultPanel(context, result.backtestText, result.parserText);
        return;
      }

      vscode.window.showErrorMessage('پس از دو تلاش، احراز هویت ناموفق بود.');
    })
  );

  // ===== Run Strategy (اجرای استراتژی) =====
  context.subscriptions.push(
    vscode.commands.registerCommand('gmo.runStrategy', async function () {
      try {
        await runStrategyCommand(context, getStoredToken, loginCommand);
      } catch (err) {
        console.error('[GMO Strategy] runStrategy error:', err && err.message);
        vscode.window.showErrorMessage('خطا در اجرای استراتژی: ' + (err && err.message ? err.message : String(err)));
      }
    })
  );

  console.log('[GMO] Extension activated. Commands registered.');
}

// ============================================================
// Webview — نمایش نتیجه
// ============================================================
function showResultPanel(context, backtestText, parserText) {
  backtestText = backtestText && backtestText.trim() ? backtestText : '';
  parserText = parserText && parserText.trim() ? parserText : '';

  const panel = vscode.window.createWebviewPanel(
    'gmoResult',
    'نتیجه شبیه‌سازی GMO',
    vscode.ViewColumn.Beside,
    { enableScripts: false }
  );

  var backtestSection = backtestText
    ? `<h2>📊 گزارش شبیه‌سازی</h2>
           <div class="section">${backtestText}</div>`
    : `<h2>📊 گزارش شبیه‌سازی</h2>
           <div class="section empty">گزارشی از سرور دریافت نشد.</div>`;

  var parserSection = parserText
    ? `<h2>🧠 تفسیر کد استراتژیک</h2>
           <div class="section">${parserText}</div>`
    : '';

  panel.webview.html = `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://www.ghadirinews.ir; font-src https://www.ghadirinews.ir; img-src https: data:; script-src 'none';">
<style>
  @font-face {
    font-family: 'Yekan';
    font-style: normal;
    font-weight: 400;
    src: url('https://www.ghadirinews.ir/dl/fonts/yekan.woff') format('woff');
    font-display: swap;
  }

  @font-face {
    font-family: 'Vazir';
    font-style: normal;
    font-weight: 400;
    src: url('https://www.ghadirinews.ir/dl/fonts/vazir.woff2') format('woff2');
    font-display: swap;
  }

  * { box-sizing: border-box; }

  body {
    font-family: 'Yekan', 'Vazir', 'Segoe UI', Tahoma, sans-serif;
    padding: 20px 24px;
    background: #ffffff;
    color: #1e1e1e;
    line-height: 1.85;
    font-size: 14px;
    direction: rtl;
    text-align: right;
    margin: 0;
  }

  h2 {
    font-family: 'Yekan', 'Vazir', Tahoma, sans-serif;
    color: #0a2b5c;
    border-bottom: 2px solid #e8a838;
    padding-bottom: 8px;
    margin-bottom: 16px;
    margin-top: 24px;
    font-size: 18px;
  }

  h2:first-child { margin-top: 0; }

  .section {
    margin-bottom: 28px;
    padding: 16px 20px;
    background: #fafbfc;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .section.empty {
    color: #9ca3af;
    font-style: italic;
    text-align: center;
    padding: 30px 20px;
  }

  .section table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-family: 'Yekan', 'Vazir', Tahoma, sans-serif;
    white-space: normal;
  }

  .section table th,
  .section table td {
    padding: 8px 12px;
    border: 1px solid #d0d7de;
    text-align: right;
    white-space: normal;
    word-break: break-word;
    vertical-align: top;
  }

  .section table th {
    background: #0a2b5c;
    color: #fff;
    font-weight: 700;
  }

  .section table tr:nth-child(even) td {
    background: #f6f8fa;
  }

  .section pre {
    background: #f6f8fa;
    padding: 14px;
    border-radius: 8px;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: Consolas, monospace;
    font-size: 13px;
    direction: ltr;
    text-align: left;
    border: 1px solid #e2e8f0;
    overflow-x: auto;
  }

  .section ul,
  .section ol {
    padding-right: 24px;
    margin-bottom: 12px;
  }

  .section p {
    margin-bottom: 10px;
  }

  .section strong { color: #0a2b5c; }

  .section div { margin-bottom: 8px; }

  .section code {
    background: rgba(232, 168, 56, 0.15);
    color: #a8832e;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: Consolas, monospace;
    font-size: 0.9em;
  }
</style>
</head>
<body>
  ${backtestSection}
  ${parserSection}

</body>
</html>`;
}

function deactivate() {
  console.log('[GMO] Extension deactivated');
}

module.exports = { activate: activate, deactivate: deactivate };
