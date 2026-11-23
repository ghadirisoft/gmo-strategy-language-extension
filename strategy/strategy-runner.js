// strategy-runner.js
// ============================================================
// اجرای استراتژی GMO در اکستنشن VS Code
//
// جریان:
//   1) کد استراتژی را از editor می‌گیرد.
//   2) با parser.js موجود، پارامترها و قوانین را استخراج می‌کند.
//   3) تمام FIELD(n) هایی که در PARAMETERS/RULES استفاده شده‌اند را پیدا می‌کند.
//   4) مقادیر آن FIELDها را از کاربر با InputBox می‌گیرد (با اعتبارسنجی).
//   5) تمام توابع آماری استفاده‌شده در قوانین را با Promise.all از APIها فراخوانی می‌کند.
//   6) strategy-evaluator را صدا می‌زند.
//   7) parser text را از Parser API می‌گیرد.
//   8) نتیجه را در webview نمایش می‌دهد.
// ============================================================

'use strict';

const vscode = require('vscode');
const https = require('https');
const parser = require('../parser');
const evaluator = require('./strategy-evaluator');
const { getField, validateFieldValue, FIELDS } = require('./strategy-fields');
const { URLS, FUNCTION_TO_URL, SECRET_TOKEN_KEY } = require('./strategy-constants');

// ============================================================
// Helper: درخواست HTTPS (مشابه httpsPost در extension.js)
// ============================================================
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(url);
    } catch (e) {
      return reject(new Error('URL نامعتبر: ' + url));
    }

    const options = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        'User-Agent': 'GMO-VSCode-Extension/2.0.0',
        Accept: 'text/plain, application/json, */*',
        Connection: 'close',
      },
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, text });
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.end();
  });
}

function httpsPost(url, bodyStr) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(url);
    } catch (e) {
      return reject(new Error('URL نامعتبر: ' + url));
    }

    const options = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Content-Length': Buffer.byteLength(bodyStr, 'utf8'),
        'User-Agent': 'GMO-VSCode-Extension/2.0.0',
        Accept: 'text/plain, application/json, */*',
        Connection: 'close',
      },
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, text });
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.write(bodyStr);
    req.end();
  });
}

// ============================================================
// Helper: توکن ذخیره‌شده
// ============================================================
async function getStoredToken(context) {
  return await context.secrets.get(SECRET_TOKEN_KEY);
}

// ============================================================
// بخش ۱: استخراج FIELD(n) و توابع آماری از کد استراتژی
// ============================================================

/**
 * تمام رخدادهای FIELD(n) را در متن استراتژی پیدا می‌کند.
 * @param {string} text
 * @returns {Set<number>} ایندکس‌های FIELD
 */
function extractFieldIndices(text) {
  const indices = new Set();
  const re = /\bFIELD\s*\(\s*(\d+)\s*\)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    indices.add(parseInt(m[1], 10));
  }
  return indices;
}

/**
 * تمام رخدادهای توابع آماری (LAST_CONFIDENCE، MIN_PRICE، ...) را در متن پیدا می‌کند.
 * هر رخداد به‌صورت { name, args: [arg1Ast, ...] } برمی‌گردد — args به‌صورت string
 * (نه AST) برای سادگی. در مرحله‌ی فراخوانی API، args ارزیابی می‌شوند.
 *
 * @param {string} text
 * @returns {Array<{name:string, argsText:string, fullText:string}>}
 */
function extractStatFunctions(text) {
  const functions = [];
  const functionNames = Object.keys(FUNCTION_TO_URL);

  // الگو: NAME(args)  که args می‌تواند شامل کاما، رشته، عدد، پرانتز تودرتو باشد.
  // یک رویکرد ساده: NAME( را پیدا کن، سپس با شمارش پرانتز، args را استخراج کن.
  const re = new RegExp('\\b(' + functionNames.join('|') + ')\\s*\\(', 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1].toUpperCase();
    const startArgs = m.index + m[0].length; // بعد از '('
    // با شمارش پرانتز، انتهای args را پیدا کن
    let depth = 1;
    let i = startArgs;
    while (i < text.length && depth > 0) {
      const ch = text[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (depth > 0) i++;
    }
    const argsText = text.slice(startArgs, i).trim();
    functions.push({
      name,
      argsText,
      fullText: text.slice(m.index, i + 1),
    });
    re.lastIndex = i + 1;
  }

  return functions;
}

/**
 * آرگومان‌های یک تابع آماری را به مقادیر نهایی ارزیابی می‌کند.
 *
 * برای LAST_CONFIDENCE/LAST_PRICE/LAST_DATETIME، source یک شناسه است (مثل GREEN).
 * برای LAST_DATETIME، آرگومان دوم یک offset زمانی است (مثل 36H یا -12H).
 * برای MIN/MAX/AVG، آرگومان دوم یک عدد است (count).
 *
 * @param {string} argsText
 * @param {Map<number, any>} fieldValues
 * @param {string} funcName
 * @returns {{source:string, countOrOffset:string|null}}
 */
function parseStatFunctionArgs(argsText, fieldValues, funcName) {
  // argsText را توکنایز کن و آرگومان‌ها را به‌صورت مقادیر جدا شده بگیر
  // ساده‌ترین راه: split با کاما (با توجه به اینکه رشته‌ها تک‌کوتیشنی هستند،
  // باید با احتیacy split کنیم).
  const parts = splitArgs(argsText);

  if (parts.length === 0) {
    throw new Error(`تابع ${funcName} حداقل یک آرگومان (source) می‌گیرد`);
  }

  const source = parts[0].trim().toUpperCase().replace(/^['"]|['"]$/g, '');

  if (parts.length === 1) {
    return { source, countOrOffset: null };
  }

  // آرگومان دوم:
  // - برای LAST_DATETIME: یک offset زمانی مثل "36H" یا "-12H"
  // - برای MIN/MAX/AVG: یک عدد count مثل "5"
  const second = parts[1].trim();
  return { source, countOrOffset: second };
}

/**
 * متن آرگومان‌ها را با کاما جدا می‌کند، با احترام به رشته‌های تک‌کوتیشنی.
 * @param {string} argsText
 * @returns {Array<string>}
 */
function splitArgs(argsText) {
  const parts = [];
  let current = '';
  let inString = false;
  let depth = 0;

  for (let i = 0; i < argsText.length; i++) {
    const ch = argsText[i];
    if (ch === "'") {
      inString = !inString;
      current += ch;
    } else if (!inString && ch === '(') {
      depth++;
      current += ch;
    } else if (!inString && ch === ')') {
      depth--;
      current += ch;
    } else if (!inString && ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim()) parts.push(current);
  return parts;
}

// ============================================================
// بخش ۲: دریافت مقادیر FIELD از کاربر
// ============================================================

/**
 * برای هر FIELD(n) یک InputBox نشان می‌دهد و مقدار می‌گیرد.
 *
 * @param {Array<number>} indices ایندکس‌های FIELDهای استفاده‌شده، مرتب‌شده.
 * @param {vscode.ExtensionContext} context
 * @returns {Promise<Map<number, string>|null>} مقادیر، یا null اگر کاربر لغو کرد.
 */
async function promptFieldValues(indices, context) {
  const fieldValues = new Map();

  for (const idx of indices) {
    const field = getField(idx);
    if (!field) {
      // فیلد ناشناخته — به‌صورت رشته آزاد بپرس
      const v = await vscode.window.showInputBox({
        prompt: `مقدار FIELD(${idx}) را وارد کنید`,
        placeHolder: 'مقدار',
        ignoreFocusOut: true,
      });
      if (v === undefined) return null;
      fieldValues.set(idx, v);
      continue;
    }

    // برای فیلدهای ENUM با مقادیر محدود، QuickPick استفاده کنیم.
    if (field.type === 'enum' && field.enum.length <= 10) {
      const items = field.enum.map((val) => {
        // برای SIGNAL، label را به نام سیگنال تبدیل کنیم.
        let label = val;
        if (idx === 0) {
          // برای SIGNAL: رنگ متمایز
          label = val;
        }
        if (idx === 7) {
          // MARKET: -1/0/1
          const desc = val === '1' ? 'صعودی' : val === '-1' ? 'نزولی' : 'خنثی';
          label = `${val} (${desc})`;
        } else if (idx === 6) {
          // GmoML
          const desc = ({
            '0': 'صبر',
            '1': 'خرید',
            '2': 'فروش',
            '3': 'خرید محدود',
            '4': 'فروش محدود',
          })[val] || '';
          label = `${val} (${desc})`;
        } else if (idx === 8) {
          // FACTOR
          const desc = ({
            '0': 'تغییرات آستانه',
            '1': 'هشدار زودهنگام',
            '2': 'جهش ناگهانی قیمت',
          })[val] || '';
          label = `${val} (${desc})`;
        } else if (idx === 9) {
          // TRADERS
          const desc = parseInt(val, 10) > 0 ? 'خریداران' : parseInt(val, 10) < 0 ? 'فروشندگان' : 'خنثی';
          label = `${val} (${desc})`;
        }
        return { label, value: val };
      });

      // پیدا کردن آیتم پیش‌فرض
      let defaultItem = items.find((it) => it.value === field.defaultValue);
      if (!defaultItem) defaultItem = items[0];

      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: `FIELD(${idx}) — ${field.name} — ${field.description}`,
        ignoreFocusOut: true,
      });
      if (!picked) return null;
      fieldValues.set(idx, picked.value);
      continue;
    }

    // برای بقیه فیلدها، InputBox
    const v = await vscode.window.showInputBox({
      prompt: `FIELD(${idx}) — ${field.name}`,
      placeHolder: field.placeholder || `مقدار FIELD(${idx})`,
      value: field.defaultValue || '',
      ignoreFocusOut: true,
      validateInput: (val) => {
        const err = validateFieldValue(idx, val);
        return err; // null یعنی معتبر
      },
    });
    if (v === undefined) return null;
    fieldValues.set(idx, v);
  }

  return fieldValues;
}

// ============================================================
// Helper: ساخت کلید کش یکسان برای evaluator و runner
// ============================================================
//
// این تابع باید با منطق strategy-evaluator.js کاملاً هماهنگ باشد تا
// کلیدهای cacheKey در دو طرف یکسان ساخته شوند. در غیر این صورت،
// evaluator نتیجه‌ی تابع را پیدا نمی‌کند و خطای
// «مقدار تابع X موجود نیست» رخ می‌دهد.
//
// قرارداد:
//   - برای توابع 1-آرگومانی (مثل LAST_PRICE(GREEN)):
//       NAME|SOURCE|null     ← توجه: کلمه‌ی 'null' واقعی
//   - برای توابع 2-آرگومانی (مثل MIN_PRICE(BLUE, 10)):
//       NAME|SOURCE|ARG2
//   - source همیشه UPPERCASE می‌شود.
//
function buildFunctionCacheKey(name, source, countOrOffset) {
  const safeName = String(name).toUpperCase();
  const safeSource = String(source).toUpperCase();
  if (countOrOffset === null || countOrOffset === undefined || countOrOffset === '') {
    return safeName + '|' + safeSource + '|null';
  }
  return safeName + '|' + safeSource + '|' + String(countOrOffset);
}

// ============================================================
// بخش ۳: فراخوانی API توابع آماری
// ============================================================

/**
 * همه‌ی توابع آماری استفاده‌شده در استراتژی را به APIها فراخوانی می‌کند.
 *
 * @param {Array<{name:string, argsText:string}>} statFunctions
 * @param {Map<number, any>} fieldValues
 * @param {string} token
 * @returns {Promise<Map<string, string>>} نگاشت کلید → مقدار
 */
async function fetchStatFunctionValues(statFunctions, fieldValues, token) {
  const results = new Map();
  const tasks = [];

  for (const sf of statFunctions) {
    const url = FUNCTION_TO_URL[sf.name];
    if (!url) {
      // تابع آماری ناشناخته — رد شو
      continue;
    }

    // args را parse کن
    let parsedArgs;
    try {
      parsedArgs = parseStatFunctionArgs(sf.argsText, fieldValues, sf.name);
    } catch (e) {
      // اگر پارس نشد، مقدار null
      continue;
    }

    const params = new URLSearchParams();
    params.append('source', parsedArgs.source);
    if (parsedArgs.countOrOffset !== null) {
      params.append('value', parsedArgs.countOrOffset);
    }
    params.append('token', token);

    // کلید کش — باید دقیقاً با evaluator هماهنگ باشد (buildFunctionCacheKey).
    const cacheKey = buildFunctionCacheKey(sf.name, parsedArgs.source, parsedArgs.countOrOffset);

    tasks.push(
      httpsPost(url, params.toString())
        .then((res) => {
          if (res.status === 200 && res.text && res.text.trim() && res.text.trim() !== '..!') {
            const trimmed = res.text.replace(/^\uFEFF/, '').trim();
            results.set(cacheKey, trimmed);
          } else {
            // احراز هویت ناموفق یا پاسخ نامعتبر
            results.set(cacheKey, null);
          }
        })
        .catch((err) => {
          console.warn(`[GMO Strategy] fetch ${sf.name} failed:`, err.message);
          results.set(cacheKey, null);
        })
    );
  }

  await Promise.all(tasks);
  return results;
}

/**
 * نتیجه‌ی تابع آماری را برای evaluator آماده می‌کند — یعنی یک Map<string, any>
 * که کلید آن `NAME|arg1|arg2|...` است (با uppercase) و مقدار آن نتیجه است.
 *
 * @param {Array<{name:string, argsText:string}>} statFunctions
 * @param {Map<number, any>} fieldValues
 * @param {Map<string, string>} apiResults
 * @returns {Map<string, any>}
 */
function buildFunctionResultsForEvaluator(statFunctions, fieldValues, apiResults) {
  const fr = new Map();
  for (const sf of statFunctions) {
    try {
      const parsedArgs = parseStatFunctionArgs(sf.argsText, fieldValues, sf.name);
      const cacheKey = buildFunctionCacheKey(sf.name, parsedArgs.source, parsedArgs.countOrOffset);
      if (apiResults.has(cacheKey)) {
        fr.set(cacheKey, apiResults.get(cacheKey));
      }
    } catch (e) {
      // رد شو
    }
  }
  return fr;
}

// ============================================================
// بخش ۴: فراخوانی Parser API برای تفسیر کد
// ============================================================

/**
 * متن تفسیر استراتژی را از Parser API می‌گیرد.
 * @param {string} code
 * @param {string} token
 * @returns {Promise<string>}
 */
async function fetchParserInterpretation(code, token) {
  const params = new URLSearchParams();
  params.append('sc', code);
  params.append('token', token);

  const res = await httpsPost(URLS.parser, params.toString());
  if (res.status !== 200 || !res.text) return '';
  const trimmed = res.text.replace(/^\uFEFF/, '').trim();
  if (trimmed === '..!') return '';
  return trimmed;
}

// ============================================================
// بخش ۵: نقطه‌ی ورود — اجرای استراتژی
// ============================================================

/**
 * اجرای استراتژی فعال.
 *
 * @param {vscode.ExtensionContext} context
 * @param {function} getStoredTokenFn تابع دریافت توکن (برای unit-test و reuse)
 * @param {function} loginCommandFn تابع ورود (در صورت نیاز)
 */
async function runStrategyCommand(context, getStoredTokenFn, loginCommandFn) {
  console.log('[GMO Strategy] runStrategy START');

  const editor = vscode.window.activeTextEditor;
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

  const code = editor.document.getText();
  if (!code.trim()) {
    vscode.window.showWarningMessage('استراتژی خالی است.');
    return;
  }

  // ۱) پارس کد استراتژی
  const parsedDoc = parser.parseDocument(code);

  if (parsedDoc.parameters.length === 0 && parsedDoc.rules.length === 0) {
    vscode.window.showErrorMessage('هیچ پارامتر یا قانونی در استراتژی پیدا نشد.');
    return;
  }

  // ۲) استخراج FIELD(n) ها و توابع آماری
  const fieldIndicesSet = extractFieldIndices(code);
  const fieldIndices = Array.from(fieldIndicesSet).sort((a, b) => a - b);

  const statFunctions = extractStatFunctions(code);

  // ۳) توکن — اگر نیست، درخواست ورود
  let token = await getStoredTokenFn(context);
  if (!token) {
    const action = await vscode.window.showWarningMessage(
      'ابتدا وارد حساب خود شوید.',
      'ورود',
      'انصراف'
    );
    if (action !== 'ورود') return;
    try {
      await loginCommandFn(context);
    } catch (e) {
      return;
    }
    token = await getStoredTokenFn(context);
    if (!token) return;
  }

  // ۴) دریافت مقادیر FIELD از کاربر
  let fieldValues;
  try {
    fieldValues = await promptFieldValues(fieldIndices, context);
  } catch (e) {
    vscode.window.showErrorMessage('خطا در دریافت مقادیر: ' + e.message);
    return;
  }

  if (fieldValues === null) {
    // کاربر لغو کرد
    return;
  }

  // ۵) فراخوانی APIها (با progress)
  const apiResults = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'در حال اجرای استراتژی...',
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: 'دریافت داده‌های بازار...' });
      const statResults = await fetchStatFunctionValues(statFunctions, fieldValues, token);

      progress.report({ message: 'دریافت تفسیر کد...' });
      let parserText = '';
      try {
        parserText = await fetchParserInterpretation(code, token);
      } catch (e) {
        console.warn('[GMO Strategy] parser fetch failed:', e.message);
      }

      return { statResults, parserText };
    }
  );

  // اگر توکن نامعتبر بود (همه APIها '..!' برگرداندند)
  const allFailed = statFunctions.length > 0 &&
    Array.from(apiResults.statResults.values()).every((v) => v === null);
  if (allFailed && statFunctions.length > 0) {
    const action = await vscode.window.showErrorMessage(
      'احراز هویت ناموفق بود. لطفاً مجدداً وارد شوید.',
      'ورود مجدد',
      'انصراف'
    );
    if (action !== 'ورود مجدد') return;
    try {
      await loginCommandFn(context);
    } catch (e) {
      return;
    }
    // دوباره تلاش کن
    token = await getStoredTokenFn(context);
    if (!token) return;
    // در حالت ساده، فقط یک بار retry می‌کنیم.
    const retryResults = await fetchStatFunctionValues(statFunctions, fieldValues, token);
    apiResults.statResults = retryResults;
  }

  // ۶) ارزیابی استراتژی
  const functionResults = buildFunctionResultsForEvaluator(
    statFunctions,
    fieldValues,
    apiResults.statResults
  );

  const evalResult = evaluator.evaluateStrategy(parsedDoc, fieldValues, functionResults);

  // ۷) نمایش در webview
  showStrategyResultPanel({
    parameters: evalResult.parameters,
    rules: evalResult.rules,
    errors: evalResult.errors,
    parserText: apiResults.parserText,
    fieldValues,
    strategyName: parsedDoc.strategyName,
    strategyVersion: parsedDoc.strategyVersion,
  });
}

// ============================================================
// بخش ۶: webview نتیجه اجرا
// ============================================================

/**
 * نمایش نتیجه اجرا در webview.
 *
 * @param {{
 *   parameters: Array<{name, expr, value, display, error}>,
 *   rules: Array<{code, evaluatedCode, matched, error, signalValue}>,
 *   errors: string[],
 *   parserText: string,
 *   fieldValues: Map<number, any>,
 *   strategyName: string|null,
 *   strategyVersion: string|null,
 * }} data
 */
function showStrategyResultPanel(data) {
  const {
    parameters,
    rules,
    errors,
    parserText,
    strategyName,
    strategyVersion,
  } = data;

  const title = strategyName
    ? `نتیجه اجرا: ${strategyName}` + (strategyVersion ? ` v${strategyVersion}` : '')
    : 'نتیجه اجرای استراتژی GMO';

  const panel = vscode.window.createWebviewPanel(
    'gmoStrategyResult',
    title,
    vscode.ViewColumn.Beside,
    { enableScripts: false }
  );

  // ----- بخش ۱: پارامترها -----
  const parametersHtml = renderParametersTable(parameters);

  // ----- بخش ۲: قوانین -----
  const matchedRuleCount = rules.filter((r) => r.matched).length;
  const rulesHtml = renderRulesList(rules, matchedRuleCount);

  // ----- بخش ۳: خطاها (اگر هست) -----
  const errorsHtml = errors.length > 0 ? renderErrorsList(errors) : '';

  // ----- بخش ۴: تفسیر کد -----
  const parserHtml = parserText && parserText.trim()
    ? `<h2>🧠 تفسیر کد استراتژی</h2><div class="section parser-section">${parserText}</div>`
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
    overflow-wrap: break-word;
  }
  .section.empty {
    color: #9ca3af;
    font-style: italic;
    text-align: center;
    padding: 30px 20px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-family: 'Yekan', 'Vazir', Tahoma, sans-serif;
  }
  table th, table td {
    padding: 8px 12px;
    border: 1px solid #d0d7de;
    text-align: right;
    vertical-align: top;
    word-break: break-word;
  }
  table th {
    background: #0a2b5c;
    color: #fff;
    font-weight: 700;
  }
  table tr:nth-child(even) td { background: #f6f8fa; }
  .rule-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;
    margin-bottom: 10px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    background: #fafbfc;
    direction: ltr;
    text-align: left;
  }
  .rule-row.matched {
    background: #dcfce7;
    border-color: #16a34a;
    border-width: 2px;
  }
  .rule-row.not-matched {
    background: #fef2f2;
    border-color: #dc2626;
  }
  .rule-row.error {
    background: #fef9c3;
    border-color: #ca8a04;
  }
  .rule-icon {
    font-size: 20px;
    line-height: 1.4;
    flex-shrink: 0;
    width: 28px;
    text-align: center;
  }
  .rule-content {
    flex: 1;
    min-width: 0;
  }
  .rule-code {
    font-family: Consolas, 'Courier New', monospace;
    font-size: 13px;
    color: #475569;
    margin-bottom: 6px;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .rule-evaluated {
    font-family: Consolas, 'Courier New', monospace;
    font-size: 13.5px;
    color: #0f172a;
    font-weight: 600;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .rule-error {
    color: #b91c1c;
    font-size: 12px;
    margin-top: 6px;
  }
  .rule-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    margin-right: 6px;
  }
  .rule-badge.matched { background: #16a34a; color: #fff; }
  .rule-badge.not-matched { background: #dc2626; color: #fff; }
  .rule-badge.error { background: #ca8a04; color: #fff; }
  .summary-banner {
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 16px;
    font-weight: 600;
    text-align: center;
  }
  .summary-banner.has-match {
    background: #dcfce7;
    color: #14532d;
    border: 1px solid #16a34a;
  }
  .summary-banner.no-match {
    background: #fef2f2;
    color: #7f1d1d;
    border: 1px solid #dc2626;
  }
  .parser-section {
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  .parser-section table { direction: rtl; }
  .parser-section strong { color: #0a2b5c; }
  .parser-section code {
    background: rgba(232, 168, 56, 0.15);
    color: #a8832e;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: Consolas, monospace;
    font-size: 0.9em;
  }
  .errors-section {
    background: #fef2f2;
    border: 1px solid #dc2626;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
  }
  .errors-section h3 {
    color: #7f1d1d;
    margin: 0 0 8px 0;
    font-size: 14px;
  }
  .errors-section ul {
    margin: 0;
    padding-right: 20px;
    color: #991b1b;
  }
</style>
</head>
<body>
  ${errorsHtml}
  ${parametersHtml}
  ${rulesHtml}
  ${parserHtml}
</body>
</html>`;
}

function renderParametersTable(parameters) {
  if (!parameters || parameters.length === 0) {
    return `<h2>📋 پارامترها</h2><div class="section empty">پارامتری تعریف نشده است.</div>`;
  }

  const rows = parameters.map((p) => {
    const valueDisplay = p.error ? `<span style="color:#dc2626">⚠ ${escapeHtml(p.error)}</span>` : escapeHtml(String(p.value));
    return `<tr>
      <td><code>${escapeHtml(p.name)}</code></td>
      <td><code>${escapeHtml(p.expr)}</code></td>
      <td><strong>${valueDisplay}</strong></td>
    </tr>`;
  }).join('\n');

  return `<h2>📋 پارامترها با مقادیر جایگذاری‌شده</h2>
<div class="section">
  <table>
    <thead>
      <tr>
        <th>نام</th>
        <th>عبارت</th>
        <th>مقدار نهایی</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</div>`;
}

function renderRulesList(rules, matchedCount) {
  if (!rules || rules.length === 0) {
    return `<h2>⚖️ قوانین با مقادیر جایگذاری‌شده</h2><div class="section empty">قانونی تعریف نشده است.</div>`;
  }

  // بنر خلاصه
  let banner;
  if (matchedCount === 0) {
    banner = `<div class="summary-banner no-match">❌ هیچ قانونی با این مقادیر مطابقت ندارد.</div>`;
  } else if (matchedCount === 1) {
    banner = `<div class="summary-banner has-match">✅ یک قانون مطابقت دارد.</div>`;
  } else {
    banner = `<div class="summary-banner has-match">✅ ${matchedCount} قانون مطابقت دارند (اولویت با اولین).</div>`;
  }

  const items = rules.map((r, idx) => {
    const cls = r.error ? 'error' : (r.matched ? 'matched' : 'not-matched');
    const icon = r.error ? '⚠️' : (r.matched ? '✅' : '❌');
    const badge = r.error
      ? `<span class="rule-badge error">خطا</span>`
      : (r.matched
          ? `<span class="rule-badge matched">مطابقت</span>`
          : `<span class="rule-badge not-matched">عدم مطابقت</span>`);

    const errorHtml = r.error ? `<div class="rule-error">⚠ ${escapeHtml(r.error)}</div>` : '';

    return `<div class="rule-row ${cls}">
      <div class="rule-icon">${icon}</div>
      <div class="rule-content">
        ${badge}
        <div class="rule-code">#${idx + 1} — ${escapeHtml(r.code)}</div>
        <div class="rule-evaluated">${escapeHtml(r.evaluatedCode)}</div>
        ${errorHtml}
      </div>
    </div>`;
  }).join('\n');

  return `<h2>⚖️ قوانین با مقادیر جایگذاری‌شده</h2>
${banner}
<div class="section">
  ${items}
</div>`;
}

function renderErrorsList(errors) {
  const items = errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('\n');
  return `<div class="errors-section">
    <h3>⚠ خطاها در ارزیابی</h3>
    <ul>${items}</ul>
  </div>`;
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================
// صادرات
// ============================================================

module.exports = {
  runStrategyCommand,
  // صادرات برای تست:
  extractFieldIndices,
  extractStatFunctions,
  parseStatFunctionArgs,
  splitArgs,
  buildFunctionCacheKey,
  buildFunctionResultsForEvaluator,
  showStrategyResultPanel,
  httpsPost,
  httpsGet,
};
