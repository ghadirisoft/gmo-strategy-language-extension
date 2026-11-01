const vscode = require('vscode');
const https  = require('https');

// ============================================================
// آدرس‌های سرور
// ============================================================
const VS_LOGIN_URL = 'https://www.ghadirinews.ir/cmd/account/vslogin/';
const BACKTEST_URL = 'https://www.ghadirinews.ir/cmd/gmo/v1/backtest/';
const PARSER_URL   = 'https://www.ghadirinews.ir/cmd/gmo/v1/STRATEGY/parser/';

// ============================================================
// کلیدهای ذخیره‌سازی
// ============================================================
const TOKEN_KEY = 'gmo.token';
const PHONE_KEY = 'gmo.phone';

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
                'User-Agent': 'GMO-VSCode-Extension/0.2.1',
                'Accept': '*/*',
                'Connection': 'close'
            },
            rejectUnauthorized: false,
            timeout: 60000
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
                    text: text
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
// دستور ورود
// ============================================================
async function loginCommand(context) {
    var phone = await vscode.window.showInputBox({
        prompt: 'شماره تلفن همراه',
        placeHolder: '09123456789',
        validateInput: function (v) {
            if (!/^09\d{9}$/.test(v)) return 'شماره معتبر نیست (۱۱ رقم، شروع با ۰۹)';
            return null;
        }
    });
    if (!phone) return;

    var password = await vscode.window.showInputBox({
        prompt: 'کلمه عبور',
        password: true,
        ignoreFocusOut: true
    });
    if (!password) return;

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'در حال ورود...' },
        async function () {
            try {
                var body = 'p=' + encodeURIComponent(phone) +
                           '&w=' + encodeURIComponent(password) +
                           '&s=gmo&client=vscode';

                var res = await httpsPost(VS_LOGIN_URL, body);

                console.log('[GMO] === LOGIN RESPONSE ===');
                console.log('[GMO] status:', res.status);
                console.log('[GMO] body length:', res.text ? res.text.length : 'undefined');

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
                    throw new Error('پاسخ JSON نیست. متن: [' + cleaned.substring(0, 200) + ']');
                }

                if (!data.ok) {
                    throw new Error(data.error || 'ورود ناموفق');
                }
                if (!data.token) {
                    throw new Error('پاسخ توکن ندارد');
                }

                await context.secrets.store(TOKEN_KEY, data.token);
                await context.secrets.store(PHONE_KEY, phone);

                vscode.window.showInformationMessage('✅ ورود موفق به GMO');

                // بروزرسانی status bar
                await updateStatusBar(context);

            } catch (err) {
                console.error('[GMO] Login error:', err.message);
                vscode.window.showErrorMessage('❌ خطا در ورود: ' + err.message);
                throw err;
            }
        }
    );
}

// ============================================================
// دستور خروج
// ============================================================
async function logoutCommand(context) {
    await clearToken(context);
    await updateStatusBar(context);
    vscode.window.showInformationMessage('از حساب خارج شدید.');
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
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBarItem);
    updateStatusBar(context);

    // ===== دستور ورود =====
    context.subscriptions.push(
        vscode.commands.registerCommand('gmo.login', function () {
            return loginCommand(context);
        })
    );

    // ===== دستور خروج =====
    context.subscriptions.push(
        vscode.commands.registerCommand('gmo.logout', function () {
            return logoutCommand(context);
        })
    );

    // ===== دیباگ توکن =====
    context.subscriptions.push(
        vscode.commands.registerCommand('gmo.debugToken', async function () {
            var t = await getStoredToken(context);
            if (!t) {
                vscode.window.showInformationMessage('هیچ توکنی ذخیره نشده.');
            } else {
                vscode.window.showInformationMessage('توکن: ' + t.substring(0, 40) + '...');
                console.log('[GMO] Full token:', t);
            }
        })
    );

    // ===== دستور Backtest =====
    context.subscriptions.push(
        vscode.commands.registerCommand('gmo.runBacktest', async function () {

            console.log('[GMO] runBacktest START');

            // ---- چک فایل فعال ----
            var editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('هیچ فایلی باز نیست.');
                return;
            }
            if (editor.document.languageId !== 'gmo') {
                vscode.window.showWarningMessage('این فایل GMO نیست. زبان: ' + editor.document.languageId);
                return;
            }

            // ---- چک خالی نبودن ----
            var code = editor.document.getText();
            if (!code.trim()) {
                vscode.window.showWarningMessage('استراتژی خالی است.');
                return;
            }

            // ---- چک توکن ----
            var token = await getStoredToken(context);
            if (!token) {
                var action = await vscode.window.showWarningMessage(
                    'ابتدا وارد حساب خود شوید.', 'ورود', 'انصراف'
                );
                if (action !== 'ورود') return;
                try { await loginCommand(context); } catch (e) { return; }
                token = await getStoredToken(context);
                if (!token) return;
            }

            // ---- انتخاب بازه ----
            var periodPick = await vscode.window.showQuickPick(
                [
                    { label: '۳۰ روز اخیر', value: '30' },
                    { label: '۶۰ روز اخیر', value: '60' }
                ],
                { placeHolder: 'بازه زمانی شبیه‌سازی را انتخاب کنید' }
            );
            if (!periodPick) return;

            // ---- تلاش (با retry) ----
            for (var attempt = 0; attempt < 2; attempt++) {

                var result = await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'در حال اجرای شبیه‌سازی...',
                        cancellable: false
                    },
                    async function (progress) {
                        try {
                            progress.report({ message: 'ارسال به سرور...' });

                            var backtestBody =
                                'sc=' + encodeURIComponent(code) +
                                '&v='  + encodeURIComponent(periodPick.value) +
                                '&token=' + encodeURIComponent(token);

                            var parserBody =
                                'sc=' + encodeURIComponent(code) +
                                '&token=' + encodeURIComponent(token);

                            var backtestRes = await httpsPost(BACKTEST_URL, backtestBody);
                            var parserRes   = await httpsPost(PARSER_URL,   parserBody);

                            return {
                                ok: true,
                                backtestStatus: backtestRes.status,
                                backtestText: backtestRes.text,
                                parserStatus: parserRes.status,
                                parserText: parserRes.text
                            };
                        } catch (err) {
                            return { ok: false, error: err.message };
                        }
                    }
                );

                // ---- خطای شبکه ----
                if (!result.ok) {
                    vscode.window.showErrorMessage('خطا در ارتباط: ' + result.error);
                    return;
                }

                // ⭐ لاگ دیباگ
                console.log('[GMO] backtest status:', result.backtestStatus);
                console.log('[GMO] backtest length:', result.backtestText.length);
                console.log('[GMO] backtest preview:', result.backtestText.substring(0, 200));
                console.log('[GMO] parser status:', result.parserStatus);
                console.log('[GMO] parser length:', result.parserText.length);
                console.log('[GMO] parser preview:', result.parserText.substring(0, 200));

                // ---- توکن معتبر نبود ----
                if (result.backtestText.trim() === '..!') {
                    await clearToken(context);
                    await updateStatusBar(context);

                    var act = await vscode.window.showErrorMessage(
                        'توکن معتبر نیست. لطفاً مجدداً وارد شوید.',
                        'ورود مجدد', 'انصراف'
                    );
                    if (act !== 'ورود مجدد') return;
                    try { await loginCommand(context); } catch (e) { return; }
                    token = await getStoredToken(context);
                    if (!token) return;
                    continue;
                }

                // ---- موفق ----
                showResultPanel(context, result.backtestText, result.parserText);
                return;
            }

            vscode.window.showErrorMessage('پس از دو تلاش، احراز هویت ناموفق بود.');
        })
    );

    console.log('[GMO] Extension activated. Commands registered.');
}

// ============================================================
// Webview — نمایش نتیجه
// ============================================================
function showResultPanel(context, backtestText, parserText) {
    // ⭐ محافظت در برابر undefined یا خالی
    backtestText = (backtestText && backtestText.trim())
        ? backtestText
        : '';
    parserText = (parserText && parserText.trim())
        ? parserText
        : '';

    const panel = vscode.window.createWebviewPanel(
        'gmoResult',
        'نتیجه شبیه‌سازی GMO',
        vscode.ViewColumn.Beside,
        { enableScripts: false }
    );

    // ⭐ اگر یکی از بخش‌ها خالی بود، اصلاً نمایش نده
    var backtestSection = backtestText
        ? `<h2>📊 گزارش شبیه‌سازی</h2>
           <div class="section">${backtestText}</div>`
        : `<h2>📊 گزارش شبیه‌سازی</h2>
           <div class="section empty">گزارشی از سرور دریافت نشد.</div>`;

    var parserSection = parserText
        ? `<h2>🧠 تفسیر کد استراتژیک</h2>
           <div class="section">${parserText}</div>`
        : '';  // اگر تفسیر خالی بود، کلاً نمایش نده

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

    /* ⭐ این دو خط مشکل \\n را حل می‌کنند */
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

  /* جدول‌ها — white-space نرمال (نه pre-wrap) */
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

  /* اگر HTML سرور شامل <pre> بود */
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