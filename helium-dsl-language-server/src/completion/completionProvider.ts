import {
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
} from "vscode-languageserver";
import { keywords } from "./keywordCompletions";
import { loadBifCompletions } from "./bifCompletions";
import { buildContextCompletions } from "./contextCompletions";
import { SymbolTable } from "../symbols/symbolTable";

export async function provideCompletions(
  _params: TextDocumentPositionParams,
  symbolTable: SymbolTable
): Promise<CompletionItem[]> {
  const items: CompletionItem[] = [];

  keywords.forEach((kw) =>
    items.push({ label: kw, kind: CompletionItemKind.Keyword })
  );

  const bifs = await loadBifCompletions();
  bifs.forEach((b) =>
    items.push({
      label: b.label,
      kind: CompletionItemKind.Function,
      detail: b.detail,
    })
  );

  const contextItems = buildContextCompletions(symbolTable);
  items.push(
    ...contextItems.map((c) => ({
      label: c.label,
      kind: CompletionItemKind.Variable,
    }))
  );

  return items;
}

