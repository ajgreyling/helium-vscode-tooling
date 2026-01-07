export type SymbolKind = "unit" | "function" | "variable" | "object" | "enum" | "attribute";

export interface SymbolEntry {
  name: string;
  kind: SymbolKind;
  location?: {
    line: number;
    character: number;
  };
}

export interface SymbolTable {
  symbols: SymbolEntry[];
}

// Lightweight heuristic-based symbol extraction until full AST integration.
export function buildSymbolTable(text: string): SymbolTable {
  const symbols: SymbolEntry[] = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((line, idx) => {
    const unitMatch = line.match(/\bunit\s+([A-Za-z_][A-Za-z0-9_]*)/);
    if (unitMatch) {
      symbols.push({ name: unitMatch[1], kind: "unit", location: { line: idx, character: unitMatch.index ?? 0 } });
    }
    
    // Match object definitions (persistent or non-persistent)
    const persistentObjectMatch = line.match(/(?:@\w+\s+)*persistent\s+object\s+([A-Z][A-Za-z0-9_]*)/);
    if (persistentObjectMatch) {
      symbols.push({ 
        name: persistentObjectMatch[1], 
        kind: "object", 
        location: { line: idx, character: persistentObjectMatch.index ?? 0 } 
      });
    }
    
    // Match non-persistent object definitions (only if not already matched as persistent)
    const objectMatch = line.match(/(?:@\w+\s+)*object\s+([A-Z][A-Za-z0-9_]*)/);
    if (objectMatch && !persistentObjectMatch) {
      symbols.push({ 
        name: objectMatch[1], 
        kind: "object", 
        location: { line: idx, character: objectMatch.index ?? 0 } 
      });
    }
    
    const funcMatch = line.match(/\b(?:int|void|bool|string|decimal|uuid|json|jsonarray|date|datetime|bigint|blob|[A-Za-z_][A-Za-z0-9_]*)\s+([a-z][A-Za-z0-9_]*)\s*\(/);
    if (funcMatch) {
      symbols.push({ name: funcMatch[1], kind: "function", location: { line: idx, character: funcMatch.index ?? 0 } });
    }
    const varMatch = line.match(/\b(?:int|bool|string|decimal|uuid|json|jsonarray|date|datetime|bigint|blob|[A-Za-z_][A-Za-z0-9_]*)\s+([a-z][A-Za-z0-9_]*)\s*(=|;)/);
    if (varMatch) {
      symbols.push({ name: varMatch[1], kind: "variable", location: { line: idx, character: varMatch.index ?? 0 } });
    }
  });

  return { symbols };
}

