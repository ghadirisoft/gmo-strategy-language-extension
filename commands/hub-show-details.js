// commands/hub-show-details.js
'use strict';

const vscode = require('vscode');
const { toFriendlyMessage } = require('../hub/hub-errors');
const { normalizeStrategyArg, ensureLoggedIn } = require('./_helpers');

/**
 * @param {object} deps
 * @param {import('../hub/hub-client').HubClient} deps.client
 */
async function hubShowDetails(deps, strategyArg) {
  const { client } = deps;

  // ⭐ اطمینان از ورود (هویت واحد)
  if (!(await ensureLoggedIn(client))) return;

  const strategy = normalizeStrategyArg(strategyArg);
  if (!strategy) {
    vscode.window.showWarningMessage(
      'از منوی راست‌کلیک روی استراتژی استفاده کنید، یا از "انتخاب سریع" استفاده کنید.'
    );
    return;
  }

  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `در حال دریافت جزئیات ${strategy.name}...`,
      cancellable: false,
    },
    async () => {
      try {
        return await client.get(strategy.id);
      } catch (err) {
        return {
          ok: false,
          error: { code: 'NETWORK_ERROR', message: err.message },
        };
      }
    }
  );

  if (!result.ok) {
    vscode.window.showErrorMessage(toFriendlyMessage(result.error));
    return;
  }

  const s = result.strategy || {};
  const bt = s.backtest || {};

  const panel = vscode.window.createWebviewPanel(
    'gmoHubDetails',
    `جزئیات: ${s.name}`,
    vscode.ViewColumn.Beside,
    { enableScripts: false }
  );

  panel.webview.html = buildHtml(s, bt);
}

function buildHtml(s, bt) {
  const esc = (v) =>
    String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const fmt = (v, dec) => {
    if (typeof v !== 'number' || isNaN(v)) return '—';
    return v.toFixed(typeof dec === 'number' ? dec : 2);
  };

  const winRateClass =
    bt.winRate >= 60 ? 'good' : bt.winRate >= 40 ? 'warn' : 'bad';

  return `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>

<meta charset="UTF-8">
<style>
  body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px 24px;
         background: #fff; color: #1e1e1e; line-height: 1.8; direction: rtl; margin: 0; }
  h1 { font-size: 20px; color: #0a2b5c; margin: 0 0 4px; }
  .sub { color: #7a8a9e; font-size: 13px; margin-bottom: 20px; }
  .desc { background: #fafbfc; padding: 12px 16px; border-radius: 8px;
          border-right: 3px solid #e8a838; margin-bottom: 20px;
          font-size: 13px; color: #333; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 12px; margin-bottom: 20px; }
  .card { background: #fafbfc; border: 1px solid #e2e8f0; border-radius: 10px;
          padding: 14px 16px; }
  .card-label { font-size: 12px; color: #7a8a9e; margin-bottom: 4px; }
  .card-value { font-size: 18px; font-weight: 700; color: #0a2b5c; }
  .card-value.good { color: #22a67e; }
  .card-value.warn { color: #e8b82a; }
  .card-value.bad  { color: #dc3545; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px;
           font-size: 11px; font-weight: 600; margin-right: 6px; }
  .badge.public { background: rgba(34,166,126,0.12); color: #22a67e; }
  .badge.private { background: rgba(122,138,158,0.15); color: #7a8a9e; }
  .badge.warn { background: rgba(232,184,42,0.15); color: #b8860b; }
  .badge.ok { background: rgba(34,166,126,0.15); color: #15803d; }
</style>
</head>
<body>
<h1>${esc(s.name)} <span style="font-size:13px;color:#7a8a9e;">v${esc(s.version)}</span></h1>
<div class="sub">
  <p style="direction: ltr;">${esc(s.author || 'ناشناس')}</p>
  ${
    s.codeAccess === 'public'
      ? '<span class="badge public">کد عمومی</span>'
      : '<span class="badge private">کد خصوصی</span>'
  }
  ${s.isPublished ? '<span class="badge ok">منتشر شده</span>' : '<span class="badge warn">منتشر نشده</span>'}
  ${s.isVerified ? '<span class="badge ok">✔ تأیید شده</span>' : ''}
</div>
${s.description ? `<div class="desc">${esc(s.description)}</div>` : ''}
<h2 style="font-size:15px; color:#0a2b5c; margin-bottom:12px;">📊 آمار بک‌تست</h2>
<div class="grid">
  <div class="card"><div class="card-label">نرخ برد</div>
    <div class="card-value ${winRateClass}">${fmt(bt.winRate, 1)}٪</div></div>
  <div class="card"><div class="card-label">فاکتور سود</div>
    <div class="card-value">${fmt(bt.profitFactor, 2)}</div></div>
  <div class="card"><div class="card-label">بازده</div>
    <div class="card-value ${bt.returnPercent >= 0 ? 'good' : 'bad'}">${bt.returnPercent >= 0 ? '+' : ''}${fmt(bt.returnPercent, 2)}٪</div></div>
  <div class="card"><div class="card-label">حداکثر افت</div>
    <div class="card-value warn">${fmt(bt.maxDrawdownPercent, 2)}٪</div></div>
  <div class="card"><div class="card-label">تعداد معاملات</div>
    <div class="card-value">${bt.totalTrades || 0}</div></div>
  <div class="card"><div class="card-label">سود کل</div>
    <div class="card-value ${bt.totalProfit >= 0 ? 'good' : 'bad'}">${(bt.totalProfit || 0).toLocaleString('fa-IR')} تومان</div></div>
  <div class="card"><div class="card-label">بهترین معامله</div>
    <div class="card-value good">${(bt.bestTrade || 0).toLocaleString('fa-IR')} تومان</div></div>
  <div class="card"><div class="card-label">بدترین معامله</div>
    <div class="card-value bad">${(bt.worstTrade || 0).toLocaleString('fa-IR')} تومان</div></div>
</div>
<p style="font-size:12px; color:#7a8a9e; margin-top:20px;">ID: <code>${esc(s.id)}</code></p>

</body>
</html>`;
}

module.exports = { hubShowDetails };
