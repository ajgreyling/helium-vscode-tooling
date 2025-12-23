import { pushDiagnostic, LintContext } from "../engine";

const camel = /^[a-z][A-Za-z0-9_]*$/;
const pascal = /^[A-Z][A-Za-z0-9_]*$/;
const upper = /^[A-Z0-9_]+$/;
const snake = /^[a-z0-9_]+$/;

export function applyNamingConventions(ctx: LintContext) {
  if (!ctx.rules["naming-conventions"]) return;
  const lines = ctx.text.split(/\r?\n/);
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    
    // Skip object, unit, enum declarations and function declarations
    if (/^\s*(object|unit|enum|void|int|bool|string|decimal|uuid|json|jsonarray|date|datetime|bigint|blob|[A-Z][A-Za-z0-9_]*)\s+[A-Z]/.test(line)) {
      return;
    }
    
    // Match variable declarations (type followed by identifier starting with lowercase)
    const varMatch = line.match(/\b(?:int|bool|string|decimal|uuid|json|jsonarray|date|datetime|bigint|blob|[A-Z][A-Za-z0-9_]*)\s+([a-z_][A-Za-z0-9_]*)\s*(=|;)/);
    if (varMatch) {
      const name = varMatch[1];
      if (!camel.test(name)) {
        pushDiagnostic(ctx, "naming-conventions", idx, varMatch.index ?? 0, name.length, "Variables should be camelCase.");
      }
    }
    const unitMatch = line.match(/\bunit\s+([A-Za-z_][A-Za-z0-9_]*)/);
    if (unitMatch) {
      const name = unitMatch[1];
      if (!pascal.test(name)) {
        pushDiagnostic(ctx, "naming-conventions", idx, unitMatch.index ?? 0, name.length, "Units should be PascalCase.");
      }
    }
    const enumMatch = line.match(/\benum\s+([A-Za-z_][A-Za-z0-9_]*)/);
    if (enumMatch) {
      const name = enumMatch[1];
      if (!upper.test(name)) {
        pushDiagnostic(ctx, "naming-conventions", idx, enumMatch.index ?? 0, name.length, "Enums should be UPPERCASE.");
      }
    }
    const attrMatch = line.match(/@?[A-Za-z_][A-Za-z0-9_]*\s+\b([a-z0-9_]+)\s*;/);
    if (attrMatch) {
      const name = attrMatch[1];
      if (!snake.test(name)) {
        pushDiagnostic(ctx, "naming-conventions", idx, attrMatch.index ?? 0, name.length, "Attributes should be snake_case.");
      }
    }
  });
}

