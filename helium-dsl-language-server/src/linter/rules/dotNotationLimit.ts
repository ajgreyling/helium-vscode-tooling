import { pushDiagnostic, LintContext } from "../engine";

export function applyDotNotationLimit(ctx: LintContext) {
  if (!ctx.rules["dot-notation-limit"]) return;
  const lines = ctx.text.split(/\r?\n/);
  lines.forEach((line, idx) => {
    // Skip lines that are in string literals, SQL blocks, or comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*/')) {
      return;
    }
    
    // Skip if line contains SQL block markers or regex patterns
    if (line.includes('/%') || line.includes('%/') || line.match(/\/.*\//)) {
      return;
    }
    
    // Only flag dot notation when it's used in assignments or method calls
    // Pattern: identifier.identifier.identifier followed by = or ( or ;
    // This catches cases like: rental.dvd_title.available_copies = ... or obj.attr.method()
    // But allows simple attribute access like: obj.attr.method()
    const chainedDotsInStatement = /\b[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*\s*[=\(;]/;
    const match = line.match(chainedDotsInStatement);
    if (match) {
      // Extract just the dot notation part
      const dotNotationMatch = match[0].match(/\b[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*){2,}/);
      if (dotNotationMatch) {
        const col = (match.index ?? 0) + match[0].indexOf(dotNotationMatch[0]);
        pushDiagnostic(
          ctx,
          "dot-notation-limit",
          idx,
          col,
          dotNotationMatch[0].length,
          ctx.rules["dot-notation-limit"].message
        );
      }
    }
  });
}

