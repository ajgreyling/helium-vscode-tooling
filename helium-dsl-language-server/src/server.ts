import {
  createConnection,
  TextDocuments,
  TextDocumentSyncKind,
  InitializeParams,
  InitializeResult,
  CompletionItem,
  CompletionItemKind,
  SemanticTokensBuilder,
  SemanticTokensLegend,
  Hover,
  Location,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { createDiagnostics } from "./diagnostics";
import { buildSymbolTable } from "./symbols/symbolTable";
import { provideCompletions } from "./completion/completionProvider";
import { runLints } from "./linter/engine";

const connection = createConnection();
const documents = new TextDocuments<TextDocument>(TextDocument);

const semanticLegend: SemanticTokensLegend = {
  tokenTypes: ["type", "function", "variable"],
  tokenModifiers: [],
};

connection.onInitialize((_params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: { resolveProvider: false },
      hoverProvider: true,
      semanticTokensProvider: {
        legend: semanticLegend,
        range: false,
        full: true,
      },
      definitionProvider: true,
      referencesProvider: true,
    },
  };
});

documents.onDidChangeContent((change) => {
  validateDocument(change.document);
});

documents.onDidOpen((change) => {
  validateDocument(change.document);
});

async function validateDocument(document: TextDocument) {
  const text = document.getText();
  const syntaxDiagnostics = createDiagnostics(text);
  const lintDiagnostics = await runLints(text);
  const diagnostics = [...syntaxDiagnostics, ...lintDiagnostics];
  connection.sendDiagnostics({ uri: document.uri, diagnostics });
}

connection.onCompletion(async (params): Promise<CompletionItem[]> => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];
  const table = buildSymbolTable(doc.getText());
  return provideCompletions(params, table);
});

connection.onHover((_params): Hover | null => {
  return null; // Placeholder; will be expanded with type info
});

connection.onDefinition((_params): Location[] => {
  return [];
});

connection.onReferences((_params): Location[] => {
  return [];
});

connection.languages.semanticTokens.on((_params) => {
  const builder = new SemanticTokensBuilder();
  // Placeholder: no semantic tokens yet.
  return builder.build();
});

documents.listen(connection);
connection.listen();

