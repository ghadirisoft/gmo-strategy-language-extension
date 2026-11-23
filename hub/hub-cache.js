// hub/hub-cache.js
// ============================================================
// کش سادهٔ لیست استراتژی‌ها با TTL
// ============================================================

'use strict';

const { CACHE_TTL_MS } = require('./hub-constants');

class HubCache {
  constructor() {
    this.entries = new Map();
  }

  get(key) {
    const e = this.entries.get(key);
    if (!e) return null;
    if (Date.now() > e.expiresAt) {
      this.entries.delete(key);
      return null;
    }
    return e.value;
  }

  set(key, value, ttlMs) {
    const ttl = typeof ttlMs === 'number' ? ttlMs : CACHE_TTL_MS;
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  delete(key) {
    this.entries.delete(key);
  }

  clear() {
    this.entries.clear();
  }
}

module.exports = { HubCache };