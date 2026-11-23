// hub/hub-errors.js
'use strict';

// نگاشت کد خطای سرور → پیام فارسی
const ERROR_MESSAGES = {
  AUTH_REQUIRED:      'برای این عملیات باید وارد شوید.',
  MISSING_ID:         'شناسه استراتژی ارسال نشده است.',
  MISSING_CODE:       'کد استراتژی ارسال نشده است.',
  NOT_FOUND:          'استراتژی یافت نشد.',
  FORBIDDEN:          'شما مالک این استراتژی نیستید.',
  INVALID_CODE:       'کد استراتژی نامعتبر است.',
  BACKTEST_FAILED:    'بک‌تست با خطا مواجه شد.',
  DB_ERROR:           'خطا در پایگاه داده.',
  SERVER_ERROR:       'خطای سرور.',
  NETWORK_ERROR:      'خطا در ارتباط با سرور.',
  HTTP_ERROR:         'خطای HTTP.',
  PARSE_ERROR:        'پاسخ سرور JSON معتبری نبود.',
};

// پیام پیش‌فرض اگر کد ناشناخته بود
const DEFAULT_MESSAGE = 'خطای ناشناخته.';

/**
 * تبدیل خطای hub-client به پیام فارسی قابل نمایش.
 * @param {{ code?: string, message?: string }} error
 * @returns {string}
 */
function toFriendlyMessage(error) {
  if (!error) return DEFAULT_MESSAGE;
  const code = (error.code || '').trim();
  if (ERROR_MESSAGES[code]) {
    // اگر پیام سرور موجود است و کوتاه است، همان را نمایش بده
    if (error.message && error.message.length < 200 && code !== 'HTTP_ERROR') {
      return error.message;
    }
    return ERROR_MESSAGES[code];
  }
  if (error.message) return error.message;
  return DEFAULT_MESSAGE;
}

module.exports = { toFriendlyMessage };