// views/hub-tree-provider.js
// ============================================================
// TreeView برای Sidebar "GMO Hub"
//   - حالات: idle / loading / not-logged-in / error / ready
//   - دو گروه: My Strategies و Forked
//   - هویت واحد: توکن gmo.token
// ============================================================

'use strict';

const vscode = require('vscode');
const { toFriendlyMessage } = require('../hub/hub-errors');

// کلیدهای context
const CTX_HUB_ROOT = 'gmoHubRoot';
const CTX_HUB_ACTION = 'gmoHubAction';
const CTX_STRATEGY = 'gmoHubStrategy';

class HubTreeProvider {
  /**
   * @param {object} deps
   * @param {import('../hub/hub-client').HubClient} deps.client
   * @param {import('../hub/hub-cache').HubCache} deps.cache
   */
  constructor(deps) {
    this.client = deps.client;
    this.cache = deps.cache;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;

    // وضعیت داخلی
    this.state = 'idle'; // idle | loading | error | ready | not-logged-in
    this.errorMessage = '';
    this.myStrategies = [];
    this.forkedStrategies = [];
  }

  // ==========================================================
  // API عمومی
  // ==========================================================

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  /** تنظیم state و refresh. */
  setState(state, errorMessage) {
    this.state = state;
    if (typeof errorMessage === 'string') this.errorMessage = errorMessage;
    this.refresh();
  }

  /**
   * ریست کامل — بعد از gmo.logout صدا زده می‌شود.
   * @param {'idle'|'not-logged-in'} state
   */
  reset(state) {
    try {
      this.cache.clear();
    } catch (e) {
      console.warn('[Hub] cache.clear failed:', e && e.message);
    }
    this.myStrategies = [];
    this.forkedStrategies = [];
    this.errorMessage = '';
    this.state = state || 'not-logged-in';
    this.refresh();
  }

  /**
   * بارگذاری لیست استراتژی‌ها (با کش ۵ دقیقه‌ای).
   */
  async load() {
    this.state = 'loading';
    this.refresh();

    // چک توکن (هویت واحد)
    const hasToken = await this.client.hasToken();
    if (!hasToken) {
      this.state = 'not-logged-in';
      this.refresh();
      return;
    }

    // چک کش
    const cached = this.cache.get('list');
    if (cached) {
      this._applyList(cached);
      this.state = 'ready';
      this.refresh();
      return;
    }

    // درخواست
    const res = await this.client.list({
      tab: 'mine',
      sort: 'newest',
      page: 1,
      limit: 100,
    });

    if (!res.ok) {
      if (res.error && res.error.code === 'AUTH_REQUIRED') {
        this.state = 'not-logged-in';
      } else {
        this.state = 'error';
        this.errorMessage = toFriendlyMessage(res.error);
      }
      this.refresh();
      return;
    }

    const items = res.items || [];
    this._applyList(items);
    this.cache.set('list', items);
    this.state = 'ready';
    this.refresh();
  }

  /** پاک کردن کش و بارگذاری مجدد. */
  async forceReload() {
    this.cache.clear();
    await this.load();
  }

  /**
   * جدا کردن forkها از غیر-forkها.
   */
  _applyList(items) {
    this.myStrategies = items.filter((s) => !s.isForked);
    this.forkedStrategies = items.filter((s) => s.isForked);
  }

  // ==========================================================
  // TreeDataProvider interface
  // ==========================================================

  getTreeItem(element) {
    return element;
  }

  async getChildren(element) {
    // ریشه
    if (!element) {
      return this._getRootChildren();
    }

    // زیرگروه‌ها
    if (element.contextValue === 'gmoGroupMine') {
      return this._getStrategyItems(this.myStrategies);
    }
    if (element.contextValue === 'gmoGroupForked') {
      return this._getStrategyItems(this.forkedStrategies);
    }

    return [];
  }

  _getRootChildren() {
    if (this.state === 'loading') {
      return [
        this._actionItem('در حال بارگذاری...', 'loading', 'sync~spin', ''),
      ];
    }

    if (this.state === 'not-logged-in') {
      return [
        this._actionItem(
          'برای مشاهده استراتژی‌ها خود در مخزن، وارد حساب خود شوید',
          'login',
          'account',
          'gmo.login'
        ),
      ];
    }

    if (this.state === 'error') {
      return [
        this._actionItem(
          '❌ ' + (this.errorMessage || 'خطا در ارتباط با سرور'),
          'error',
          'error',
          'gmo.hub.refresh'
        ),
        this._actionItem(
          'تلاش مجدد',
          'retry',
          'refresh',
          'gmo.hub.refresh'
        ),
      ];
    }

    if (this.state === 'idle') {
      return [
        this._actionItem(
          'برای بارگذاری، روی Refresh بزنید',
          'idle',
          'info',
          'gmo.hub.refresh'
        ),
      ];
    }

    // ready
    const items = [];

    const mineGroup = new vscode.TreeItem(
      `استراتژی‌های من (${this.myStrategies.length})`,
      vscode.TreeItemCollapsibleState.Expanded
    );
    mineGroup.iconPath = new vscode.ThemeIcon('folder-library');
    mineGroup.contextValue = 'gmoGroupMine';
    items.push(mineGroup);

    const forkedGroup = new vscode.TreeItem(
      `استراتژی‌های فورک‌شده (${this.forkedStrategies.length})`,
      vscode.TreeItemCollapsibleState.Collapsed
    );
    forkedGroup.iconPath = new vscode.ThemeIcon('repo-forked');
    forkedGroup.contextValue = 'gmoGroupForked';
    items.push(forkedGroup);

    return items;
  }

  _actionItem(label, actionId, icon, command) {
    const item = new vscode.TreeItem(
      label,
      vscode.TreeItemCollapsibleState.None
    );
    item.iconPath = new vscode.ThemeIcon(icon);
    item.contextValue = CTX_HUB_ACTION;
    item.tooltip = label;
    if (command) {
      item.command = { command, title: label };
    }
    return item;
  }

  _getStrategyItems(strategies) {
    if (!strategies.length) {
      const empty = new vscode.TreeItem(
        '— خالی —',
        vscode.TreeItemCollapsibleState.None
      );
      empty.iconPath = new vscode.ThemeIcon('info');
      return [empty];
    }
    return strategies.map((s) => this._strategyItem(s));
  }

  _strategyItem(s) {
    const label = `${s.name} v${s.version}`;

    const winRate = (s.winRate || 0).toFixed(1);
    const pf = (s.profitFactor || 0).toFixed(2);
    const desc = `win ${winRate}% · PF ${pf}`;

    const item = new vscode.TreeItem(
      label,
      vscode.TreeItemCollapsibleState.None
    );
    item.description = desc;
    item.tooltip = this._buildTooltip(s);
    item.contextValue = CTX_STRATEGY;

    if (!s.isPublished) {
      item.iconPath = new vscode.ThemeIcon('eye-closed');
    } else if (s.isVerified) {
      item.iconPath = new vscode.ThemeIcon('verified');
    } else {
      item.iconPath = new vscode.ThemeIcon('file-code');
    }

    item.command = {
      command: 'gmo.hub.openStrategy',
      title: 'Open Strategy',
      arguments: [s],
    };

    // برای دسترسی در commands
    item._strategy = s;

    return item;
  }

  _buildTooltip(s) {
    const lines = [
      `**${s.name}** v${s.version}`,
      '',
      s.description || '_بدون توضیحات_',
      '',
      `- نرخ برد: **${(s.winRate || 0).toFixed(1)}%**`,
      `- فاکتور سود: **${(s.profitFactor || 0).toFixed(2)}**`,
      `- بازده: **${(s.returnPercent || 0).toFixed(2)}%**`,
      `- حداکثر افت: **${(s.maxDrawdownPercent || 0).toFixed(2)}%**`,
      `- معاملات: **${s.totalTrades || 0}**`,
      `- ID: \`${s.id}\``,
      s.isPublished ? '' : '\n⚠️ **منتشر نشده**',
    ];
    return lines.join('\n');
  }
}

module.exports = { HubTreeProvider, CTX_STRATEGY, CTX_HUB_ACTION };