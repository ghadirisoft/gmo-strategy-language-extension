// hub/hub-client.js
// ============================================================
// لایهٔ HTTP برای Hub
//   - احراز هویت با توکن ذخیره‌شدهٔ vslogin
//   - پارس JSON با تحمل BOM
//   - خطاها به‌صورت { ok:false, error:{code,message} }
// ============================================================

'use strict';

const https = require('https');
const { URLS, SECRET_TOKEN_KEY } = require('./hub-constants');

/**
 * درخواست HTTPS با body فرم یا query.
 * @param {string} url
 * @param {'GET'|'POST'} method
 * @param {object|null} params
 * @returns {Promise<{ok:boolean, data?:object, error?:object}>}
 */
function request(url, method, params) {
  return new Promise((resolve) => {
    let u;
    try {
      u = new URL(url);
    } catch (e) {
      return resolve({ ok: false, error: { code: 'BAD_URL', message: e.message } });
    }

    const methodUpper = (method || 'GET').toUpperCase();
    let body = '';
    let fullPath = u.pathname;

    if (methodUpper === 'GET') {
      if (params && Object.keys(params).length) {
        const qs = new URLSearchParams(params).toString();
        fullPath += '?' + qs;
      }
    } else {
      body = new URLSearchParams(params || {}).toString();
    }

    const headers = {
      'User-Agent': 'GMO-VSCode-Extension/2.0.0',
      'Accept': 'application/json',
      'Connection': 'close',
    };
    if (methodUpper === 'POST') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
      headers['Content-Length'] = Buffer.byteLength(body, 'utf8');
    }

    const options = {
      hostname: u.hostname,
      port: u.port || 443,
      path: fullPath + (u.search || ''),
      method: methodUpper,
      headers,
      timeout: 30000,
    };

    console.log('[Hub] ->', methodUpper, url);

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        console.log('[Hub] <-', res.statusCode, '(' + text.length + ' bytes)');

        const parsed = safeParseJson(text);
        if (!parsed) {
          return resolve({
            ok: false,
            error: {
              code: 'PARSE_ERROR',
              message: 'پاسخ سرور JSON نبود: ' + text.substring(0, 120),
            },
          });
        }
        resolve(parsed);
      });
      res.on('error', (err) => resolve({ ok: false, error: { code: 'NETWORK_ERROR', message: err.message } }));
    });

    req.on('error', (err) => {
      resolve({ ok: false, error: { code: 'NETWORK_ERROR', message: err.message } });
    });
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });

    if (methodUpper === 'POST') req.write(body);
    req.end();
  });
}

/**
 * پارس ایمن JSON با تحمل BOM.
 * @param {string} text
 * @returns {object|null}
 */
function safeParseJson(text) {
  if (!text) return null;
  let s = text;
  if (s.charCodeAt(0) === 0xFEFF) s = s.substring(1);
  s = s.trim();
  if (!s) return null;
  if (s.charAt(0) === '<') return null; // HTML
  try {
    return JSON.parse(s);
  } catch (e) {
    return null;
  }
}

// ============================================================
// کلاینت اصلی
// ============================================================

class HubClient {
  /**
   * @param {import('vscode').ExtensionContext} context
   */
  constructor(context) {
    this.context = context;
  }

  /** دریافت توکن ذخیره‌شده (vslogin). */
  async getToken() {
    return await this.context.secrets.get(SECRET_TOKEN_KEY);
  }

  /** آیا کاربر توکن دارد؟ */
  async hasToken() {
    return !!(await this.getToken());
  }

  /**
   * اجرای درخواست با توکن.
   * @param {string} url
   * @param {'GET'|'POST'} method
   * @param {object} params
   */
  async withToken(url, method, params) {
    const token = await this.getToken();
    if (!token) {
      return { ok: false, error: { code: 'AUTH_REQUIRED', message: 'توکن ندارید' } };
    }
    const merged = Object.assign({}, params || {}, { token });
    return request(url, method, merged);
  }

  // ==========================================================
  // APIها
  // ==========================================================

  /** بررسی وضعیت احراز هویت. */
  async authCheck() {
    return this.withToken(URLS.authCheck, 'GET', {});
  }

  /** لیست استراتژی‌ها. */
  async list(params) {
    return this.withToken(URLS.list, 'GET', params);
  }

  /** جزئیات یک استراتژی. */
  async get(id) {
    return this.withToken(URLS.get, 'GET', { id });
  }

  /** به‌روزرسانی استراتژی. */
async update(id, code, description) {
  const params = { id, code };
  if (description !== null && description !== undefined) {
    params.description = description;
  }
  return this.withToken(URLS.update, 'POST', params);
}

  /** درخواست بک‌تست جدید. */
  async requestBacktest(id) {
    return this.withToken(URLS.backtest, 'POST', { id });
  }
}

module.exports = { HubClient, request, safeParseJson };