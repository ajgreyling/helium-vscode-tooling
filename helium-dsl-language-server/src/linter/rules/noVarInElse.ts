import { pushDiagnostic, LintContext } from "../engine";

export function applyNoVarInElse(ctx: LintContext) {
  if (!ctx.rules["no-var-in-else"]) return;
  const lines = ctx.text.split(/\r?\n/);
  let inElse = false;
  let braceDepth = 0;
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    // Only flag plain "else" blocks, not "else if" blocks
    // The rule applies to: } else { but not } else if (...) {
    // Check for "else" that is NOT followed by "if"
    if (/}\s*else\s*{/.test(trimmed)) {
      // This is a plain else block
      inElse = true;
      braceDepth = (trimmed.match(/{/g) || []).length - (trimmed.match(/}/g) || []).length;
      return;
    }
    if (/}\s*else\s*$/.test(trimmed)) {
      // Check next line to see if it's "if" - if so, skip it
      const nextLine = idx + 1 < lines.length ? lines[idx + 1].trim() : '';
      if (!nextLine.startsWith('if')) {
        inElse = true;
        braceDepth = (trimmed.match(/{/g) || []).length - (trimmed.match(/}/g) || []).length;
        return;
      }
    }
    // Reset if we see "else if"
    if (/else\s+if\s*\(/.test(trimmed)) {
      inElse = false;
      return;
    }
    if (inElse) {
      braceDepth += (line.match(/{/g) || []).length;
      braceDepth -= (line.match(/}/g) || []).length;
      
      // Match variable declarations but exclude return statements and literals
      // Pattern: type identifier = or type identifier;
      // Must not be preceded by "return" keyword
      if (!/\breturn\b/.test(trimmed)) {
        const varDecl = line.match(/\b(?:int|bool|string|decimal|uuid|json|jsonarray|date|datetime|bigint|blob|[A-Z][A-Za-z0-9_]*)\s+[a-z_][A-Za-z0-9_]*\s*(=|;)/);
        if (varDecl) {
          const col = varDecl.index ?? 0;
          pushDiagnostic(
            ctx,
            "no-var-in-else",
            idx,
            col,
            varDecl[0].length,
            ctx.rules["no-var-in-else"].message
          );
        }
      }
      if (braceDepth <= 0) inElse = false;
    }
  });
}

