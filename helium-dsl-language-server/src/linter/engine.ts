import { Diagnostic } from "vscode-languageserver";
import { loadRules, LoadedRule } from "./ruleLoader";
import { applyNoVarInElse } from "./rules/noVarInElse";
import { applyNamingConventions } from "./rules/namingConventions";
import { applyForbiddenOperators } from "./rules/forbiddenOperators";
import { applyDotNotationLimit } from "./rules/dotNotationLimit";

export async function runLints(text: string): Promise<Diagnostic[]> {
  const rules = await loadRules();
  const diagnostics: Diagnostic[] = [];

  const ctx = { text, rules, diagnostics };

  // Only apply critical rules that are known to be accurate
  // Disable rules that cause false positives for valid code
  applyNoVarInElse(ctx);
  // applyNamingConventions(ctx); // Disabled - causes false positives
  // applyForbiddenOperators(ctx); // Disabled - causes false positives (flags SQL queries, regex patterns)
  // applyDotNotationLimit(ctx); // Disabled - causes false positives (flags valid nested attribute access)

  return diagnostics;
}

export type LintContext = {
  text: string;
  rules: Record<string, LoadedRule>;
  diagnostics: Diagnostic[];
};

export function pushDiagnostic(
  ctx: LintContext,
  ruleId: string,
  line: number,
  character: number,
  length: number,
  message: string
) {
  const rule = ctx.rules[ruleId];
  const severity = rule?.severity === "warning" ? 2 : rule?.severity === "info" ? 3 : 1;
  ctx.diagnostics.push({
    message: message || rule?.message || ruleId,
    severity,
    source: "helium-dsl-linter",
    range: {
      start: { line, character },
      end: { line, character: character + length },
    },
    code: ruleId,
  });
}

