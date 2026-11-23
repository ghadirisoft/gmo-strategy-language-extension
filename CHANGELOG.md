# Changelog

All notable changes to the **GMO Strategy Language** VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] — 2026-11-22

A major release that turns the extension from a syntax + backtest tool into a complete language workbench with cloud sync and local strategy execution.

### Added — GMO Strategy Hub

- **New sidebar view** (`gmoHubView`) in the VS Code activity bar, labeled **GMO Strategy Hub**, with a dedicated icon (`media/gmo-hub-icon.svg`).
- **Hub Tree Provider** that lists your cloud strategies in two groups: **My Strategies** and **Forked**. The list is cached for 5 minutes (`hub-cache.js`) and refreshed on demand.
- **Welcome view** shown in the Hub sidebar when the user is not logged in, with a one-click `GMO: Login` link.
- **Hub status bar** (left-aligned) that shows `Hub: <name> v<version>` whenever the active editor is a Hub-connected `.gmo` file.
- **Hub session tracking** (`hub/hub-session.js`) — every file opened from the Hub is associated with its Hub metadata so that Save / Refresh / Disconnect can act on it.
- **Hub HTTP client** (`hub/hub-client.js`) with BOM-tolerant JSON parsing, structured errors (`{ ok, error: { code, message } }`), and authentication via the shared `gmo.token`.
- **Hub error catalog** (`hub/hub-errors.js`) that translates API error codes into friendly Persian messages.

### Added — Hub Commands

| Command | Shortcut | Description |
|---|---|---|
| `GMO Hub: Refresh` | — | Reload the Hub sidebar (clears cache) |
| `GMO Hub: Open Strategy` | — | Download a Hub strategy as a local `.gmo` file |
| `GMO Hub: Save to Hub` | `Ctrl+Alt+S` | Push local edits of a Hub-connected file back to the cloud |
| `GMO Hub: Refresh from Hub` | — | Overwrite the local copy with the latest cloud version |
| `GMO Hub: Disconnect` | — | Detach the active file from its Hub entry |
| `GMO Hub: Show Details` | — | View full metadata of a Hub entry |

The four editor-context commands (`Save to Hub`, `Disconnect`, `Format Document`, `Refresh Diagnostics`) are now grouped under `1_modification` in the right-click menu, alongside `Run Backtest` and the new `Run Strategy` under `navigation`.

### Added — Run Strategy

- **New command `GMO: Run Strategy`**, bound to **F5**, that executes a strategy locally:
  1. Parses the strategy with the shared `parser.js` and extracts every `FIELD(n)` used in `PARAMETERS` and `RULES`.
  2. Prompts the user for each field value via InputBox, with type-aware validation (number, date, time, enum, free string) and sensible defaults taken from `strategy/strategy-fields.js`.
  3. Calls every statistical function used in the rules (`LAST_CONFIDENCE`, `LAST_PRICE`, `LAST_DATETIME`, `MIN_*`, `MAX_*`, `AVG_*`) in parallel via the official Strategy API.
  4. Substitutes the field values and the function results into each rule with a built-in expression evaluator (`strategy/strategy-evaluator.js`).
  5. Renders the result in a side webview panel with four sections: **parameters table**, **rules list** (matched vs. not matched), **errors list**, and the **strategic code interpretation** produced by the parser API.
- **Strategy runtime modules**: `strategy/strategy-runner.js`, `strategy/strategy-evaluator.js`, `strategy/strategy-fields.js`, `strategy/strategy-constants.js`.

### Added — Language Intelligence (12 Providers)

A shared parser (`parser.js`) and a shared diagnostic-code catalog (`codes.js`) now power a full set of language features:

- **Go to Definition** (`providers/definition-provider.js`) — F12 / Ctrl+Click on a parameter name in `RULES` jumps to its declaration in `PARAMETERS`. Reserved words, signals, actions, functions, and keywords are ignored.
- **Find All References** (`providers/reference-provider.js`) — Shift+F12 lists every usage of a parameter across the document.
- **Rename Symbol** (`providers/rename-provider.js`) — F2 safely renames a parameter and every reference. Strings, comments, and reserved words are not touched. The new name must match `[A-Za-z_][A-Za-z0-9_]*`.
- **Live Diagnostics** (`providers/diagnostic-provider.js`) — 20 rules across three categories, plus 3 warnings:
  - **Structural**: missing `END`, missing `STRATEGY`, missing `VERSION`, invalid `VERSION` (not a token and not a number), invalid `TOKEN` (not 64 hex chars), token block without `TOKEN`.
  - **Parameters**: duplicate parameter name, invalid parameter name (resembling a reserved word), empty parameter expression.
  - **Rules**: undefined parameter in `RULES`, unknown statistical function, invalid `LAST_DATETIME` value, `BUY`/`SELL` without the `G` unit, invalid `BUY`/`SELL` arguments (malformed `source:value`), rule without `->`, rule without a signal, rule without an action.
  - **Warnings**: contradictory `GmoML` value for the signal type, contradictory `MARKET` value for the signal type, unreachable rule (after an unconditional rule for the same signal).
  - Diagnostics are debounced (default 250 ms) and re-run on save and on `GMO: Refresh Diagnostics`.
- **Quick Fixes / Code Actions** (`providers/code-action-provider.js`) — one-click fixes mapped to every diagnostic code above (e.g. add missing `END`, add missing `STRATEGY`, add `VERSION 1.0`, replace invalid `TOKEN` with a placeholder, define an undefined parameter in `PARAMETERS`, remove a duplicate parameter line, fill an empty parameter expression with `FIELD(0)`, add the missing `G` unit, insert `->` at the right place, append the `H` unit to an invalid `LAST_DATETIME` value). Two custom refactor actions are also available: **Convert to token block** and **Add missing standard PARAMETERS**.
- **IntelliSense Completion** (`providers/completion-provider.js`) — context-aware suggestions:
  - Inside `PARAMETERS`: standard parameter names (`SIGNAL`, `CONFIDENCE`, `DATETIME`, `PRICE`, `GMOML`, `MARKET`, `FACTOR`, `TRADERS`, `PIVOTPOINT`) with their canonical `FIELD(n)` expressions.
  - Inside `RULES`: declared parameters, signals, actions, and statistical functions.
  - After `IF`: parameters and logical operators.
  - Inside a token block: `REVISION`, `PUBLISHER`, `TOKEN`.
  - After `LAST_DATETIME(`: time units `M`, `H`, `D`.
- **Hover Tooltips** (`providers/hover-provider.js`) — hover any parameter, `FIELD(n)`, statistical function, signal name, or `BUY`/`SELL` action for a Markdown description with usage examples and the full field-index table.
- **Document Symbols / Outline** (`providers/document-symbol-provider.js`) — the VS Code outline view shows `STRATEGY` → `PARAMETERS` (with each parameter as a Variable) → `RULES` (with each rule labeled `SIGNAL = X -> ACTION`) → `END`.
- **Code Folding** (`providers/folding-provider.js`) — fold `PARAMETERS`, `RULES`, the full `STRATEGY`…`END` range, token blocks, consecutive comments, and multi-line rules. Shortcuts: `Ctrl+Shift+[` / `Ctrl+Shift+]`.
- **Signature Help** (`providers/signature-help-provider.js`) — when typing inside a function's parentheses, the extension shows the function signature, highlights the active argument, and shows a short description for each parameter. Triggered on `(` and `,`.
- **Inlay Hints** (`providers/inlay-hints-provider.js`) — three kinds of inline annotations:
  - The meaning next to each `FIELD(n)` (e.g. "confidence", "price").
  - The return type next to each statistical function (e.g. "number", "date").
  - The value type next to each `PARAMETERS` expression (e.g. "number", "string", "date+time").
- The extension sets `editor.inlayHints.enabled` to `onUnlessPressed` by default, so inlay hints are visible and disappear while holding `Ctrl+Alt`.

### Added — Signal Record Fields

- **`FIELD(9)` — TRADERS**: trader sentiment, an enum from `-3` to `3` (`-3`…`-1` = sellers, `0` = neutral, `1`…`3` = buyers).
- **`FIELD(10)` — PIVOTPOINT**: distance of the current price from the pivot level, an integer in the range `-10` to `10` (positive = above pivot, negative = below pivot).
- The hover, signature-help, and inlay-hint dictionaries have been updated to describe both new indices, and the IntelliSense completion list now suggests `TRADERS` and `PIVOTPOINT` as standard parameter names.

### Added — Token Block Format

- **New keywords**: `REVISION`, `PUBLISHER`, `TOKEN`. A strategy can now be declared as a Hub-distributed token reference using `VERSION token`, a `REVISION` line, an optional `PUBLISHER:` line, and a 64-hex-character `TOKEN:` line, terminated by `END`.
- The parser, diagnostics, completion, hover, and folding providers have been updated to recognize the token block structure.
- **New snippet `gmo-strategy-token`** inserts a complete token block template in one Tab trigger.

### Added — Snippets

- `gmo-strategy-token` — full token block template (NEW).
- `gmo-last-price` — `LAST_PRICE(GREEN)` (NEW).
- `gmo-max-pricef` — `MAX_PRICE(GREEN, 5)` (NEW).
- `gmo-min-price` — `MIN_PRICE(GREEN, 5)` (NEW).
- `gmo-avg-price` — `AVG_PRICE(GREEN, 5)` (NEW).
- `gmo-max-conf` — `MAX_CONFIDENCE(GREEN, 5)` (NEW).
- `gmo-min-conf` — `MIN_CONFIDENCE(GREEN, 5)` (NEW).
- `gmo-avg-conf` — `AVG_CONFIDENCE(GREEN, 5)` (NEW).
- `gmo-signal-field-name` … `gmo-signal-field-pivotpoint` — one shortcut per `FIELD(n)` for indices 0 to 10 (NEW).
- The existing `gmo-strategy` and `gmo-signal-record` snippets now include the two new standard fields `TRADERS = FIELD(9)` and `PIVOTPOINT = FIELD(10)`.

### Added — Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `gmo.diagnostics.enabled` | Boolean | `true` | Enable live diagnostics |
| `gmo.diagnostics.debounceMs` | Number | `250` | Delay (ms) before running diagnostics after typing |
| `gmo.diagnostics.showWarnings` | Boolean | `true` | Show warnings alongside errors |
| `gmo.hover.enabled` | Boolean | `true` | Enable hover tooltips |
| `gmo.completion.enabled` | Boolean | `true` | Enable IntelliSense completion |
| `gmo.inlayHints.showFieldMeaning` | Boolean | `true` | Show the meaning next to `FIELD(n)` |
| `gmo.inlayHints.showReturnType` | Boolean | `false` | Show the return type next to statistical functions |
| `gmo.inlayHints.showParamType` | Boolean | `true` | Show the value type next to `PARAMETERS` |
| `gmo.hub.enabled` | Boolean | `true` | Enable Hub integration (sidebar, commands, network calls) |
| `gmo.hub.downloadFolder` | String | `""` | Folder where Hub strategies are saved locally |

### Added — Project Structure

- **`parser.js`** — shared parser for document structure (headers, `PARAMETERS`, `RULES`, token blocks) and helpers (`isSignal`, `isAction`, `isFunction`, `isKeyword`, `isLogicalOp`, `parseDocument`).
- **`codes.js`** — shared catalog of diagnostic codes used by both the diagnostic provider and the code-action provider, removing any circular dependency between them.
- **`hub/`** module — `hub-constants.js`, `hub-errors.js`, `hub-client.js`, `hub-cache.js`, `hub-session.js`.
- **`strategy/`** module — `strategy-runner.js`, `strategy-evaluator.js`, `strategy-fields.js`, `strategy-constants.js`.
- **`providers/`** module — one file per language feature (definition, hover, reference, rename, diagnostic, completion, code-action, document-symbol, folding, signature-help, inlay-hints).
- **`views/`** module — `hub-tree-provider.js`.
- **`commands/`** module — `hub-refresh.js`, `hub-open-strategy.js`, `hub-save-to-hub.js`, `hub-refresh-from-hub.js`, `hub-disconnect.js`, `hub-show-details.js`, `_helpers.js`.
- **`media/gmo-hub-icon.svg`** — activity-bar icon for the Hub view.
- New `lint` script in `package.json` that runs `node -c` syntax checks across every source file.
- New `publish` script (`vsce publish`) in `package.json`.
- `Linters` added to the `categories` list.
- Persian search keywords (`طلا`, `استراتژی`, `معاملات`, `بک‌تست`, `مخزن`) and English keywords (`hub`, `goldai`, `gmo-strategy`) added to `package.json`.

### Changed — Unified Authentication

- **Single token** `gmo.token` (stored in `context.secrets`) is now shared across **Backtest**, **Run Strategy**, and **Strategy Hub**. Logging in once enables everything; logging out clears the token everywhere and resets the Hub view to its not-logged-in welcome state.
- The `User-Agent` header for all HTTPS requests now reports `GMO-VSCode-Extension/2.0.0`.
- When a Backtest response returns `..!` (invalid token), the extension now also resets the Hub session and tree, in addition to clearing the token and prompting for re-login.
- After a successful login, the Hub tree is force-reloaded automatically so the sidebar reflects the new account without manual action.

### Changed — Backtest

- The Backtest flow now also calls the **Parser API** (`/cmd/gmo/v1/STRATEGY/parser/`) in parallel with the Backtest API and renders the strategic code interpretation in the same result panel, under a dedicated **"Strategic code interpretation"** section.
- The result webview styling has been refined: dedicated table styles (header background `#0a2b5c`, zebra-striped rows), `code` chip styling, RTL layout preserved.

### Changed — Menus & Activation

- All commands now carry a `category` (`GMO` or `GMO Hub`) and an `icon` (codicon), so they render consistently in the Command Palette and the Hub view.
- The editor context menu is reorganized: `Run Backtest` and `Run Strategy` sit under `navigation`; `Save to Hub`, `Disconnect`, `Format Document`, and `Refresh Diagnostics` sit under `1_modification`.
- `activationEvents` extended with `onView:gmoHubView` and all new `gmo.hub.*` / `gmo.runStrategy` / `gmo.refreshDiagnostics` commands.
- `viewsWelcome` content added to greet users who have not yet logged in.

### Changed — Description

- `package.json` `description` updated to **"GMO Strategy language support (Strategy Hub + simulation execution)"** to reflect the new capabilities.

---

## [1.1.0] — 2026-11-02

### Fixed

- **Theme colors now apply correctly in VS Code's default theme** — Syntax highlighting colors (keywords, signals, actions, functions, variables, numbers, strings, and operators) are now consistently applied even when using VS Code's built-in *Light*, *Dark*, or *High Contrast* themes, not just the dedicated **GMO Strategy** theme. This was achieved by adding proper `configurationDefaults` for `editor.tokenColorCustomizations` in `package.json`.

### Added

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

### Changed

- Bumped extension version from `1.0.0` → `1.1.0`.

---

## [1.0.0] — Initial Release

### Added

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

## Links

- [Repository](https://github.com/ghadirisoft/gmo-strategy-language-extension)
- [Report a Bug](https://github.com/ghadirisoft/gmo-strategy-language-extension/issues)
- [Smart Gold Trading Decision Assistant](https://www.ghadirinews.ir/news/economy/bank/tools/gold-market/)
- [GMO Strategy Hub](https://www.ghadirinews.ir/news/economy/bank/tools/gold-market/strategy/hub/)
