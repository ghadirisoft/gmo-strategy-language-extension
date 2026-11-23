// document-symbol-provider.js
// ============================================================
// Document Symbols برای GMO Strategy
//
// رفتار:
//   - STRATEGY → Symbol (نام استراتژی)
//   - PARAMETERS → Symbol (Container)
//     └─ هر پارامتر → Variable
//   - RULES → Symbol (Container)
//     └─ هر قانون → Operator/Method (با label 'SIGNAL = X -> ACTION')
//   - END → Symbol
// ============================================================

'use strict';

const vscode = require('vscode');
const parser = require('../parser');

/**
 * ثبت DocumentSymbolProvider برای زبان gmo.
 * @param {vscode.ExtensionContext} context
 */
function registerDocumentSymbolProvider(context) {
  const provider = vscode.languages.registerDocumentSymbolProvider(
    { language: 'gmo', scheme: 'file' },
    {
      /**
       * @param {vscode.TextDocument} document
       * @param {vscode.CancellationToken} token
       * @returns {vscode.DocumentSymbol[]}
       */
      provideDocumentSymbols(document, token) {
        const parsed = parser.parseDocument(document.getText());
        const symbols = [];

        // ------------------------------------------------------
        // STRATEGY
        // ------------------------------------------------------
        const stratHeader = parsed.headers.find((h) => h.keyword === 'STRATEGY');
        if (stratHeader) {
          const lineText = document.lineAt(stratHeader.line).text;
          const name = stratHeader.value || 'Unnamed';
          const range = new vscode.Range(
            stratHeader.line,
            0,
            stratHeader.line,
            lineText.length
          );
          const selectionRange = new vscode.Range(
            stratHeader.line,
            lineText.indexOf(name),
            stratHeader.line,
            lineText.indexOf(name) + name.length
          );

          // Children: VERSION، REVISION، DESCRIPTION، PUBLISHER
          const children = [];
          for (const h of parsed.headers) {
            if (h.keyword === 'STRATEGY') continue;
            const hLineText = document.lineAt(h.line).text;
            children.push(
              new vscode.DocumentSymbol(
                h.keyword + ': ' + h.value,
                '',
                vscode.SymbolKind.Property,
                new vscode.Range(
                  h.line,
                  0,
                  h.line,
                  hLineText.length
                ),
                new vscode.Range(
                  h.line,
                  0,
                  h.line,
                  hLineText.length
                )
              )
            );
          }

          const stratSymbol = new vscode.DocumentSymbol(
            'STRATEGY ' + name,
            '',
            vscode.SymbolKind.Class,
            new vscode.Range(
              stratHeader.line,
              0,
              parsed.endLine !== null ? parsed.endLine : document.lineCount - 1,
              0
            ),
            selectionRange
          );
          stratSymbol.children = children;
          symbols.push(stratSymbol);
        }

        // ------------------------------------------------------
        // PARAMETERS
        // ------------------------------------------------------
        const paramsSection = parsed.sections.find(
          (s) => s.name === 'PARAMETERS'
        );
        if (paramsSection && parsed.parameters.length > 0) {
          const lastParam = parsed.parameters[parsed.parameters.length - 1];
          const container = new vscode.DocumentSymbol(
            'PARAMETERS',
            '(' + parsed.parameters.length + ' متغیر)',
            vscode.SymbolKind.Namespace,
            new vscode.Range(
              paramsSection.line,
              0,
              lastParam.line,
              0
            ),
            new vscode.Range(
              paramsSection.line,
              0,
              paramsSection.line,
              0
            )
          );

          container.children = parsed.parameters.map((p) => {
            const pLineText = document.lineAt(p.line).text;
            return new vscode.DocumentSymbol(
              p.name,
              p.expr,
              vscode.SymbolKind.Variable,
              new vscode.Range(p.line, 0, p.line, pLineText.length),
              new vscode.Range(
                p.line,
                p.col,
                p.line,
                p.col + p.name.length
              )
            );
          });

          symbols.push(container);
        }

        // ------------------------------------------------------
        // RULES
        // ------------------------------------------------------
        const rulesSection = parsed.sections.find((s) => s.name === 'RULES');
        if (rulesSection && parsed.rules.length > 0) {
          const lastRule = parsed.rules[parsed.rules.length - 1];
          const container = new vscode.DocumentSymbol(
            'RULES',
            '(' + parsed.rules.length + ' قانون)',
            vscode.SymbolKind.Namespace,
            new vscode.Range(
              rulesSection.line,
              0,
              lastRule.line,
              0
            ),
            new vscode.Range(
              rulesSection.line,
              0,
              rulesSection.line,
              0
            )
          );

          container.children = parsed.rules.map((r) => {
            const rLineText = document.lineAt(r.line).text;
            // label: بخشی از قانون قبل از ->
            const arrowIdx = r.code.indexOf('->');
            const label =
              arrowIdx >= 0 ? r.code.slice(0, arrowIdx).trim() : r.code.trim();

            return new vscode.DocumentSymbol(
              label,
              '',
              vscode.SymbolKind.Operator,
              new vscode.Range(r.line, 0, r.line, rLineText.length),
              new vscode.Range(r.line, 0, r.line, rLineText.length)
            );
          });

          symbols.push(container);
        }

        // ------------------------------------------------------
        // END
        // ------------------------------------------------------
        if (parsed.endLine !== null) {
          const endLineText = document.lineAt(parsed.endLine).text;
          symbols.push(
            new vscode.DocumentSymbol(
              'END',
              '',
              vscode.SymbolKind.Event,
              new vscode.Range(
                parsed.endLine,
                0,
                parsed.endLine,
                endLineText.length
              ),
              new vscode.Range(
                parsed.endLine,
                0,
                parsed.endLine,
                endLineText.length
              )
            )
          );
        }

        return symbols;
      },
    },
    { label: 'GMO Strategy' }
  );

  context.subscriptions.push(provider);
  return provider;
}

module.exports = { registerDocumentSymbolProvider };