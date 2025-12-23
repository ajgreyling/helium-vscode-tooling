import { pushDiagnostic, LintContext } from "../engine";

export function applyNoVarInElse(ctx: LintContext) {
  if (!ctx.rules["no-var-in-else"]) return;
  const lines = ctx.text.split(/\r?\n/);
  let inElse = false;
  let braceDepth = 0;
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (/else\b/.test(trimmed)) {
      inElse = true;
      braceDepth = (trimmed.match(/{/g) || []).length - (trimmed.match(/}/g) || []).length;
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

