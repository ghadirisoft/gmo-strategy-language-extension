const vscode = require('vscode');

// ============================================================
// تنظیمات پیش‌فرض (قابل override با settings کاربر)
// ============================================================
const DEFAULT_OPTIONS = {
  indentSize: 2,
  useTabs: false,
  alignAssignments: true,
  alignArrow: true,
  uppercaseKeywords: true,
  addSpaceAroundOperators: true,
  trimTrailingSpaces: true,
  emptyLineBetweenBlocks: true,
  finalNewline: true,
};

function getOptions() {
  const cfg = vscode.workspace.getConfiguration('gmo.format');
  return {
    indentSize: cfg.get('indentSize', DEFAULT_OPTIONS.indentSize),
    useTabs: cfg.get('useTabs', DEFAULT_OPTIONS.useTabs),
    alignAssignments: cfg.get('alignAssignments', DEFAULT_OPTIONS.alignAssignments),
    alignArrow: cfg.get('alignArrow', DEFAULT_OPTIONS.alignArrow),
    uppercaseKeywords: cfg.get('uppercaseKeywords', DEFAULT_OPTIONS.uppercaseKeywords),
    addSpaceAroundOperators: cfg.get(
      'addSpaceAroundOperators',
      DEFAULT_OPTIONS.addSpaceAroundOperators
    ),
    trimTrailingSpaces: cfg.get(
      'trimTrailingSpaces',
      DEFAULT_OPTIONS.trimTrailingSpaces
    ),
    emptyLineBetweenBlocks: cfg.get(
      'emptyLineBetweenBlocks',
      DEFAULT_OPTIONS.emptyLineBetweenBlocks
    ),
    finalNewline: cfg.get('finalNewline', DEFAULT_OPTIONS.finalNewline),
  };
}

// ============================================================
// جدا کردن کامنت از کد (با احترام به رشته‌های تک‌کوتیشنی)
// ============================================================
function splitLineComment(line) {
  let inString = false;
  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i];
    if (ch === "'") {
      inString = !inString;
    } else if (!inString && ch === '/' && line[i + 1] === '/') {
      return {
        code: line.slice(0, i),
        comment: line.slice(i),
      };
    }
  }
  return { code: line, comment: '' };
}

// ============================================================
// نرمال‌سازی اپراتورها
// ============================================================
function normalizeOperators(code, opts) {
  if (!opts.addSpaceAroundOperators) return code;

  let s = code;

  // --- مرحله ۱: پلیس‌هولدر برای عملگرهای دو-کاراکتری ---
  const PH = {
    '->': '\u0001',
    '>=': '\u0002',
    '<=': '\u0003',
    '<>': '\u0004',
  };
  s = s.replace(/->|>=|<=|<>/g, (m) => PH[m]);

  // --- مرحله ۲: محافظت از رشته‌های تک‌کوتیشنی ---
  const strings = [];
  s = s.replace(/'[^']*'/g, (m) => {
    strings.push(m);
    return '\u0005' + (strings.length - 1) + '\u0006';
  });

  // --- مرحله ۳: یکسان‌سازی حروف عملگرهای منطقی ---
  s = s.replace(/\b(and|or|not)\b/gi, (m) => m.toUpperCase());

  // --- مرحله ۴: محافظت کامل از عملگرهای منطقی ---
  //     هر AND/OR/NOT (با هر فاصله یا چسبیدگی قبل/بعد) را با پلیس‌هولدر
  //     احاطه می‌کنیم تا مراحل نرمال‌سازی پرانتز و عملگر به آن دست نزنند.
  //     از \u0007 به‌عنوان «نشانگر مرز» استفاده می‌کنیم.
  const LOGICAL_MARK = '\u0007';
  s = s.replace(/\b(AND|OR|NOT|IF)\b/g, (_, kw) => {
    return LOGICAL_MARK + kw + LOGICAL_MARK;
  });

  // --- مرحله ۵: نرمال‌سازی عملگرها ---
  s = s.replace(/\s*([=+\-*/<>])\s*/g, ' $1 ');
  s = s.replace(/\s*,\s*/g, ', ');

  // پرانتز باز: فاصلهٔ داخلی حذف می‌شود (BUY( نه BUY ( )
  s = s.replace(/[ \t]*\([ \t]*/g, '(');
  // پرانتز بسته: فاصلهٔ داخلی حذف می‌شود
  s = s.replace(/[ \t]*\)/g, ')');

  s = s.replace(/[ \t]+/g, ' ');

  // --- مرحله ۶: بازگرداندن رشته‌ها ---
  s = s.replace(/\u0005(\d+)\u0006/g, (_, i) => strings[Number(i)]);

  // --- مرحله ۷: بازگرداندن عملگرهای دو-کاراکتری ---
  for (const k of Object.keys(PH)) {
    s = s.split(PH[k]).join(' ' + k + ' ');
  }

  // --- مرحله ۸: بازگرداندن عملگرهای منطقی با فاصلهٔ صحیح ---
  //     LOGICAL_MARK را با یک فاصله جایگزین می‌کنیم.
  //     توجه: چون مارک در دو طرف کلمه است، خروجی « AND » می‌شود.
  //     سپس فاصله‌های اضافی را جمع می‌کنیم.
  s = s.split(LOGICAL_MARK).join(' ');

  // --- مرحله ۹: تمیزکاری نهایی ---
  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/^\s+|\s+$/g, '');

  return s;
}


// ============================================================
// فرمت‌کردن کامل متن
// ============================================================
function formatGmoText(text, opts) {
  if (!text) return text;

  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const rawLines = text.split(/\r?\n/);

  const indentUnit = opts.useTabs ? '\t' : ' '.repeat(opts.indentSize);

  const records = [];
  let section = null;

  for (let raw of rawLines) {
    const { code, comment } = splitLineComment(raw);
    let trimmedCode = code.trim();

    // خط خالی
    if (trimmedCode === '' && comment.trim() === '') {
      records.push({ type: 'blank' });
      continue;
    }

    // خط فقط کامنت
    if (trimmedCode === '') {
      records.push({ type: 'comment', comment: comment.trim() });
      continue;
    }

    let m;

    // STRATEGY / VERSION / DESCRIPTION
    if ((m = /^strategy\s+(.+)$/i.exec(trimmedCode))) {
      records.push({
        type: 'header',
        keyword: 'STRATEGY',
        value: m[1].trim(),
        comment: comment.trim(),
      });
      continue;
    }
    if ((m = /^version\s+(.+)$/i.exec(trimmedCode))) {
      records.push({
        type: 'header',
        keyword: 'VERSION',
        value: m[1].trim(),
        comment: comment.trim(),
      });
      continue;
    }
    if ((m = /^description\s*:?\s*(.*)$/i.exec(trimmedCode))) {
      records.push({
        type: 'header',
        keyword: 'DESCRIPTION',
        value: m[1].trim(),
        comment: comment.trim(),
      });
      continue;
    }

    // PARAMETERS:
    if (/^parameters\s*:/i.test(trimmedCode)) {
      section = 'parameters';
      records.push({ type: 'section', name: 'PARAMETERS' });
      continue;
    }

    // RULES:
    if (/^rules\s*:/i.test(trimmedCode)) {
      section = 'rules';
      records.push({ type: 'section', name: 'RULES' });
      continue;
    }

    // END
    if (/^end\b/i.test(trimmedCode)) {
      section = null;
      records.push({ type: 'end' });
      continue;
    }

    // داخل PARAMETERS
    if (section === 'parameters') {
      if ((m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/i.exec(trimmedCode))) {
        records.push({
          type: 'param',
          name: m[1],
          expr: m[2].trim(),
          comment: comment.trim(),
        });
        continue;
      }
    }

    // داخل RULES
    if (section === 'rules') {
      records.push({
        type: 'rule',
        code: normalizeOperators(trimmedCode, opts),
        comment: comment.trim(),
      });
      continue;
    }

    // هر چیز ناشناخته
    records.push({
      type: 'raw',
      code: normalizeOperators(trimmedCode, opts),
      comment: comment.trim(),
    });
  }

  // --- تراز کردن PARAMETERS ---
  if (opts.alignAssignments) {
    const params = records.filter((r) => r.type === 'param');
    if (params.length > 1) {
      const maxName = Math.max(...params.map((p) => p.name.length));
      for (const p of params) {
        p.namePadding = ' '.repeat(maxName - p.name.length);
      }
    }
  }

  // --- تراز کردن RULES (تراز '->') ---
  if (opts.alignArrow) {
    const rules = records.filter((r) => r.type === 'rule');
    if (rules.length > 1) {
      const arrowPositions = rules.map((r) => r.code.indexOf('->'));
      const maxArrow = Math.max(...arrowPositions.map((v) => (v < 0 ? 0 : v)));
      for (const r of rules) {
        const pos = r.code.indexOf('->');
        r.leftPad = pos >= 0 ? ' '.repeat(Math.max(0, maxArrow - pos)) : '';
      }
    }
  }

  // --- رندر خروجی ---
  const out = [];
  let lastEmitted = null;

  const emit = (lineObj) => {
    out.push(lineObj);
    lastEmitted = lineObj;
  };

  for (let i = 0; i < records.length; i++) {
    const r = records[i];

    if (r.type === 'blank') {
      if (lastEmitted && lastEmitted.type === 'blank') continue;
      emit({ type: 'blank' });
      continue;
    }

    let lineText = '';

    switch (r.type) {
      case 'comment':
        lineText = indentUnit + r.comment;
        break;
      case 'header': {
        const kw = r.keyword;
        const val = r.value
          ? r.keyword === 'DESCRIPTION'
            ? ': ' + r.value
            : ' ' + r.value
          : '';
        // هدرها بدون تورفتگی (مثل END) در ابتدای سطر قرار می‌گیرند
        lineText = kw + val;
        if (r.comment) lineText += '  ' + r.comment;
        break;
      }
      case 'section':
        // PARAMETERS: و RULES: هم بدون تورفتگی
        lineText = r.name + ':';
        break;
      case 'end':
        lineText = 'END';
        break;
      case 'param': {
        const name = opts.uppercaseKeywords
          ? r.name.toUpperCase()
          : r.name;
        const pad = r.namePadding || '';
        const expr = normalizeOperators(r.expr, opts);
        lineText = indentUnit + indentUnit + name + pad + ' = ' + expr;
        if (r.comment) lineText += '  ' + r.comment;
        break;
      }
      case 'rule': {
        const leftPad = r.leftPad || '';
        lineText = indentUnit + indentUnit + r.code.replace('->', leftPad + '->');
        if (r.comment) lineText += '  ' + r.comment;
        break;
      }
      case 'raw':
      default: {
        lineText = indentUnit + (r.code || '');
        if (r.comment) lineText += '  ' + r.comment;
        break;
      }
    }

    if (opts.trimTrailingSpaces) lineText = lineText.replace(/[ \t]+$/, '');
    emit({ type: r.type, text: lineText });
  }

  // حذف خطوط خالی انتهایی
  while (out.length && out[out.length - 1].type === 'blank') out.pop();

  const result = out.map((o) => (o.type === 'blank' ? '' : o.text)).join(eol);

  return opts.finalNewline ? result + eol : result;
}

// ============================================================
// ثبت Provider
// ============================================================
function registerFormatter(context) {
  const provider = vscode.languages.registerDocumentFormattingEditProvider(
    { language: 'gmo', scheme: 'file' },
    {
      provideDocumentFormattingEdits(document, options, token) {
        const opts = getOptions();
        // اگر کاربر تنظیم VS Code برای تب دارد، آن را ترجیح بده
        if (options && typeof options.tabSize === 'number') {
          opts.indentSize = options.tabSize;
          opts.useTabs = !options.insertSpaces;
        }

        const original = document.getText();
        const formatted = formatGmoText(original, opts);

        if (formatted === original) return [];

        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(original.length)
        );
        return [vscode.TextEdit.replace(fullRange, formatted)];
      },
    }
  );

  context.subscriptions.push(provider);
  return provider;
}

module.exports = {
  registerFormatter,
  formatGmoText,
};