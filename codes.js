// codes.js
// ============================================================
// کدهای تشخیصی (Diagnostic Codes) مشترک
//
// هدف:
//   - جلوگیری از circular dependency بین diagnostic-provider و code-action-provider
//   - منبع واحد حقیقت برای کدهای خطا
//   - استفاده در Quick Fix برای نگاشت دقیق
// ============================================================

'use strict';

module.exports = {
  // ----------------------------------------------------------
  // ساختاری
  // ----------------------------------------------------------
  CODE_MISSING_END: 'missing-end',
  CODE_MISSING_STRATEGY: 'missing-strategy',
  CODE_MISSING_VERSION: 'missing-version',
  CODE_INVALID_VERSION: 'invalid-version',
  CODE_INVALID_TOKEN: 'invalid-token',
  CODE_TOKEN_BLOCK_WITHOUT_TOKEN: 'token-block-without-token',

  // ----------------------------------------------------------
  // پارامترها
  // ----------------------------------------------------------
  CODE_UNDEFINED_PARAM: 'undefined-param',
  CODE_DUPLICATE_PARAM: 'duplicate-param',
  CODE_INVALID_PARAM_NAME: 'invalid-param-name',
  CODE_EMPTY_PARAM_EXPR: 'empty-param-expr',

  // ----------------------------------------------------------
  // قوانین
  // ----------------------------------------------------------
  CODE_UNKNOWN_FUNCTION: 'unknown-function',
  CODE_MISSING_G: 'missing-g',
  CODE_INVALID_LAST_DATETIME: 'invalid-last-datetime',
  CODE_INVALID_ACTION_ARGS: 'invalid-action-args',
  CODE_MISSING_ARROW: 'missing-arrow',
  CODE_MISSING_SIGNAL: 'missing-signal',
  CODE_MISSING_ACTION: 'missing-action',

  // ----------------------------------------------------------
  // هشدارها (Warning)
  // ----------------------------------------------------------
  CODE_GMOML_CONFLICT: 'gmoml-conflict',
  CODE_MARKET_CONFLICT: 'market-conflict',
  CODE_UNREACHABLE_RULE: 'unreachable-rule',
};