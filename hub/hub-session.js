// hub/hub-session.js
// ============================================================
// نگاشت فایل‌های باز که از Hub آمده‌اند
//   uri → { strategyId, name, version, originalHash }
// ============================================================

'use strict';

const crypto = require('crypto');

class HubSession {
  constructor() {
    /** @type {Map<string, {strategyId:number, name:string, version:string, originalHash:string}>} */
    this.entries = new Map();
  }

  /**
   * نرمال‌سازی متن — دقیقاً مثل NormalizeText در سرور
   * تا hash با سرور هماهنگ باشد.
   */
  normalize(text) {
    if (!text) return '';
    // یکسان‌سازی CRLF/CR → LF
    let s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Trim ابتدا/انتها
    s = s.trim();
    // حذف فاصله‌های انتهایی هر خط
    s = s.split('\n').map((l) => l.replace(/[ \t]+$/, '')).join('\n');
    return s;
  }

  hash(text) {
    return crypto.createHash('sha256').update(this.normalize(text), 'utf8').digest('hex');
  }

  /**
   * ثبت فایل باز از Hub.
   * @param {string} uriStr
   * @param {{strategyId:number, name:string, version:string}} meta
   * @param {string} code
   */
  set(uriStr, meta, code) {
    this.entries.set(uriStr, {
      strategyId: meta.strategyId,
      name: meta.name,
      version: meta.version,
      originalHash: this.hash(code),
    });
  }

  get(uriStr) {
    return this.entries.get(uriStr) || null;
  }

  delete(uriStr) {
    this.entries.delete(uriStr);
  }

  has(uriStr) {
    return this.entries.has(uriStr);
  }

  /**
   * آیا فایل تغییر کرده؟
   * @param {string} uriStr
   * @param {string} currentCode
   * @returns {boolean}
   */
  hasChanged(uriStr, currentCode) {
    const e = this.entries.get(uriStr);
    if (!e) return false;
    return this.hash(currentCode) !== e.originalHash;
  }

  /**
   * به‌روزرسانی hash بعد از ذخیره موفق.
   */
  updateHash(uriStr, newCode) {
    const e = this.entries.get(uriStr);
    if (e) e.originalHash = this.hash(newCode);
  }
}

module.exports = { HubSession };