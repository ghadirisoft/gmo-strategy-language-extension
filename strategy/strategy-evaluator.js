// strategy-evaluator.js
// ============================================================
// موتور ارزیابی استراتژی GMO
//
// وظیفه:
//   ۱) عبارات PARAMETERS را ارزیابی می‌کند (مثل PRICE = FIELD(5) * 1.01).
//   ۲) توابع آماری (LAST_*, MIN_*, MAX_*, AVG_*) را با مقادیر دریافتی
//      از APIها جایگذاری می‌کند.
//   ۳) برای هر قانون، SIGNAL مقایسه می‌شود و در صورت تطابق، شرط IF
//      ارزیابی می‌شود.
//   ۴) خروجی: { parameters, rules, errors } که هر قانون شامل
//      code, evaluatedCode, matched, error است.
//
// این ماژول خالص (pure) است — هیچ وابستگی به vscode ندارد و
// در تست‌های Node.js قابل اجراست.
// ============================================================

'use strict';

const parser = require('../parser');
const { getField } = require('./strategy-fields');

// ============================================================
// بخش ۱: توکن‌سازی عبارات
// ============================================================

/**
 * یک عبارت GMO را به توکن‌ها می‌شکند.
 *
 * توکن‌ها:
 *   { type: 'num', value: <number> }
 *   { type: 'str', value: <string> }
 *   { type: 'id',  value: <string> }   // شناسه: متغیر، تابع، کلیدواژه
 *   { type: 'op',  value: <string> }   // = < > <> <= >= + - * /
 *   { type: 'lparen' } / { type: 'rparen' }
 *   { type: 'comma' }
 *   { type: 'colon' }
 *
 * @param {string} text
 * @returns {Array<object>}
 */
function tokenize(text) {
  const tokens = [];
  let i = 0;
  let s = text;

  while (i < s.length) {
    const ch = s[i];

    // فضای خالی
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      i++;
      continue;
    }

    // رشته تک‌کوتیشنی
    if (ch === "'") {
      let j = i + 1;
      let val = '';
      while (j < s.length && s[j] !== "'") {
        val += s[j];
        j++;
      }
      // اگر به انتهای رشته رسیدیم بدون بسته‌شدن
      if (j >= s.length) {
        throw new Error('رشته تک‌کوتیشنی بسته نشده است');
      }
      tokens.push({ type: 'str', value: val });
      i = j + 1;
      continue;
    }

    // عدد — شامل اعشار و منفی یکانی؟ منفی را در `parseExpression` به‌عنوان
    // عملگر یکانی handle می‌کنیم، نه در توکنایزر.
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(s[i + 1] || ''))) {
      let j = i;
      let val = '';
      while (j < s.length && /[0-9.]/.test(s[j])) {
        val += s[j];
        j++;
      }

      // پسوند واحدهای زمانی GMO: 36H, 90M, 3D, -12H و...
      // این‌ها باید به‌صورت یک رشته شناسه‌ای توکنایز شوند تا بتوانیم
      // آنها را به API پاس بدهیم.
      if (j < s.length && /[HhMmDd]/.test(s[j])) {
        // فقط یکی از این کاراکترها را بگیر (مثلاً 36H با H، نه HH).
        val += s[j];
        j++;
        // فقط اگر بلافاصله بعدش یک کاراکتر غیرحرفی باشد (تا 5Hours نشود)
        // در غیر این صورت، آن حرف را هم بگیر (مثلاً اگر روزی 5Days شد)
        // برای الان، فقط یک حرف را قبول می‌کنیم.
        tokens.push({ type: 'time-offset', value: val });
        i = j;
        continue;
      }

      tokens.push({ type: 'num', value: parseFloat(val) });
      i = j;
      continue;
    }

    // شناسه / کلیدواژه
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      let val = '';
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) {
        val += s[j];
        j++;
      }
      tokens.push({ type: 'id', value: val });
      i = j;
      continue;
    }

    // عملگرهای دو-کاراکتری
    const two = s.substr(i, 2);
    if (two === '>=' || two === '<=' || two === '<>') {
      tokens.push({ type: 'op', value: two });
      i += 2;
      continue;
    }

    // عملگرهای تک‌کاراکتری
    if (ch === '>' || ch === '<' || ch === '=' || ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    // پرانتز، کاما، کولون
    if (ch === '(') { tokens.push({ type: 'lparen' }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'rparen' }); i++; continue; }
    if (ch === ',') { tokens.push({ type: 'comma' }); i++; continue; }
    if (ch === ':') { tokens.push({ type: 'colon' }); i++; continue; }

    throw new Error('کاراکتر ناشناخته در عبارت: ' + ch);
  }

  return tokens;
}

// ============================================================
// بخش ۲: پارسر عبارات → AST
// ============================================================

/**
 * پارسر عبارات — یک descent-recursive parser.
 *
 * گرامر (به ترتیب precedence از کم به زیاد):
 *   logical    := comparison ( ( AND | OR ) comparison )*
 *                | NOT logical
 *   comparison := additive ( ( '>' | '<' | '>=' | '<=' | '=' | '<>' ) additive )?
 *   additive    := multiplicative ( ( '+' | '-' ) multiplicative )*
 *   multiplicative := unary ( ( '*' | '/' ) unary )*
 *   unary       := '-' unary | primary
 *   primary     := number | string | functionCall | identifier | '(' logical ')'
 *   functionCall := IDENTIFIER '(' ( logical (',' logical)* )? ')'
 *
 * @param {Array<object>} tokens
 * @returns {object} AST
 */
class ExprParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek() {
    return this.tokens[this.pos] || null;
  }

  next() {
    const t = this.tokens[this.pos];
    this.pos++;
    return t;
  }

  expect(type) {
    const t = this.next();
    if (!t || t.type !== type) {
      throw new Error(`انتظار ${type} بود ولی ${t ? t.type : 'پایان'} پیدا شد`);
    }
    return t;
  }

  /**
   * بررسی اینکه آیا توکن جاری یک کلیدواژه منطقی است (AND/OR/NOT).
   * @param {string} kw کلیدواژه با حروف بزرگ.
   * @returns {boolean}
   */
  isKeyword(kw) {
    const t = this.peek();
    return t && t.type === 'id' && t.value.toUpperCase() === kw;
  }

  parseLogical() {
    // NOT — فقط در ابتدای عبارت منطقی.
    if (this.isKeyword('NOT')) {
      this.next();
      const operand = this.parseLogical();
      return { kind: 'unary', op: 'NOT', operand };
    }

    let left = this.parseComparison();

    while (this.isKeyword('AND') || this.isKeyword('OR')) {
      const op = this.next().value.toUpperCase();
      const right = this.parseComparison();
      left = { kind: 'binop', op, left, right };
    }

    return left;
  }

  parseComparison() {
    let left = this.parseAdditive();

    while (this.peek() && this.peek().type === 'op' &&
           ['>', '<', '>=', '<=', '=', '<>'].includes(this.peek().value)) {
      const op = this.next().value;
      const right = this.parseAdditive();
      left = { kind: 'binop', op, left, right };
    }

    return left;
  }

  parseAdditive() {
    let left = this.parseMultiplicative();

    while (this.peek() && this.peek().type === 'op' &&
           ['+', '-'].includes(this.peek().value)) {
      const op = this.next().value;
      const right = this.parseMultiplicative();
      left = { kind: 'binop', op, left, right };
    }

    return left;
  }

  parseMultiplicative() {
    let left = this.parseUnary();

    while (this.peek() && this.peek().type === 'op' &&
           ['*', '/'].includes(this.peek().value)) {
      const op = this.next().value;
      const right = this.parseUnary();
      left = { kind: 'binop', op, left, right };
    }

    return left;
  }

  parseUnary() {
    if (this.peek() && this.peek().type === 'op' && this.peek().value === '-') {
      this.next();
      const operand = this.parseUnary();
      return { kind: 'unary', op: '-', operand };
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    const t = this.peek();
    if (!t) throw new Error('عبارت ناقص است');

    // عدد
    if (t.type === 'num') {
      this.next();
      return { kind: 'num', value: t.value };
    }

    // واحد زمانی (مثل 36H, 3D, -12H) — به‌صورت یک رشته‌ی literal
    if (t.type === 'time-offset') {
      this.next();
      return { kind: 'str', value: t.value, isTimeOffset: true };
    }

    // رشته
    if (t.type === 'str') {
      this.next();
      return { kind: 'str', value: t.value };
    }

    // پرانتز
    if (t.type === 'lparen') {
      this.next();
      const expr = this.parseLogical();
      this.expect('rparen');
      return expr;
    }

    // شناسه / تابع / کلیدواژه منطقی (NOT در ابتدای پرانتز)
    if (t.type === 'id') {
      this.next();
      const name = t.value;

      // تابع
      if (this.peek() && this.peek().type === 'lparen') {
        this.next(); // '('
        const args = [];
        if (this.peek() && this.peek().type !== 'rparen') {
          args.push(this.parseLogical());
          while (this.peek() && this.peek().type === 'comma') {
            this.next();
            args.push(this.parseLogical());
          }
        }
        this.expect('rparen');
        return { kind: 'call', name, args };
      }

      // متغیر
      return { kind: 'var', name };
    }

    throw new Error(`توکن غیرمنتظره: ${t.type} (${t.value !== undefined ? t.value : ''})`);
  }
}

function parseExpression(text) {
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    throw new Error('عبارت خالی است');
  }
  const p = new ExprParser(tokens);
  const ast = p.parseLogical();
  if (p.pos < tokens.length) {
    throw new Error('توکن اضافی در انتهای عبارت');
  }
  return ast;
}

// ============================================================
// بخش ۳: ارزیابی AST با context
// ============================================================

/**
 * تبدیل AST به نمایش متنی (با مقادیر جایگذاری‌شده).
 * این تابع برای تولید «کد ارزیابی‌شده» استفاده می‌شود — یعنی
 * همان عبارت ولی با متغیرها و توابع به مقادیرشان جایگذاری شده.
 *
 * @param {object} ast
 * @param {Map<string, any>} context نگاشت نام متغیر → مقدار
 * @returns {any} مقدار نهایی عبارت
 */
function evalAst(ast, context) {
  if (!ast) return null;

  switch (ast.kind) {
    case 'num':
      return ast.value;

    case 'str':
      return ast.value;

    case 'var': {
      const name = ast.name.toUpperCase();
      if (context.has(name)) {
        return context.get(name);
      }
      // شناسه‌های سیگنال (GREEN/BLUE/YELLOW/RED) — اگر در context نبودند،
      // به‌عنوان ثابت رشته‌ای برگردان (تا LAST_CONFIDENCE(GREEN) کار کند).
      const SIGNALS = ['GREEN', 'BLUE', 'YELLOW', 'RED'];
      if (SIGNALS.includes(name)) {
        return name;
      }
      throw new Error(`متغیر تعریف‌نشده: ${ast.name}`);
    }

    case 'unary': {
      if (ast.op === 'NOT') {
        // NOT منطقی
        const v = evalAst(ast.operand, context);
        return !toBoolean(v);
      }
      // منفی عددی
      const v = evalAst(ast.operand, context);
      const n = toNumber(v);
      if (n === null) throw new Error(`عملگر منفی روی غیرعدد: ${v}`);
      return -n;
    }

    case 'binop': {
      // AND / OR منطقی
      if (ast.op === 'AND' || ast.op === 'OR') {
        const l = toBoolean(evalAst(ast.left, context));
        const r = toBoolean(evalAst(ast.right, context));
        return ast.op === 'AND' ? (l && r) : (l || r);
      }

      // مقایسه‌های منطقی
      if (['>', '<', '>=', '<=', '=', '<>'].includes(ast.op)) {
        const l = evalAst(ast.left, context);
        const r = evalAst(ast.right, context);

        // اگر هر دو عددی باشند، به‌صورت عددی مقایسه کن.
        const ln = toNumber(l);
        const rn = toNumber(r);

        if (ln !== null && rn !== null) {
          switch (ast.op) {
            case '>': return ln > rn;
            case '<': return ln < rn;
            case '>=': return ln >= rn;
            case '<=': return ln <= rn;
            case '=': return ln === rn;
            case '<>': return ln !== rn;
          }
        }

        // در غیر این صورت، مقایسه رشته‌ای.
        const ls = String(l);
        const rs = String(r);
        switch (ast.op) {
          case '>': return ls > rs;
          case '<': return ls < rs;
          case '>=': return ls >= rs;
          case '<=': return ls <= rs;
          case '=': return ls === rs;
          case '<>': return ls !== rs;
        }
      }

      // عملگرهای حسابی
      const l = evalAst(ast.left, context);
      const r = evalAst(ast.right, context);

      // + هم برای عدد و هم برای رشته (concat).
      if (ast.op === '+') {
        const ln = toNumber(l);
        const rn = toNumber(r);
        if (ln !== null && rn !== null) return ln + rn;
        return String(l) + String(r);
      }

      // - * / فقط عددی
      const ln2 = toNumber(l);
      const rn2 = toNumber(r);
      if (ln2 === null) throw new Error(`عملگر ${ast.op} روی غیرعدد: ${l}`);
      if (rn2 === null) throw new Error(`عملگر ${ast.op} روی غیرعدد: ${r}`);

      switch (ast.op) {
        case '-': return ln2 - rn2;
        case '*': return ln2 * rn2;
        case '/': return rn2 === 0 ? 0 : ln2 / rn2;
      }
      break;
    }

    case 'call': {
      const name = ast.name.toUpperCase();

      // FIELD(n) — مقدار از context.fieldValues می‌آید.
      if (name === 'FIELD') {
        if (ast.args.length !== 1) {
          throw new Error('FIELD فقط یک آرگومان می‌گیرد');
        }
        const idxAst = ast.args[0];
        if (idxAst.kind !== 'num' || !Number.isInteger(idxAst.value)) {
          throw new Error('FIELD(n) — n باید عدد صحیح باشد');
        }
        const idx = idxAst.value;
        const fv = context.get('__fieldValues__');
        if (!fv || !fv.has(idx)) {
          throw new Error(`FIELD(${idx}) مقدار ندارد`);
        }
        const raw = fv.get(idx);
        // اگر مقدار عددی است، به number تبدیل کن.
        // این برای کار کردن عملگرهای مقایسه‌ای (مثل > 70) لازم است.
        if (typeof raw === 'string') {
          const trimmed = raw.trim();
          if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
            const n = parseFloat(trimmed);
            if (!isNaN(n)) return n;
          }
        }
        return raw;
      }

      // توابع آماری — از context.functionResults می‌آیند.
      // توابع آماری با signature خاص خودشان:
      //   LAST_CONFIDENCE(source) — 1 آرگومان
      //   LAST_PRICE(source) — 1 آرگومان
      //   LAST_DATETIME(source, value) — 2 آرگومان (value: offset زمانی)
      //   MIN_CONFIDENCE(source, count) — 2 آرگومان
      //   MIN_PRICE(source, count) — 2 آرگومان
      //   MAX_CONFIDENCE(source, count) — 2 آرگومان
      //   MAX_PRICE(source, count) — 2 آرگومان
      //   AVG_CONFIDENCE(source, count) — 2 آرگومان
      //   AVG_PRICE(source, count) — 2 آرگومان
      const fr = context.get('__functionResults__');
      if (!fr) throw new Error(`نتایج توابع موجود نیست`);

      // ارزیابی آرگومان‌ها به مقادیر نهایی (معمولاً رشته‌ای source و عدد count)
      const argValues = ast.args.map((a) => evalAst(a, context));

      // کلید کش — باید دقیقاً با کلید استفاده‌شده در strategy-runner مطابقت کند:
      //   برای 1 آرگومان: NAME|SOURCE|null  (مثل LAST_CONFIDENCE|GREEN|null)
      //   برای 2 آرگومان: NAME|SOURCE|ARG2   (مثل MIN_PRICE|BLUE|10)
      let cacheKey;
      if (argValues.length === 1) {
        cacheKey = name + '|' + String(argValues[0]).toUpperCase() + '|null';
      } else if (argValues.length === 2) {
        cacheKey = name + '|' + String(argValues[0]).toUpperCase() + '|' + String(argValues[1]);
      } else {
        cacheKey = name + '|' + argValues.map(String).join('|');
      }

      if (!fr.has(cacheKey)) {
        // اگر مقدارش را نداریم (مثلاً API ناموفق بود)، خطا پرتاب کن.
        throw new Error(`مقدار تابع ${name}(${argValues.join(', ')}) موجود نیست`);
      }
      const val = fr.get(cacheKey);
      if (val === null || val === undefined) return null;

      // LAST_DATETIME یک مقدار تاریخ-زمان است؛ برای مقایسه‌ی >= با DATETIME،
      // هر دو را به timestamp تبدیل می‌کنیم.
      if (name === 'LAST_DATETIME') {
        return parseDateTimeValue(val);
      }

      // بقیه توابع عددی هستند.
      const n = toNumber(val);
      return n !== null ? n : val;
    }

    default:
      throw new Error(`نوع AST ناشناخته: ${ast.kind}`);
  }
}

/**
 * تبدیل مقدار به boolean.
 * - boolean → خودش
 * - number → 0=false, غیر صفر=true
 * - string → "TRUE"=true, "FALSE"=false, در غیر این صورت: number→boolean, "1"=true, "0"=false
 * - null/undefined → false
 * @param {any} v
 * @returns {boolean}
 */
function toBoolean(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toUpperCase();
    if (s === 'TRUE') return true;
    if (s === 'FALSE') return false;
    const n = toNumber(s);
    return n !== null ? n !== 0 : s.length > 0;
  }
  return !!v;
}

/**
 * تبدیل مقدار به عدد.
 * @param {any} v
 * @returns {number|null}
 */
function toNumber(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const s = v.trim();
    if (s === '') return null;
    // اجازه‌ی اعداد اعشاری و منفی
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }
  return null;
}

/**
 * تجزیه‌ی یک مقدار تاریخ-زمان به timestamp (میلی‌ثانیه).
 *
 * قالب‌های پشتیبانی‌شده (مطابق مستندات):
 *   - YYYY/MM/DD HH:MM:SS
 *   - YYYY-MM-DD HH:MM:SS
 *
 * این تابع برای مقایسه‌ی DATETIME با LAST_DATETIME(source, offset) استفاده می‌شود.
 * توجه: سمت سرور، LAST_DATETIME به‌صورت timestamp میلادی برمی‌گردد.
 *
 * @param {string} text
 * @returns {number|null}
 */
function parseDateTimeValue(text) {
  if (typeof text !== 'string') return null;
  const s = text.trim();
  if (!s) return null;

  // YYYY/MM/DD HH:MM:SS  یا  YYYY-MM-DD HH:MM:SS
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;

  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  const hour = m[4] ? parseInt(m[4], 10) : 0;
  const minute = m[5] ? parseInt(m[5], 10) : 0;
  const second = m[6] ? parseInt(m[6], 10) : 0;

  const dt = new Date(year, month - 1, day, hour, minute, second);
  if (isNaN(dt.getTime())) return null;
  return dt.getTime();
}

// ============================================================
// بخش ۴: جایگذاری مقادیر در نمایش متنی عبارت
// ============================================================

/**
 * AST را به رشته‌ی با-مقادیر تبدیل می‌کند — یعنی همان عبارت
 * ولی متغیرها و توابع به مقادیرشان جایگذاری شده‌اند.
 *
 * این تابع برای نمایش «کد ارزیابی‌شده» در webview استفاده می‌شود.
 * مثال:
 *   CONFIDENCE > 70 AND CONFIDENCE >= LAST_CONFIDENCE(GREEN)
 * با context: { CONFIDENCE: 75, LAST_CONFIDENCE(GREEN): 68 }
 * می‌شود:
 *   75 > 70 AND 75 >= 68
 *
 * @param {object} ast
 * @param {Map<string, any>} context
 * @returns {string}
 */
function astToDisplayString(ast, context) {
  if (!ast) return '';

  switch (ast.kind) {
    case 'num':
      return formatNum(ast.value);

    case 'str':
      return `'${ast.value}'`;

    case 'var': {
      const name = ast.name.toUpperCase();
      if (context.has(name)) {
        const v = context.get(name);
        return formatValue(v);
      }
      // شناسه‌های سیگنال (GREEN/BLUE/YELLOW/RED) — به‌عنوان نام خودشان نمایش بده.
      const SIGNALS = ['GREEN', 'BLUE', 'YELLOW', 'RED'];
      if (SIGNALS.includes(name)) {
        return name;
      }
      return ast.name; // اگر تعریف‌نشده، نام اصلی را نشان بده
    }

    case 'unary':
      if (ast.op === 'NOT') {
        return 'NOT ' + astToDisplayString(ast.operand, context);
      }
      return '-' + astToDisplayString(ast.operand, context);

    case 'binop': {
      const l = astToDisplayString(ast.left, context);
      const r = astToDisplayString(ast.right, context);
      // برای AND/OR هم فاصله بگذار
      const op = ast.op;
      return `${l} ${op} ${r}`;
    }

    case 'call': {
      const name = ast.name.toUpperCase();
      // FIELD(n) — مقدار فیلد کاربر
      if (name === 'FIELD') {
        if (ast.args.length === 1 && ast.args[0].kind === 'num') {
          const fv = context.get('__fieldValues__');
          const idx = ast.args[0].value;
          if (fv && fv.has(idx)) {
            return formatValue(fv.get(idx));
          }
        }
        // fallback به شکل اصلی
        return `${ast.name}(${ast.args.map((a) => astToDisplayString(a, context)).join(', ')})`;
      }

      // توابع آماری — مقدار از functionResults
      const fr = context.get('__functionResults__');
      // arg values را با evalAst ارزیابی کن (نه با astToDisplayString) تا
      // برای شناسه‌های سیگنال مثل GREEN به 'GREEN' تبدیل شوند.
      const argValues = ast.args.map((a) => {
        try { return evalAst(a, context); }
        catch (e) { return astToDisplayString(a, context); }
      });

      // کلید کش: NAME|arg1|arg2|...
      // برای LAST_CONFIDENCE که 1 آرگومان دارد، کلید می‌شود: LAST_CONFIDENCE|GREEN|null
      // برای MIN_PRICE(BLUE, 10) کلید می‌شود: MIN_PRICE|BLUE|10
      let cacheKey;
      if (argValues.length === 1) {
        cacheKey = name + '|' + String(argValues[0]).toUpperCase() + '|null';
      } else if (argValues.length === 2) {
        cacheKey = name + '|' + String(argValues[0]).toUpperCase() + '|' + String(argValues[1]);
      } else {
        cacheKey = name + '|' + argValues.map(String).join('|');
      }

      if (fr && fr.has(cacheKey)) {
        return formatValue(fr.get(cacheKey));
      }
      // اگر مقدارش را نداشتیم، همان عبارت اصلی را نشان بده
      return `${ast.name}(${ast.args.map((a) => astToDisplayString(a, context)).join(', ')})`;
    }

    default:
      return '';
  }
}

/**
 * قالب‌بندی مقدار برای نمایش.
 * @param {any} v
 * @returns {string}
 */
function formatValue(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return formatNum(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

/**
 * قالب‌بندی عدد — حذف صفر اعشار اضافی.
 * @param {number} n
 * @returns {string}
 */
function formatNum(n) {
  if (typeof n !== 'number') return String(n);
  if (Number.isInteger(n)) return String(n);
  return String(n);
}

// ============================================================
// بخش ۵: ارزیابی یک قانون کامل
// ============================================================

/**
 * ساختار یک قانون:
 *   SIGNAL = <value> -> <action>(<args>) [IF <condition>]
 *
 * این تابع یک قانون را با context ارزیابی می‌کند.
 *
 * @param {string} code متن قانون
 * @param {Map<string, any>} context شامل:
 *   - متغیرهای PARAMETERS
 *   - __fieldValues__: Map<index, value>
 *   - __functionResults__: Map<key, value>
 * @returns {{
 *   matched: boolean,
 *   evaluatedCode: string,
 *   error: string|null,
 *   signalValue: string|null,
 *   conditionResult: boolean|null
 * }}
 */
function evaluateRule(code, context) {
  let codeToParse = code;
  let condition = null;

  // تشخیص IF
  const ifMatch = /\bIF\b/i.exec(code);
  if (ifMatch) {
    const ifIdx = ifMatch.index;
    const beforeIf = code.slice(0, ifIdx).trim();
    const afterIf = code.slice(ifIdx + ifMatch[0].length).trim();
    codeToParse = beforeIf;
    condition = afterIf;
  }

  // جدا کردن «SIGNAL = <value> -> <action>(...)»
  const arrowMatch = codeToParse.match(/^(.*?)\s*->\s*(.+)$/);
  if (!arrowMatch) {
    return {
      matched: false,
      evaluatedCode: code,
      error: 'قانون شامل -> نیست',
      signalValue: null,
      conditionResult: null,
    };
  }

  const lhs = arrowMatch[1].trim(); // مثلاً "SIGNAL = GREEN"
  const action = arrowMatch[2].trim(); // مثلاً "BUY(0.5G)"

  // LHS باید به‌صورت «VAR = VALUE» باشد.
  const eqMatch = lhs.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
  if (!eqMatch) {
    return {
      matched: false,
      evaluatedCode: code,
      error: 'قانون شامل = نیست',
      signalValue: null,
      conditionResult: null,
    };
  }

  const varName = eqMatch[1].toUpperCase();
  const expectedValueAst = parseExpression(eqMatch[2]);
  const expectedValue = evalAst(expectedValueAst, context);

  // مقدار واقعی متغیر (معمولاً SIGNAL = FIELD(0))
  if (!context.has(varName)) {
    return {
      matched: false,
      evaluatedCode: code,
      error: `متغیر ${varName} تعریف‌نشده`,
      signalValue: null,
      conditionResult: null,
    };
  }

  const actualValue = context.get(varName);

  // مقایسه SIGNAL با expectedValue — تطابق رشته‌ای.
  const expectedStr = String(expectedValue).toUpperCase();
  const actualStr = String(actualValue).toUpperCase();

  const signalMatched = expectedStr === actualStr;

  // ارزیابی شرط IF
  let conditionResult = true;
  let conditionError = null;

  if (condition) {
    try {
      const condAst = parseExpression(condition);
      const condVal = evalAst(condAst, context);
      // اگر condVal یک boolean نیست، آن را به boolean تبدیل کن.
      if (typeof condVal === 'boolean') {
        conditionResult = condVal;
      } else {
        conditionResult = !!condVal;
      }
    } catch (e) {
      conditionResult = false;
      conditionError = e.message;
    }
  }

  // ساخت کد ارزیابی‌شده برای نمایش
  let evaluatedCode = '';

  // LHS: SIGNAL = <value>  →  <actualSignal> = <value>
  const lhsDisplay = `${formatValue(actualValue)} = ${astToDisplayString(expectedValueAst, context)}`;

  // شرط IF
  let condDisplay = '';
  if (condition) {
    try {
      const condAst = parseExpression(condition);
      condDisplay = astToDisplayString(condAst, context);
    } catch (e) {
      condDisplay = condition;
    }
  }

  evaluatedCode = condDisplay
    ? `${lhsDisplay} -> ${action} IF ${condDisplay}`
    : `${lhsDisplay} -> ${action}`;

  // قانون مطابق است اگر SIGNAL هم تطابق داشته باشد و شرط IF (اگر هست) درست باشد.
  const matched = signalMatched && conditionResult;

  return {
    matched,
    evaluatedCode,
    error: conditionError,
    signalValue: expectedStr,
    conditionResult,
  };
}

// ============================================================
// بخش ۶: ارزیابی PARAMETERS
// ============================================================

/**
 * یک عبارت PARAMETERS را ارزیابی می‌کند.
 * این عبارات می‌توانند شامل FIELD(n)، عملگرهای حسابی، رشته‌ها، + برای concat باشند.
 *
 * مثال:
 *   PRICE = FIELD(5) * 1.01  →  با FIELD(5) = 10000  →  10100
 *   DATETIME = FIELD(2) + ' ' + FIELD(4)  →  "2024/08/05 14:30:25"
 *
 * @param {string} exprText
 * @param {Map<number, any>} fieldValues
 * @param {Map<string, any>} functionResults
 * @returns {{ value: any, display: string, error: string|null }}
 */
function evaluateParameterExpression(exprText, fieldValues, functionResults) {
  const context = new Map();
  context.set('__fieldValues__', fieldValues);
  context.set('__functionResults__', functionResults);

  try {
    const ast = parseExpression(exprText);
    const value = evalAst(ast, context);
    const display = astToDisplayString(ast, context);
    return { value, display, error: null };
  } catch (e) {
    return { value: null, display: exprText, error: e.message };
  }
}

// ============================================================
// بخش ۷: نقطه‌ی ورود — ارزیابی کل استراتژی
// ============================================================

/**
 * کل استراتژی را ارزیابی می‌کند.
 *
 * @param {object} parsedDoc خروجی parser.parseDocument
 * @param {Map<number, any>} fieldValues مقادیر FIELD(n) از کاربر
 * @param {Map<string, any>} functionResults نتایج توابع از APIها
 * @returns {{
 *   parameters: Array<{name, expr, value, display, error}>,
 *   rules: Array<{code, evaluatedCode, matched, error, signalValue}>,
 *   errors: string[]
 * }}
 */
function evaluateStrategy(parsedDoc, fieldValues, functionResults) {
  const errors = [];

  // --- مرحله ۱: ارزیابی PARAMETERS ---
  // context برای PARAMETERS فقط FIELD و توابع آماری دارد.
  // متغیرها به ترتیب اضافه می‌شوند (تا بتوانند به هم ارجاع بدهند).
  const paramContext = new Map();
  paramContext.set('__fieldValues__', fieldValues);
  paramContext.set('__functionResults__', functionResults);

  const parameters = [];
  for (const param of parsedDoc.parameters) {
    let value = null;
    let display = param.expr;
    let error = null;

    try {
      const ast = parseExpression(param.expr);
      value = evalAst(ast, paramContext);
      display = astToDisplayString(ast, paramContext);
    } catch (e) {
      error = e.message;
      errors.push(`پارامتر ${param.name}: ${error}`);
    }

    // متغیر را به context اضافه کن تا قوانین بتوانند به آن ارجاع بدهند.
    paramContext.set(param.name.toUpperCase(), value);

    parameters.push({
      name: param.name,
      expr: param.expr,
      value,
      display,
      error,
    });
  }

  // --- مرحله ۲: ارزیابی RULES ---
  const rules = parsedDoc.rules.map((r) => {
    let result;
    try {
      result = evaluateRule(r.code, paramContext);
    } catch (e) {
      result = {
        matched: false,
        evaluatedCode: r.code,
        error: e.message,
        signalValue: null,
        conditionResult: null,
      };
      errors.push(`قانون خط ${r.line + 1}: ${e.message}`);
    }

    return {
      code: r.code,
      evaluatedCode: result.evaluatedCode,
      matched: result.matched,
      error: result.error,
      signalValue: result.signalValue,
      line: r.line,
    };
  });

  return { parameters, rules, errors };
}

// ============================================================
// صادرات
// ============================================================

module.exports = {
  tokenize,
  parseExpression,
  evalAst,
  astToDisplayString,
  evaluateRule,
  evaluateParameterExpression,
  evaluateStrategy,
  toNumber,
  toBoolean,
  parseDateTimeValue,
  formatValue,
  formatNum,
};
