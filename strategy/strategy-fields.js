// strategy-fields.js
// ============================================================
// توضیحات فیلدهای رکورد سیگنال GMO (مطابق مستندات رسمی).
//
// هر فیلد با شماره ایندکس آن در FIELD(n) شناخته می‌شود.
// این توضیحات برای:
//   - نمایش پیش‌فرض‌های هوشمند در InputBox هنگام اجرای استراتژی.
//   - اعتبارسنجی نوع مقدار (عدد، رشته، تاریخ).
//   - نمایش راهنمای فیلد در UI.
// استفاده می‌شود.
// ============================================================

'use strict';

// نوع فیلد — برای اعتبارسنجی InputBox.
const FIELD_TYPES = {
  STRING: 'string',  // رشته آزاد (مثل نام سیگنال)
  NUMBER: 'number',  // عدد (مثل درصد اعتماد)
  DATE:   'date',    // تاریخ میلادی YYYY/MM/DD
  TIME:   'time',    // ساعت HH:MM:SS
  ENUM:   'enum',    // مقدار محدود به یک مجموعه
};

// تعریف فیلدها بر اساس ایندکس (مطابق جدول مستندات رسمی).
const FIELDS = [
  {
    index: 0,
    name: 'نام سیگنال',
    type: FIELD_TYPES.ENUM,
    enum: ['GREEN', 'RED', 'BLUE', 'YELLOW'],
    description: 'نوع سیگنال ورودی',
    defaultValue: 'GREEN',
    placeholder: 'GREEN / RED / BLUE / YELLOW',
  },
  {
    index: 1,
    name: 'درصد اعتماد',
    type: FIELD_TYPES.NUMBER,
    description: 'درصد اعتماد سیگنال (۰ تا ۱۰۰)',
    defaultValue: '75',
    placeholder: '75.5',
  },
  {
    index: 2,
    name: 'تاریخ میلادی',
    type: FIELD_TYPES.DATE,
    description: 'تاریخ میلادی سیگنال',
    defaultValue: '',
    placeholder: '2024/08/05',
  },
  {
    index: 3,
    name: 'تاریخ شمسی',
    type: FIELD_TYPES.STRING,
    description: 'تاریخ شمسی سیگنال',
    defaultValue: '',
    placeholder: '1403/05/15',
  },
  {
    index: 4,
    name: 'ساعت',
    type: FIELD_TYPES.TIME,
    description: 'ساعت صدور سیگنال',
    defaultValue: '',
    placeholder: '14:30:25',
  },
  {
    index: 5,
    name: 'قیمت',
    type: FIELD_TYPES.NUMBER,
    description: 'قیمت طلا در لحظه سیگنال',
    defaultValue: '5000000',
    placeholder: '5000000',
  },
  {
    index: 6,
    name: 'پیشنهاد GmoML',
    type: FIELD_TYPES.ENUM,
    enum: ['0', '1', '2', '3', '4'],
    description: 'پیشنهاد سامانه GmoML: 0=صبر، 1=خرید، 2=فروش، 3=خرید محدود، 4=فروش محدود',
    defaultValue: '1',
    placeholder: '0/1/2/3/4',
  },
  {
    index: 7,
    name: 'وضعیت بازار',
    type: FIELD_TYPES.ENUM,
    enum: ['-1', '0', '1'],
    description: 'وضعیت بازار: -1=نزولی، 0=خنثی، 1=صعودی',
    defaultValue: '1',
    placeholder: '-1/0/1',
  },
  {
    index: 8,
    name: 'عامل رخداد سیگنال',
    type: FIELD_TYPES.ENUM,
    enum: ['0', '1', '2'],
    description: 'عامل رخداد: 0=تغییرات آستانه، 1=هشدار زودهنگام، 2=جهش ناگهانی قیمت',
    defaultValue: '0',
    placeholder: '0/1/2',
  },
  {
    index: 9,
    name: 'وضعیت معامله‌گران',
    type: FIELD_TYPES.ENUM,
    enum: ['-3', '-2', '-1', '0', '1', '2', '3'],
    description: 'تمایل معامله‌گران: -3 تا -1=فروشندگان، 0=خنثی، 1 تا 3=خریداران',
    defaultValue: '1',
    placeholder: '-3 تا 3',
  },
  {
    index: 10,
    name: 'فاصله از سطح محوری',
    type: FIELD_TYPES.NUMBER,
    description: 'فاصله قیمت از PivotPoint (مثبت=بالاتر، منفی=پایین‌تر)',
    defaultValue: '0',
    placeholder: '-10 تا 10',
  },
];

// نگاشت سریع: index → field
const FIELD_BY_INDEX = FIELDS.reduce((acc, f) => {
  acc[f.index] = f;
  return acc;
}, {});

/**
 * فیلد را با ایندکس بگیر.
 * @param {number} index
 * @returns {object|null}
 */
function getField(index) {
  return FIELD_BY_INDEX[index] || null;
}

/**
 * نام فیلد را با ایندکس بگیر (برای نمایش).
 * @param {number} index
 * @returns {string}
 */
function getFieldName(index) {
  const f = FIELD_BY_INDEX[index];
  return f ? f.name : `FIELD(${index})`;
}

/**
 * اعتبارسنجی مقدار فیلد.
 * @param {number} index
 * @param {string} value
 * @returns {string|null} پیام خطا یا null اگر معتبر است
 */
function validateFieldValue(index, value) {
  const f = FIELD_BY_INDEX[index];
  if (!f) return null; // فیلد ناشناخته — چیزی نمی‌گوییم
  if (!value || !value.trim()) return 'مقدار نمی‌تواند خالی باشد';

  const v = value.trim();

  switch (f.type) {
    case FIELD_TYPES.NUMBER:
      if (!/^-?\d+(\.\d+)?$/.test(v)) return 'عدد معتبر نیست';
      return null;

    case FIELD_TYPES.ENUM:
      if (!f.enum.includes(v.toUpperCase())) {
        return `یکی از این مقادیر را وارد کنید: ${f.enum.join(' / ')}`;
      }
      return null;

    case FIELD_TYPES.DATE:
      // YYYY/MM/DD یا YYYY-M-D
      if (!/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(v)) {
        return 'تاریخ به‌صورت YYYY/MM/DD وارد کنید';
      }
      return null;

    case FIELD_TYPES.TIME:
      if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(v)) {
        return 'ساعت به‌صورت HH:MM:SS وارد کنید';
      }
      return null;

    case FIELD_TYPES.STRING:
    default:
      return null; // هر متنی OK
  }
}

module.exports = {
  FIELD_TYPES,
  FIELDS,
  FIELD_BY_INDEX,
  getField,
  getFieldName,
  validateFieldValue,
};
