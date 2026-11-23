# GMO Strategy Language for VS Code

> The official VS Code extension for writing, testing, running, syncing, and backtesting gold trading strategies — right inside your editor.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.80.0-007ACC)
![Language](https://img.shields.io/badge/language-GMO-d4a843)
![License](https://img.shields.io/badge/license-Proprietary-blue)

**GMO Strategy Language (GmoSL)** is a domain-specific language (DSL) designed for defining gold trading strategies in the **Smart Gold Trading Decision Assistant** ecosystem. This extension brings full language support, syntax highlighting, intelligent editing, a cloud strategy repository, and one-click execution/backtesting directly into VS Code.

Whether you're a beginner writing your first trading rule or an experienced trader building advanced multi-condition strategies, this extension makes the process fast, comfortable, and reliable.

---

## What's New in 2.0.0

Version 2.0.0 is the biggest release yet. It turns the extension from a syntax + backtest tool into a **complete language workbench** with cloud sync and local strategy execution.

- **GMO Strategy Hub** — a dedicated sidebar view that lists your cloud strategies, lets you open them as local `.gmo` files, push local edits back to the cloud, refresh from the server, and disconnect a file from its Hub entry.
- **Run Strategy (F5)** — execute a strategy locally: the extension asks you for the values of every `FIELD(n)` used, calls the statistical function APIs in parallel, evaluates each rule with a built-in expression engine, and shows parameters, matched rules, errors, and the strategic code interpretation in a side panel.
- **Full language intelligence** — 12 providers that bring IDE-grade editing to `.gmo` files: Go to Definition (F12), Find All References (Shift+F12), Rename Symbol (F2), live Diagnostics with Quick Fixes, context-aware IntelliSense, hover tooltips, document outline, code folding, signature help, and inlay hints.
- **Two new signal record fields** — `FIELD(9)` (TRADERS — trader sentiment) and `FIELD(10)` (PIVOTPOINT — distance from pivot level).
- **Token block format** — publish token-based strategies with `VERSION token`, `REVISION`, `PUBLISHER`, and `TOKEN` keywords, plus a dedicated snippet and validation rules.
- **Unified authentication** — one token (`gmo.token`) is now shared across Backtest, Run Strategy, and Strategy Hub. Log in once, use everything.
- **20+ new snippets** — including all statistical functions, every `FIELD(n)` shortcut, and a token-strategy template.
- **New settings** — diagnostics, hover, completion, inlay hints, and Hub behavior are all configurable.

See the [Changelog](./CHANGELOG.md) for the full list of changes.

---

## What is GMO Strategy Language?

The GMO ecosystem consists of four connected components:

| Component | Role |
|---|---|
| **GoldAI** | The analysis engine that generates buy/sell signals in real time |
| **GMO Panel** | Web interface for viewing signals, charts, analyses, and news |
| **GMO Strategy Language** | The DSL for writing trading strategies |
| **Backtest Simulator** | Test strategies against historical market data |

### Signal Types

Every signal produced by GoldAI is color-coded:

- **GREEN** — Strong buy signal
- **BLUE** — Weak buy signal
- **RED** — Strong sell signal
- **YELLOW** — Weak sell signal

Each signal includes a **confidence percentage** and a **performance index**, helping you make informed decisions.

---

## Features

### Smart Syntax Highlighting
- Color-coded keywords, signals, functions, and values
- **Works in any VS Code theme** — colors apply in the default Light, Dark, and High Contrast themes as well as the dedicated GMO theme
- Automatic line numbering
- Live cursor position indicator (Ln, Col)
- Dedicated GMO theme (light variant)
- `.gmo` file recognition out of the box

### Language Intelligence (NEW in 2.0.0)
A complete set of editors features that understands the structure of a `.gmo` file:

- **Go to Definition (F12)** — Ctrl+Click or F12 on any parameter name in `RULES` to jump straight to its declaration in `PARAMETERS`.
- **Find All References (Shift+F12)** — list every usage of a parameter across the document.
- **Rename Symbol (F2)** — safely rename a parameter; every reference is updated. Strings, comments, and reserved words are left untouched.
- **Live Diagnostics** — 20 structural, parameter, and rule checks run as you type (debounced, configurable), with 3 additional warning rules for unreachable code and contradictory `GmoML`/`MARKET` combinations.
- **Quick Fixes (Code Actions)** — one-click fixes for missing `END`, missing `STRATEGY`/`VERSION`, invalid `TOKEN`, undefined parameters, duplicate parameters, missing `G` unit in `BUY`/`SELL`, missing `->`, invalid `LAST_DATETIME` value, and more. Two custom refactor actions are also available: *Convert to token block* and *Add missing standard PARAMETERS*.
- **IntelliSense Completion** — context-aware suggestions: standard parameter names inside `PARAMETERS`, declared parameters + signals + actions + statistical functions inside `RULES`, logical operators after `IF`, `REVISION`/`PUBLISHER`/`TOKEN` inside a token block, and `M`/`H`/`D` units after `LAST_DATETIME(`.
- **Hover Tooltips** — hover any `PARAMETER`, `FIELD(n)`, statistical function, signal name, or `BUY`/`SELL` action to see a Markdown description with usage examples.
- **Document Symbols (Outline)** — the VS Code outline view shows the strategy tree: `STRATEGY` → `PARAMETERS` (with each parameter) → `RULES` (with each rule label) → `END`.
- **Code Folding** — fold `PARAMETERS`, `RULES`, the entire `STRATEGY`…`END` range, token blocks, consecutive comments, and multi-line rules. Shortcuts: `Ctrl+Shift+[` and `Ctrl+Shift+]`.
- **Signature Help** — when typing inside a function's parentheses, the extension shows the function signature and highlights the active argument, with a short description per parameter.
- **Inlay Hints** — subtle inline annotations next to `FIELD(n)` (e.g. "confidence"), statistical functions (e.g. "number" or "date"), and parameter expressions. Visible by default; hold `Ctrl+Alt` to hide temporarily.

### GMO Strategy Hub (NEW in 2.0.0)
A cloud repository for your strategies, exposed as a dedicated **GMO Strategy Hub** view in the VS Code activity bar.

- **Browse your strategies** — the sidebar lists your strategies in two groups: **My Strategies** and **Forked**. The list is cached for 5 minutes and refreshed on demand.
- **Open from Hub** — right-click any Hub entry and choose **GMO Hub: Open Strategy** to download the strategy as a local `.gmo` file in your workspace (or a configurable download folder).
- **Save to Hub (Ctrl+Alt+S)** — push local edits of a Hub-connected file back to the cloud. The extension detects whether the file has changed since the last sync and skips the upload if nothing has changed. Description is extracted from the `DESCRIPTION:` header automatically.
- **Refresh from Hub** — overwrite the local copy with the latest cloud version.
- **Disconnect** — detach the active file from its Hub entry so it becomes a regular local `.gmo` file again.
- **Show Details** — view the full metadata of a Hub entry (name, version, publisher, description, timestamps).
- **Hub status bar** — a left-aligned status bar item shows `Hub: <name> v<version>` whenever the active editor is a Hub-connected `.gmo` file.
- **Welcome view** — when you are not logged in, the Hub view shows a one-click login prompt.
- **Disable when you don't need it** — set `gmo.hub.enabled` to `false` to hide the sidebar, unregister all Hub commands, and stop all network calls to the Hub.

### Run Strategy (NEW in 2.0.0)
A new execution path, distinct from Backtest, that lets you evaluate a strategy **right now** against values you provide.

- Press **F5** (or run **GMO: Run Strategy** from the Command Palette) inside any `.gmo` file.
- The extension parses the strategy, finds every `FIELD(n)` used in `PARAMETERS` and `RULES`, and prompts you for each value via an InputBox with type-aware validation (number, date, time, enum, free string). Sensible defaults are pre-filled.
- All statistical functions used in the rules (`LAST_CONFIDENCE`, `LAST_PRICE`, `LAST_DATETIME`, `MIN_*`, `MAX_*`, `AVG_*`) are called in parallel via the official Strategy API.
- A built-in expression evaluator substitutes the field values and the function results into every rule, evaluates each `IF` condition, and reports which rules matched.
- Results are rendered in a side panel with four sections: a **parameters table**, a **rules list** (matched vs. not matched), an **errors list** (if any), and the **strategic code interpretation** produced by the parser.

### One-Click Backtesting
- Run your strategy against historical market data directly from VS Code
- Choose between 30-day or 60-day test windows
- View detailed reports and code interpretations in a side panel
- The strategy is auto-formatted before submission (configurable via `gmo.runBacktest.autoFormat`)
- Full Persian text rendering with Yekan/Vazir fonts and RTL layout

### Secure Authentication
- Login once, stay logged in
- Credentials stored securely using VS Code's native secret storage (`context.secrets`)
- Status bar indicator shows your current phone number
- **One token, three features** — the same `gmo.token` is shared across Backtest, Run Strategy, and Strategy Hub. Logging out clears it everywhere.

### Local Storage
- Every `.gmo` file lives in your own project
- Use Git to version-control your strategies
- No data is sent automatically without your action

### Auto Formatting
- **Format on save** (via VS Code's built-in `editor.formatOnSave`)
- **Manual format**: `Shift+Alt+F` (`Shift+Option+F` on macOS)
- Aligns `=` in `PARAMETERS` and `->` in `RULES`
- Normalizes operator spacing, trailing spaces, and indentation
- Configurable via `gmo.format.*` settings

---

## Installation

### Option 1: VS Code Marketplace (Recommended)

1. Open VS Code
2. Press `Ctrl+Shift+X` to open the Extensions panel
3. Search for **GMO Strategy**
4. Click **Install**

### Option 2: Manual Installation (`.vsix`)

1. Download the `gmo-strategy-2.0.0.vsix` file from the GMO panel or the project repository
2. In VS Code: `Ctrl+Shift+X` → click `...` → **Install from VSIX...**
3. Select the `.vsix` file
4. Reload VS Code after installation

### Prerequisites

- **VS Code** version 1.80 or later
- An **active account** on the [Smart Gold Trading Decision Assistant](https://www.ghadirinews.ir/news/economy/bank/tools/gold-market/)
- An **active subscription** (required for backtesting, Run Strategy, and Strategy Hub)

---

## Quick Start (60 Seconds)

### 1. Create a New File

Save a new file with the `.gmo` extension:

```
Ctrl+N → Ctrl+S → my-first-strategy.gmo
```

### 2. Bootstrap with a Snippet

Type `gmo-strategy` and press `Tab` to insert a full strategy template, including the standard `FIELD(0)` … `FIELD(10)` parameter set and one rule per signal.

### 3. Log In

Press `Ctrl+Shift+P`, type `GMO: Login`, and hit Enter.

Enter your registered phone number and password. The status bar (bottom-right) will show your phone number and the GMO Strategy Hub sidebar will populate.

### 4. Pick Your Execution Mode

| Goal | Action |
|---|---|
| **Run the strategy once**, with values you provide | Press **F5** (**GMO: Run Strategy**) |
| **Backtest against 30/60 days of history** | Press **Ctrl+Shift+B** (**GMO: Run Backtest**) |
| **Open a strategy from the Hub** | Click the **GMO Strategy Hub** icon in the activity bar → right-click an entry → **Open Strategy** |
| **Push local edits back to the Hub** | Press **Ctrl+Alt+S** (**GMO Hub: Save to Hub**) |

---

## Complete Guide

### Strategy Structure

Every strategy is composed of four parts:

```gmo
STRATEGY StrategyName        <- Required: strategy name
VERSION 1.0                  <- Required: version
DESCRIPTION: Optional text   <- Optional description

PARAMETERS:                  <- Define variables
  SIGNAL     = FIELD(0)
  CONFIDENCE = FIELD(1)
  PRICE      = FIELD(5)

RULES:                       <- Trading rules
  SIGNAL = GREEN -> BUY(1G) IF CONFIDENCE > 70
  SIGNAL = RED   -> SELL(1G) IF PRICE > 5000000
END                          <- Required: end of strategy
```

### Token Block Format (NEW in 2.0.0)

Strategies published to the **Strategy Hub** are distributed as compact token references rather than full source code. A token block uses a different header layout:

```gmo
STRATEGY MyPublishedStrategy
VERSION token
REVISION 1.0

DESCRIPTION: Optional description
PUBLISHER: Publisher name on Strategy Hub

TOKEN: 64-character hex token issued by Strategy Hub

END
```

The `TOKEN` must be a 64-character hexadecimal string. The extension validates this format live and offers a Quick Fix to replace an invalid token with a placeholder.

> Use the `gmo-strategy-token` snippet to insert a token block template in one go.

### Signal Fields (FIELD)

Each signal record contains 11 fields:

| Index | Field | Type | Example |
|---|---|---|---|
| `0` | Signal name | Enum | `GREEN`, `RED`, `BLUE`, `YELLOW` |
| `1` | Confidence | Number | `75.5` |
| `2` | Gregorian date | Date | `2024/08/05` |
| `3` | Hijri Shamsi date | String | `1403/05/15` |
| `4` | Time | Time | `14:30:25` |
| `5` | Price | Number | `5000000` |
| `6` | GmoML recommendation | Enum | `0` to `4` (0=wait, 1=buy, 2=sell, 3=limited buy, 4=limited sell) |
| `7` | Market regime | Enum | `-1` (bearish), `0` (neutral), `1` (bullish) |
| `8` | Signal trigger factor | Enum | `0` (threshold), `1` (early warning), `2` (price spike) |
| `9` | Trader sentiment | Enum | `-3` to `3` (`-3`…`-1` sellers, `0` neutral, `1`…`3` buyers) |
| `10` | Distance from pivot level | Number | `-10` to `10` (positive = above pivot, negative = below) |

> **Tip:** Use the `gmo-signal-record` snippet to insert the full standard set of fields in one go. The `gmo-strategy` snippet already includes all 11 fields in its `PARAMETERS:` block.

### Statistical Functions

| Function | Description |
|---|---|
| `LAST_CONFIDENCE(SIGNAL)` | Last confidence of the given signal |
| `LAST_PRICE(SIGNAL)` | Last price of the given signal |
| `LAST_DATETIME(SIGNAL, offset)` | Last date-time with time offset (units: `M`, `H`, `D`) |
| `MIN_CONFIDENCE(SIGNAL, N)` | Minimum confidence of the last N signals |
| `MAX_CONFIDENCE(SIGNAL, N)` | Maximum confidence of the last N signals |
| `AVG_CONFIDENCE(SIGNAL, N)` | Average confidence of the last N signals |
| `MIN_PRICE(SIGNAL, N)` | Minimum price of the last N signals |
| `MAX_PRICE(SIGNAL, N)` | Maximum price of the last N signals |
| `AVG_PRICE(SIGNAL, N)` | Average price of the last N signals |

> When you run a strategy with **F5**, every statistical function used in the rules is called in parallel against the official Strategy API and substituted into the rules automatically.

### Action Functions

**Buy:**

```gmo
BUY(1G)                    // Buy 1 gram in default CASH source
BUY(GREEN:1G)              // Buy 1 gram in GREEN source
BUY(BLUE:0.5G, GREEN:0.5G) // Buy in multiple sources
```

**Sell:**

```gmo
SELL(1G)                   // Sell 1 gram from CASH
SELL(GREEN:1G)             // Sell 1 gram from GREEN source
SELL(BLUE:0.5G, GREEN:1G)  // Sell from multiple sources
```

> **Important:** `SELL(1G)` only sells from the `CASH` source. To sell from other sources, specify them explicitly.

### Operators

| Operator | Meaning |
|---|---|
| `>` `<` `>=` `<=` | Comparison |
| `=` `<>` | Equal / Not equal |
| `AND` `OR` `NOT` | Logical operators |

### Keywords

| Keyword | Context | Purpose |
|---|---|---|
| `STRATEGY` | Header | Strategy name |
| `VERSION` | Header | Version number, or the literal `token` for token blocks |
| `REVISION` | Token block | Revision of the published strategy |
| `DESCRIPTION` | Header | Optional human-readable description |
| `PUBLISHER` | Token block | Publisher name on Strategy Hub |
| `TOKEN` | Token block | 64-hex-char Hub token |
| `PARAMETERS` | Body | Variable definitions |
| `RULES` | Body | Trading rules |
| `IF` | Rule | Optional condition |
| `PRIORITY` | Rule | Optional rule priority |
| `END` | Footer | Required terminator |

---

## Available Snippets

Type the prefix and press `Tab`:

### Templates

| Snippet | Result |
|---|---|
| `gmo-strategy` | Complete strategy template with all 11 standard fields and one rule per signal |
| `gmo-strategy-token` | Token block template (NEW in 2.0.0) |
| `gmo-signal-record` | Full standard signal field set (`SIGNAL`, `CONFIDENCE`, `DATETIME`, `PRICE`, `GmoML`, `MARKET`, `FACTOR`, `TRADERS`, `PIVOTPOINT`) |

### Rules

| Snippet | Result |
|---|---|
| `gmo-buy` | A buy rule |
| `gmo-sell` | A sell rule |
| `gmo-buy-multi` | Multi-source buy |
| `gmo-sell-multi` | Multi-source sell |

### Statistical Functions (NEW in 2.0.0)

| Snippet | Result |
|---|---|
| `gmo-last-conf` | `LAST_CONFIDENCE(GREEN)` |
| `gmo-last-price` | `LAST_PRICE(GREEN)` |
| `gmo-last-dt` | `LAST_DATETIME(RED, 36H)` |
| `gmo-min-conf` | `MIN_CONFIDENCE(GREEN, 5)` |
| `gmo-max-conf` | `MAX_CONFIDENCE(GREEN, 5)` |
| `gmo-avg-conf` | `AVG_CONFIDENCE(GREEN, 5)` |
| `gmo-min-price` | `MIN_PRICE(GREEN, 5)` |
| `gmo-max-pricef` | `MAX_PRICE(GREEN, 5)` |
| `gmo-avg-price` | `AVG_PRICE(GREEN, 5)` |

### Signal Field Shortcuts (NEW in 2.0.0)

One snippet per `FIELD(n)`:

| Snippet | Result |
|---|---|
| `gmo-signal-field-name` | `FIELD(0)` — signal name |
| `gmo-signal-field-conf` | `FIELD(1)` — confidence |
| `gmo-signal-field-date` | `FIELD(2)` — Gregorian date |
| `gmo-signal-field-date-hijri` | `FIELD(3)` — Hijri Shamsi date |
| `gmo-signal-field-time` | `FIELD(4)` — time |
| `gmo-signal-field-date-time` | `FIELD(2) + ' ' + FIELD(4)` — datetime |
| `gmo-signal-field-price` | `FIELD(5)` — price |
| `gmo-signal-field-gmoml` | `FIELD(6)` — GmoML recommendation |
| `gmo-signal-field-market` | `FIELD(7)` — market regime |
| `gmo-signal-field-factor` | `FIELD(8)` — trigger factor |
| `gmo-signal-field-traders` | `FIELD(9)` — trader sentiment |
| `gmo-signal-field-pivotpoint` | `FIELD(10)` — pivot level distance |

> **Tip:** You can also press `Ctrl+Space` anywhere inside a `.gmo` file to open the IntelliSense completion list, which surfaces all of the above (and more) filtered to the current context.

---

## Commands & Keyboard Shortcuts

### GMO

| Command | Shortcut | Description |
|---|---|---|
| `GMO: Login` | — | Log into your account |
| `GMO: Logout` | — | Log out (clears the token everywhere) |
| `GMO: Run Backtest` | `Ctrl+Shift+B` | Backtest against 30/60 days of history |
| `GMO: Run Strategy` | `F5` | Execute the strategy locally with user-provided field values (NEW) |
| `GMO: Format Document` | `Shift+Alt+F` | Auto-format the current strategy |
| `GMO: Refresh Diagnostics` | — | Re-run live diagnostics on demand (NEW) |

### GMO Hub (NEW in 2.0.0)

| Command | Shortcut | Description |
|---|---|---|
| `GMO Hub: Refresh` | — | Reload the Hub sidebar (clears cache) |
| `GMO Hub: Open Strategy` | — | Open a Hub strategy as a local `.gmo` file |
| `GMO Hub: Save to Hub` | `Ctrl+Alt+S` | Push local edits of a Hub-connected file back to the cloud |
| `GMO Hub: Refresh from Hub` | — | Overwrite the local copy with the latest cloud version |
| `GMO Hub: Disconnect` | — | Detach the active file from its Hub entry |
| `GMO Hub: Show Details` | — | View full metadata of a Hub entry |

> You can also **right-click** inside any `.gmo` file for **Run Backtest**, **Run Strategy**, **Save to Hub**, **Disconnect**, **Format Document**, and **Refresh Diagnostics**. Right-click a Hub entry in the sidebar for the Hub actions above.

---

## Settings

All settings live under the **GMO Strategy** namespace. Defaults are shown below.

### Formatting

| Setting | Type | Default | Description |
|---|---|---|---|
| `gmo.format.indentSize` | Number | `2` | Indentation width (when `useTabs` is false) |
| `gmo.format.useTabs` | Boolean | `false` | Use tabs instead of spaces |
| `gmo.format.alignAssignments` | Boolean | `true` | Align `=` in the `PARAMETERS` block |
| `gmo.format.alignArrow` | Boolean | `true` | Align `->` in the `RULES` block |
| `gmo.format.uppercaseKeywords` | Boolean | `true` | Uppercase keywords and variable names |
| `gmo.format.addSpaceAroundOperators` | Boolean | `true` | Uniform spacing around operators |
| `gmo.format.trimTrailingSpaces` | Boolean | `true` | Remove trailing whitespace on each line |
| `gmo.format.finalNewline` | Boolean | `true` | Append a single blank line at the end of the file |

### Backtest

| Setting | Type | Default | Description |
|---|---|---|---|
| `gmo.runBacktest.autoFormat` | Boolean | `true` | Auto-format the strategy before submitting it to the simulator |

### Diagnostics (NEW in 2.0.0)

| Setting | Type | Default | Description |
|---|---|---|---|
| `gmo.diagnostics.enabled` | Boolean | `true` | Enable live diagnostics |
| `gmo.diagnostics.debounceMs` | Number | `250` | Delay (ms) before running diagnostics after typing |
| `gmo.diagnostics.showWarnings` | Boolean | `true` | Show warnings alongside errors |

### Editor Features (NEW in 2.0.0)

| Setting | Type | Default | Description |
|---|---|---|---|
| `gmo.hover.enabled` | Boolean | `true` | Enable hover tooltips |
| `gmo.completion.enabled` | Boolean | `true` | Enable IntelliSense completion |
| `gmo.inlayHints.showFieldMeaning` | Boolean | `true` | Show the meaning next to `FIELD(n)` (e.g. "confidence") |
| `gmo.inlayHints.showReturnType` | Boolean | `false` | Show the return type next to statistical functions (number/date) |
| `gmo.inlayHints.showParamType` | Boolean | `true` | Show the value type next to `PARAMETERS` (number/string/date) |

In addition, the extension sets `editor.inlayHints.enabled` to `onUnlessPressed` by default, so inlay hints are visible and disappear while you hold `Ctrl+Alt`.

### Strategy Hub (NEW in 2.0.0)

| Setting | Type | Default | Description |
|---|---|---|---|
| `gmo.hub.enabled` | Boolean | `true` | Enable Hub integration. When false, the sidebar, Hub commands, and all Hub network calls are hidden |
| `gmo.hub.downloadFolder` | String | `""` | Folder where strategies opened from the Hub are saved. Empty = `.gmo-hub` inside the workspace (or a temp folder outside a workspace) |

---

## Example Strategies

### 1) Conservative (Simple)

```gmo
STRATEGY Conservative
VERSION 1.0

PARAMETERS:
  SIGNAL = FIELD(0)

RULES:
  SIGNAL = GREEN -> BUY(1G)
  SIGNAL = RED   -> SELL(1G)
END
```

### 2) Upward Confidence

Only trades when the current signal's confidence is higher than the last same-named signal:

```gmo
STRATEGY UpwardConfidence
VERSION 1.1

PARAMETERS:
  SIGNAL     = FIELD(0)
  CONFIDENCE = FIELD(1)

RULES:
  SIGNAL = GREEN  -> BUY(1G)    IF CONFIDENCE > LAST_CONFIDENCE(GREEN)
  SIGNAL = BLUE   -> BUY(0.5G)  IF CONFIDENCE > LAST_CONFIDENCE(BLUE)
  SIGNAL = YELLOW -> SELL(0.5G) IF CONFIDENCE > LAST_CONFIDENCE(YELLOW)
  SIGNAL = RED    -> SELL(1G)   IF CONFIDENCE > LAST_CONFIDENCE(RED)
END
```

### 3) Tiered Long-Term

Gradual buying with separate sources:

```gmo
STRATEGY LongTerm
VERSION 1.0

PARAMETERS:
  SIGNAL = FIELD(0)

RULES:
  SIGNAL = GREEN  -> BUY(1G)
  SIGNAL = BLUE   -> BUY(0.5G)
  SIGNAL = YELLOW -> SELL(BLUE:0.5G)
  SIGNAL = RED    -> SELL(BLUE:0.5G, GREEN:1G)
END
```

### 4) Profitable Sale

Only sells when there is at least a 1% profit:

```gmo
STRATEGY ProfitableSale
VERSION 1.0

PARAMETERS:
  SIGNAL = FIELD(0)
  PRICE  = FIELD(5)

RULES:
  SIGNAL = GREEN  -> BUY(1G)
  SIGNAL = BLUE   -> BUY(1G)
  SIGNAL = YELLOW -> SELL(1G) IF PRICE > LAST_PRICE(BLUE) * 1.01
  SIGNAL = RED    -> SELL(1G) IF PRICE > LAST_PRICE(GREEN) * 1.01
END
```

### 5) Market-Aware

Trades only in the direction of the market trend:

```gmo
STRATEGY MarketAware
VERSION 1.0

PARAMETERS:
  SIGNAL = FIELD(0)
  MARKET = FIELD(7)

RULES:
  SIGNAL = GREEN  -> BUY(1G)    IF MARKET = 1 OR MARKET = 0
  SIGNAL = BLUE   -> BUY(0.5G)  IF MARKET = 1
  SIGNAL = RED    -> SELL(1G)   IF MARKET = -1 OR MARKET = 0
  SIGNAL = YELLOW -> SELL(0.5G) IF MARKET = -1
END
```

### 6) Hybrid (GMO + GmoML)

Trades only when both the signal and GmoML recommendation agree:

```gmo
STRATEGY HybridGMO
VERSION 1.1

PARAMETERS:
  SIGNAL     = FIELD(0)
  CONFIDENCE = FIELD(1)
  GmoML      = FIELD(6)

RULES:
  SIGNAL = GREEN  -> BUY(1G)    IF GmoML = 1 AND CONFIDENCE > 70
  SIGNAL = BLUE   -> BUY(0.5G)  IF GmoML = 1 OR GmoML = 3
  SIGNAL = RED    -> SELL(1G)   IF GmoML = 2
  SIGNAL = YELLOW -> SELL(0.5G) IF GmoML = 2 OR GmoML = 4
END
```

### 7) Trader-Sentiment Pivot (NEW in 2.0.0)

Uses the two new fields `FIELD(9)` (TRADERS) and `FIELD(10)` (PIVOTPOINT) to align trades with crowd sentiment and pivot distance:

```gmo
STRATEGY TraderPivot
VERSION 1.0

PARAMETERS:
  SIGNAL     = FIELD(0)
  TRADERS    = FIELD(9)
  PIVOTPOINT = FIELD(10)

RULES:
  SIGNAL = GREEN  -> BUY(1G)    IF TRADERS >= 2 AND PIVOTPOINT > 0
  SIGNAL = BLUE   -> BUY(0.5G)  IF TRADERS >= 1 AND PIVOTPOINT >= 0
  SIGNAL = YELLOW -> SELL(0.5G) IF TRADERS <= -1 AND PIVOTPOINT <= 0
  SIGNAL = RED    -> SELL(1G)   IF TRADERS <= -2 AND PIVOTPOINT < 0
END
```

### 8) Published Token Strategy (NEW in 2.0.0)

A strategy distributed through the Strategy Hub as a token reference:

```gmo
STRATEGY PublishedSignalTracker
VERSION token
REVISION 1.0

DESCRIPTION: Tracks GoldAI signals published on the GMO Hub
PUBLISHER: ghadirisoft

TOKEN: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

END
```

> For more examples and the complete reference, visit the [GMO Strategy Documentation](https://www.ghadirinews.ir/news/economy/bank/tools/gold-market/strategy/reference/).

---

## Screenshots

### Editor with Syntax Highlighting, IntelliSense, and Inlay Hints
![Editor Screenshot](https://www.ghadirinews.ir/images/v2/gmo/v2/vscode-v2-editor-hub.png)

### Backtest Result Panel
![Backtest Result](https://www.ghadirinews.ir/images/v2/gmo/v2/vscode-v2-backtest.png)

### Backtest Result with Signals Chart
![Backtest Result](https://www.ghadirinews.ir/images/v2/gmo/v2/vscode-v2-backtest-signal-chart.png)

### Run Strategy Code
![Backtest Result](https://www.ghadirinews.ir/images/v2/gmo/v2/vscode-v2-runstrategy.png)

---

## Troubleshooting

### My `.gmo` file isn't highlighted

1. Make sure the file is saved with the `.gmo` extension
2. The bottom-right corner of VS Code should display **GMO Strategy**, not Plain Text
3. If it shows Plain Text: `Ctrl+Shift+P` → `Change Language Mode` → `GMO Strategy`
4. If it still doesn't work: reload VS Code (`Ctrl+Shift+P` → `Reload Window`)

### The colors look wrong / washed out in my current theme

Since version **1.0.1**, the GMO syntax colors are applied to VS Code's built-in themes automatically via `configurationDefaults`. If colors still look off:

1. Open `Settings` (`Ctrl+,`)
2. Search for **Token Color Customizations**
3. Make sure no other extension is overriding the GMO scopes
4. Alternatively, switch to the dedicated theme: `Ctrl+K` → `Ctrl+T` → **GMO Strategy**

### `Ctrl+Shift+B` doesn't work

Use the Command Palette instead: `Ctrl+Shift+P` → type `GMO` → **GMO: Run Backtest**

### I get an error when running a backtest or running a strategy

1. Make sure you're logged in (the status bar at the bottom of VS Code should display your phone number)
2. If the status bar shows "GMO: Login", press `Ctrl+Shift+P` → `GMO: Login`
3. If your subscription has expired, renew it on the [Smart Gold Trading Decision Assistant](https://www.ghadirinews.ir/news/economy/bank/tools/gold-market/)

### The Strategy Hub sidebar is empty or shows an error

1. Make sure you're logged in (`GMO: Login`). The Hub shares the same token as Backtest and Run Strategy.
2. Click the **Refresh** icon at the top of the Hub view (`GMO Hub: Refresh`). This clears the 5-minute cache and reloads from the server.
3. If the Hub view is missing entirely, check that `gmo.hub.enabled` is `true` in Settings.
4. If you see a network error, check your internet connection; if it persists, open Developer Tools (`Help` → `Toggle Developer Tools` → **Console** tab) and look for lines starting with `[GMO Hub]`.

### Save to Hub says "this file didn't come from the Hub"

Save to Hub only works on files that were opened via **GMO Hub: Open Strategy**. To upload a brand-new local strategy, use the publish flow on the GMO Panel web interface; once it has a Hub entry, you can open it locally and continue editing from there.

### Run Strategy (F5) doesn't ask for all fields

The Run Strategy flow only prompts you for `FIELD(n)` indices that are actually used in the strategy. If you expected a field to be requested and it wasn't, check that the corresponding `FIELD(n)` reference is present in your `PARAMETERS` or `RULES` blocks.

### Diagnostics or Quick Fixes don't appear

1. Make sure `gmo.diagnostics.enabled` is `true`.
2. Try `Ctrl+Shift+P` → **GMO: Refresh Diagnostics** to force a re-scan.
3. Reload VS Code (`Ctrl+Shift+P` → `Reload Window`).
4. Open Developer Tools (`Help` → `Toggle Developer Tools` → **Console** tab) and look for lines starting with `[GMO]`.

### Snippets don't work

- Make sure the file has the `.gmo` extension
- Press `Ctrl+Space` manually to open the snippet menu
- Reload VS Code

---

## Changelog

See the full [CHANGELOG.md](./CHANGELOG.md) for version history and release notes.

---

## Contributing

Found a bug or have a feature suggestion? Reach out to us through the Smart Gold Trading Decision Assistant platform, or open an issue on the project repository.

---

## License

Copyright (c) 2026 Ghadiri News Agency — GMO Strategy Language Project.

All rights reserved. This extension is part of the **Smart Gold Trading
Decision Assistant** ecosystem and is the proprietary property of
[Ghadiri News Agency](https://www.ghadirinews.ir). Unauthorized use,
copying, or distribution is strictly prohibited.

Using this extension requires an **active account** on the Smart Gold
Trading Decision Assistant platform.

---

## Useful Links

| Resource | Description |
|---|---|
| [Smart Gold Trading Decision Assistant](https://www.ghadirinews.ir/news/economy/bank/tools/gold-market/) | Main platform, performance stats |
| [GMO Strategy Introduction](https://www.ghadirinews.ir/news/economy/bank/tools/gold-market/strategy/) | Overview and examples |
| [GMO Strategy Reference](https://www.ghadirinews.ir/news/economy/bank/tools/gold-market/strategy/reference/) | Full function and keyword reference |
| [GMO Panel](https://www.ghadirinews.ir/news/economy/bank/tools/gold-market/online/) | Live signals and analyses |
| [Online Backtest Simulator](https://www.ghadirinews.ir/news/economy/bank/tools/gold-market/backtest/) | Browser-based simulator |
| [Changelog](./CHANGELOG.md) | Version history and release notes |

> **Persian documentation** is available in the [GMO Strategy Reference](https://www.ghadirinews.ir/news/economy/bank/tools/gold-market/strategy/reference/).

---

<div align="center">

**We Analyze. You Decide.**

Built for gold traders

[Report a Bug](https://www.ghadirinews.ir/contact/) · [Ghadiri News Agency](https://www.ghadirinews.ir)

</div>
