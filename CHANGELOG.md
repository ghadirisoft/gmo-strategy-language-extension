# Changelog

All notable changes to the **GMO Strategy Language** VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] — [2026-11-02]

### 🐛 Fixed

- **Theme colors now apply correctly in VS Code's default theme** — Syntax highlighting colors (keywords, signals, actions, functions, variables, numbers, strings, and operators) are now consistently applied even when using VS Code's built-in *Light*, *Dark*, or *High Contrast* themes, not just the dedicated **GMO Strategy** theme. This was achieved by adding proper `configurationDefaults` for `editor.tokenColorCustomizations` in `package.json`.

### ✨ Added

- **Auto-formatting support** for `.gmo` files:
  - `Shift+Alt+F` / `Shift+Option+F` (macOS) to format manually
  - Works with VS Code's `editor.formatOnSave`
  - Aligns `=` in `PARAMETERS` and `->` in `RULES`
  - Normalizes operator spacing, indentation, and trailing whitespace
- **New settings** under `gmo.format.*`:
  - `indentSize`, `useTabs`, `alignAssignments`, `alignArrow`,
    `uppercaseKeywords`, `addSpaceAroundOperators`,
    `trimTrailingSpaces`, `finalNewline`
- **New command**: `GMO: Format Document`
- **New snippet: `gmo-signal-record`** — Quickly insert the full standard set of signal record fields (`SIGNAL`, `CONFIDENCE`, `DATETIME`, `PRICE`, `GmoML`, `MARKET`, `FACTOR`) with a single Tab trigger. Ideal for bootstrapping the `PARAMETERS:` block of any new strategy.

  ```gmo
  PARAMETERS:
    SIGNAL     = FIELD(0)  // نام سیگنال
    CONFIDENCE = FIELD(1)  // درصد اعتماد
    DATETIME   = FIELD(2) + ' ' + FIELD(4)  // تاریخ + ساعت سیگنال
    PRICE      = FIELD(5)  // قیمت
    GmoML      = FIELD(6)  // پیشنهاد GmoML
    MARKET     = FIELD(7)  // وضعیت بازار
    FACTOR     = FIELD(8)  // عامل رخداد سیگنال
  ```

### 🔧 Changed

- Bumped extension version from `1.0.0` → `1.1.0`.

---

## [1.0.0] — Initial Release

### ✨ Added

- Full **GMO Strategy Language** (`.gmo`) support in VS Code:
  - Syntax highlighting via TextMate grammar (`gmo.tmLanguage.json`)
  - Language configuration (comments, brackets, auto-closing pairs, indentation rules)
  - Dedicated **GMO Strategy** light theme (`gmo-color-theme.json`)
- **Secure login** using VS Code's native Secret Storage (`context.secrets`)
- **One-click backtesting** against 30-day and 60-day historical windows
  - Side-panel result viewer with Persian RTL layout and Yekan/Vazir fonts
  - Automatic token validation and re-login prompt on expiry
- **Status bar indicator** showing the currently logged-in phone number
- **Ready-to-use snippets**:
  - `gmo-strategy` — Full strategy template
  - `gmo-buy` / `gmo-sell` — Single-condition trade rules
  - `gmo-buy-multi` / `gmo-sell-multi` — Multi-source trade rules
  - `gmo-last-conf` / `gmo-last-dt` — Statistical function shortcuts
- **Commands & shortcuts**:
  - `GMO: Login`, `GMO: Logout`, `GMO: Show Token`
  - `GMO: Run Backtest` — `Ctrl+Shift+B` (also available via right-click context menu)
- Editor context menu integration for `.gmo` files

---

## 🔗 Links

- [Repository](https://github.com/ghadirisoft/gmo-strategy-language-extension)
- [Report a Bug](https://github.com/ghadirisoft/gmo-strategy-language-extension/issues)
- [Smart Gold Trading Decision Assistant](https://www.ghadirinews.ir/news/economy/bank/tools/gold-market/)