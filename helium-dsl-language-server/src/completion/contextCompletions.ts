import { SymbolTable } from "../symbols/symbolTable";

export interface ContextCompletionItem {
  label: string;
  detail?: string;
}

export function buildContextCompletions(_table: SymbolTable): ContextCompletionItem[] {
  // Placeholder for context-aware completions; returns empty for now.
  return [];
}

