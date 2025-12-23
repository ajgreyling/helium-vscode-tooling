import { Diagnostic } from "vscode-languageserver";
import { parseText } from "./parser";

export function createDiagnostics(text: string): Diagnostic[] {
  const { diagnostics } = parseText(text);
  return diagnostics;
}

