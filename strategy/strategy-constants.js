// hub/strategy-constants.js
// ============================================================
// آدرس‌های API مربوط به اجرای استراتژی و توابع آماری.
//
// این فایل مستقل از hub-constants.js نگهداری می‌شود تا وابستگی‌ها
// بین Hub و Strategy Runner جدا بمانند. هر دو از یک توکن یکپارچه
// (gmo.token) استفاده می‌کنند که در context.secrets ذخیره می‌شود.
//
// پایه: http://ghadirinews.ir/cmd/gmo/v1/strategy/
//       https://www.ghadirinews.ir/cmd/gmo/v1/strategy/
// ============================================================

'use strict';

const BASE_URL_HTTP = 'http://ghadirinews.ir/cmd/gmo/v1/strategy';
const BASE_URL_HTTPS = 'https://www.ghadirinews.ir/cmd/gmo/v1/strategy';

// اکستنشن از HTTPS استفاده می‌کند (هماهنگ با hub-client.js موجود).
const STRATEGY_API = BASE_URL_HTTPS;

// کلید ذخیره‌سازی توکن (همان کلید هویت واحد افزونه).
const SECRET_TOKEN_KEY = 'gmo.token';

module.exports = {
  BASE_URL_HTTP,
  BASE_URL_HTTPS,
  STRATEGY_API,
  SECRET_TOKEN_KEY,

  // آدرس‌های API توابع آماری (همگی با token احراز هویت می‌شوند).
  URLS: {
    // توابع «آخرین مقدار» — فقط source می‌گیرند.
    lastConfidence: STRATEGY_API + '/LAST_CONFIDENCE/Default.aspx',
    lastPrice:      STRATEGY_API + '/LAST_PRICE/Default.aspx',
    lastDatetime:   STRATEGY_API + '/LAST_DATETIME/Default.aspx',

    // توابع «کمینه/بیشینه/میانگین» — source و count می‌گیرند.
    minConfidence:  STRATEGY_API + '/MIN_CONFIDENCE/Default.aspx',
    minPrice:       STRATEGY_API + '/MIN_PRICE/Default.aspx',
    maxConfidence:  STRATEGY_API + '/MAX_CONFIDENCE/Default.aspx',
    maxPrice:       STRATEGY_API + '/MAX_PRICE/Default.aspx',
    avgConfidence:  STRATEGY_API + '/AVG_CONFIDENCE/Default.aspx',
    avgPrice:       STRATEGY_API + '/AVG_PRICE/Default.aspx',

    // پارسر کد استراتژی — متن تفسیر برمی‌گرداند.
    parser:         STRATEGY_API + '/Parser/Default.aspx',
  },

  // نگاشت نام تابع به endpoint.
  // در پارسر GMO این توابع شناخته‌شده‌اند:
  //   FIELD (محلی، بدون API)، LAST_CONFIDENCE، LAST_PRICE، LAST_DATETIME،
  //   MIN_CONFIDENCE، MIN_PRICE، MAX_CONFIDENCE، MAX_PRICE،
  //   AVG_CONFIDENCE، AVG_PRICE.
  FUNCTION_TO_URL: {
    LAST_CONFIDENCE: STRATEGY_API + '/LAST_CONFIDENCE/Default.aspx',
    LAST_PRICE:      STRATEGY_API + '/LAST_PRICE/Default.aspx',
    LAST_DATETIME:   STRATEGY_API + '/LAST_DATETIME/Default.aspx',
    MIN_CONFIDENCE:  STRATEGY_API + '/MIN_CONFIDENCE/Default.aspx',
    MIN_PRICE:       STRATEGY_API + '/MIN_PRICE/Default.aspx',
    MAX_CONFIDENCE:  STRATEGY_API + '/MAX_CONFIDENCE/Default.aspx',
    MAX_PRICE:       STRATEGY_API + '/MAX_PRICE/Default.aspx',
    AVG_CONFIDENCE:  STRATEGY_API + '/AVG_CONFIDENCE/Default.aspx',
    AVG_PRICE:       STRATEGY_API + '/AVG_PRICE/Default.aspx',
    // پارسر فقط متن تفسیر می‌خواهد، نه مقدار تابع.
    // FIELD به‌صورت محلی با مقدار کاربر جایگذاری می‌شود.
  },
};
