// hub/hub-constants.js
'use strict';

const BASE_URL = 'https://www.ghadirinews.ir';
const HUB_API = BASE_URL + '/cmd/gmo/v1/hub';

module.exports = {
  BASE_URL,
  HUB_API,

  // آدرس‌های API
  URLS: {
    authCheck:   HUB_API + '/auth-check/Default.aspx',
    list:        HUB_API + '/list/Default.aspx',
    get:         HUB_API + '/get/Default.aspx',
    update:      HUB_API + '/update/Default.aspx',
    backtest:    HUB_API + '/backtest/Default.aspx',
  },

  // کلید ذخیره‌سازی
  SECRET_TOKEN_KEY: 'gmo.token',   // همان کلید افزونه (vslogin)
  SECRET_PHONE_KEY: 'gmo.phone',

  // کش
  CACHE_TTL_MS: 5 * 60 * 1000,   // ۵ دقیقه

  // تنظیمات
  CONFIG_HUB_ENABLED: 'gmo.hub.enabled',
  CONFIG_DOWNLOAD_FOLDER: 'gmo.hub.downloadFolder',
};