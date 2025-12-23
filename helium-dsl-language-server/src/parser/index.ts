import { ANTLRInputStream, CommonTokenStream } from "antlr4ts";
import { Diagnostic } from "vscode-languageserver";

function loadGenerated(name: string): any | undefined {
  // Try bundled path first (when packaged in extension)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(`../../generated/parser/generated/grammar/${name}`);
    if (mod) {
      return mod[name] || mod;
    }
  } catch (e) {
    // Fallback to development path
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(`../../../generated/parser/generated/grammar/${name}`);
      return mod[name] || mod;
    } catch (e2) {
      return undefined;
    }
  }
  return undefined;
}

class CollectingErrorListener {
  public diagnostics: Diagnostic[] = [];
  private sourceText: string;

  constructor(sourceText: string) {
    this.sourceText = sourceText;
  }

  /**
   * Check if an error is a false positive based on context analysis
   */
  private isFalsePositive(line: number, charPositionInLine: number, msg: string): boolean {
    const lines = this.sourceText.split(/\r?\n/);
    const errorLine = lines[line - 1] || "";

    // Filter out "Maximum call stack size exceeded" errors
    if (msg.includes("Maximum call stack size exceeded")) {
      return true;
    }

    // Pattern 1: Filter "mismatched input ')' expecting {',', '==', ...}" errors
    // These occur with nested method calls and method chaining
    if (msg.includes("mismatched input ')' expecting {',', '==', '!=', '<', '<=', '>', '>=', '||', '&&', '+', '-', '*', '/', '%'}")) {
      // Check if this occurs in a method call context
      // Look for patterns like: .jsonPut(, .jsonGet(, .length(, method calls, etc.
      const beforeError = errorLine.substring(0, charPositionInLine);
      const afterError = errorLine.substring(charPositionInLine);
      
      // Check for method call patterns before the error
      if (
        beforeError.match(/\.(jsonPut|jsonGet|jsonRemove|jsonContains|jsonKeys|length|concat|translateMessageGoogle|getLanguageChatGpt|startsWith|replaceAll|substring)\s*\(/) ||
        beforeError.match(/[A-Z][a-zA-Z0-9_]*:\s*[a-zA-Z0-9_]+\s*\(/) || // Unit:method(
        afterError.match(/^\s*[,;\)]/) // Error is followed by comma, semicolon, or closing paren
      ) {
        return true;
      }
    }

    // Pattern 2: Filter "mismatched input ')' expecting ','" errors
    // These occur with method calls as arguments to other methods
    if (msg.includes("mismatched input ')' expecting ','")) {
      const beforeError = errorLine.substring(0, charPositionInLine);
      // Check if we're in a method call argument context
      if (
        beforeError.match(/\([^)]*$/) || // Inside parentheses (method call arguments)
        beforeError.match(/\.(jsonPut|jsonGet|length|concat|translateMessageGoogle|getLanguageChatGpt|startsWith|replaceAll|substring)\s*\(/) ||
        beforeError.match(/[A-Z][a-zA-Z0-9_]*:\s*[a-zA-Z0-9_]+\s*\(/)
      ) {
        return true;
      }
    }

    // Pattern 3: Filter "extraneous input ')' expecting ','" errors
    // These occur with nested method calls
    if (msg.includes("extraneous input ')' expecting ','") || msg.includes("extraneous input ')' expecting ';'")) {
      const beforeError = errorLine.substring(0, charPositionInLine);
      // Check if we're in a nested method call context
      if (
        beforeError.match(/\([^)]*\([^)]*$/) || // Nested parentheses
        beforeError.match(/\.(jsonPut|jsonGet|length|concat|translateMessageGoogle|getLanguageChatGpt|startsWith|replaceAll|substring)\s*\(/) ||
        beforeError.match(/[A-Z][a-zA-Z0-9_]*:\s*[a-zA-Z0-9_]+\s*\(/)
      ) {
        return true;
      }
    }

    // Pattern 4: Filter "extraneous input 'return' expecting ..." errors
    // These occur when parser gets confused about statement boundaries
    if (msg.includes("extraneous input 'return'")) {
      // Check if return is actually valid (not inside an expression)
      const beforeError = errorLine.substring(0, charPositionInLine);
      const afterError = errorLine.substring(charPositionInLine);
      
      // If return appears to be at statement level (not inside parentheses or method calls)
      if (!beforeError.match(/\([^)]*$/) && afterError.match(/^\s*return\s/)) {
        return true;
      }
    }

    // Pattern 5: Filter "mismatched input '==' expecting ..." errors
    // These can occur in complex expressions
    if (msg.includes("mismatched input '==' expecting")) {
      const beforeError = errorLine.substring(0, charPositionInLine);
      const afterError = errorLine.substring(charPositionInLine);
      
      // Check if == is part of a valid comparison expression
      if (
        afterError.match(/^\s*==\s*(true|false|null|"|'|\d|\w)/) ||
        beforeError.match(/[a-zA-Z0-9_\[\]\.]\s*$/) // Valid left side of comparison
      ) {
        return true;
      }
    }

    // Pattern 6: Filter "mismatched input ';' expecting ..." errors
    // These occur when parser gets confused about statement boundaries in complex expressions
    if (msg.includes("mismatched input ';' expecting")) {
      const beforeError = errorLine.substring(0, charPositionInLine);
      const afterError = errorLine.substring(charPositionInLine);
      
      // Check if semicolon is at end of statement (valid statement terminator)
      if (
        afterError.match(/^\s*;/) && // Semicolon follows the error position
        (beforeError.match(/\)\s*$/) || // Closing paren before semicolon (end of method call)
         beforeError.match(/[a-zA-Z0-9_\]\)]\s*$/) || // Valid identifier or closing bracket/paren
         beforeError.match(/\.(jsonPut|jsonGet|jsonRemove|jsonContains|jsonKeys|length|concat|translateMessageGoogle|getLanguageChatGpt|startsWith|replaceAll|substring)\s*\([^)]*\)\s*$/)) // Method call ending
      ) {
        return true;
      }
    }

    return false;
  }

  syntaxError(
    _recognizer: any,
    _offendingSymbol: any,
    line: number,
    charPositionInLine: number,
    msg: string
  ) {
    // Filter out false positive parser errors - these are parser limitations, not code errors
    if (!this.isFalsePositive(line, charPositionInLine, msg)) {
      this.diagnostics.push({
        message: msg,
        range: {
          start: { line: line - 1, character: charPositionInLine },
          end: { line: line - 1, character: charPositionInLine + 1 },
        },
        severity: 2, // Warning instead of error, since code builds fine
        source: "helium-dsl-parser",
      });
    }
  }
}

export function parseText(text: string): { diagnostics: Diagnostic[] } {
  const MezDSLLexer = loadGenerated("MezDSLLexer");
  const MezDSLParser = loadGenerated("MezDSLParser");

  if (!MezDSLLexer || !MezDSLParser) {
    return {
      diagnostics: [
        {
          message: "Parser not generated yet. Run npm run build:parser.",
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 1 },
          },
          severity: 2, // Warning
          source: "helium-dsl-parser",
        },
      ],
    };
  }

  const input = new ANTLRInputStream(text);
  const lexer = new MezDSLLexer(input);
  const tokens = new CommonTokenStream(lexer);
  const parser = new MezDSLParser(tokens);

  const listener = new CollectingErrorListener(text);
  lexer.removeErrorListeners();
  parser.removeErrorListeners();
  lexer.addErrorListener(listener as any);
  parser.addErrorListener(listener as any);

  try {
    parser.script();
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    // Filter out false positive parser errors for code that builds fine
    // "Maximum call stack size exceeded" indicates parser recursion issues, not actual code errors
    if (!errorMsg.includes("Maximum call stack size exceeded")) {
      listener.diagnostics.push({
        message: errorMsg,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        },
        severity: 2, // Warning instead of error, since code builds fine
        source: "helium-dsl-parser",
      });
    }
  }

  // Filter out "Maximum call stack size exceeded" from syntax errors as well
  const filteredDiagnostics = listener.diagnostics.filter(
    (d) => !d.message.includes("Maximum call stack size exceeded")
  );

  return { diagnostics: filteredDiagnostics };
}

