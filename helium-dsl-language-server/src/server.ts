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
  DefinitionParams,
  TypeDefinitionParams,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { createDiagnostics } from "./diagnostics";
import { buildSymbolTable } from "./symbols/symbolTable";
import { provideCompletions } from "./completion/completionProvider";
import { runLints } from "./linter/engine";
import { WorkspaceIndex } from "./symbols/workspaceIndex";

const connection = createConnection();
const documents = new TextDocuments<TextDocument>(TextDocument);
const workspaceIndex = new WorkspaceIndex();

const semanticLegend: SemanticTokensLegend = {
  tokenTypes: ["type", "function", "variable"],
  tokenModifiers: [],
};

connection.onInitialize((params: InitializeParams): InitializeResult => {
  console.log("[Server] Initializing language server...");
  console.log(`[Server] Workspace folders:`, params.workspaceFolders);
  // Initialize workspace index with workspace folders
  workspaceIndex.initialize(params.workspaceFolders || null);

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
      typeDefinitionProvider: true,
      referencesProvider: true,
      workspace: {
        workspaceFolders: {
          supported: true,
          changeNotifications: true,
        },
      },
    },
  };
});

documents.onDidChangeContent((change) => {
  validateDocument(change.document);
  // Update workspace index when model files change
  workspaceIndex.updateFile(change.document.uri);
});

documents.onDidOpen((change) => {
  validateDocument(change.document);
  // Update workspace index when model files are opened
  workspaceIndex.updateFile(change.document.uri);
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

connection.onDefinition((params: DefinitionParams): Location | Location[] | null => {
  console.log(`[Definition] onDefinition called for ${params.textDocument.uri} at line ${params.position.line}, char ${params.position.character}`);
  const doc = documents.get(params.textDocument.uri);
  if (!doc) {
    console.log(`[Definition] Document not found: ${params.textDocument.uri}`);
    return null;
  }

  const position = params.position;
  const text = doc.getText();
  const lines = text.split(/\r?\n/);
  const line = lines[position.line] || "";
  console.log(`[Definition] Line content: "${line}"`);

  // Find the word at the cursor position (PascalCase for types)
  const beforeCursor = line.substring(0, position.character);
  const afterCursor = line.substring(position.character);
  
  // Match PascalCase identifier (user-defined types start with uppercase)
  const beforeMatch = beforeCursor.match(/([A-Z][A-Za-z0-9_]*)$/);
  const afterMatch = afterCursor.match(/^([A-Za-z0-9_]*)/);
  
  if (!beforeMatch) {
    console.log(`[Definition] No PascalCase match before cursor`);
    return null;
  }
  
  const fullWord = beforeMatch[1] + (afterMatch ? afterMatch[1] : "");
  console.log(`[Definition] Extracted word: "${fullWord}"`);
  
  // Only match if it's a complete word (not part of a larger identifier)
  if (!/^[A-Z][A-Za-z0-9_]*$/.test(fullWord)) {
    console.log(`[Definition] Word "${fullWord}" doesn't match PascalCase pattern`);
    return null;
  }

  // Check if it's a user-defined type
  if (workspaceIndex.isUserDefinedType(fullWord)) {
    const location = workspaceIndex.getObjectLocation(fullWord);
    console.log(`[Definition] Found definition for "${fullWord}":`, location);
    return location ? [location] : null;
  }

  console.log(`[Definition] "${fullWord}" is not a user-defined type`);
  return null;
});

connection.onTypeDefinition((params: TypeDefinitionParams): Location | Location[] | null => {
  console.log(`[TypeDefinition] onTypeDefinition called for ${params.textDocument.uri} at line ${params.position.line}, char ${params.position.character}`);
  const doc = documents.get(params.textDocument.uri);
  if (!doc) {
    console.log(`[TypeDefinition] Document not found: ${params.textDocument.uri}`);
    return null;
  }

  const position = params.position;
  const text = doc.getText();
  const lines = text.split(/\r?\n/);
  const line = lines[position.line] || "";
  console.log(`[TypeDefinition] Line content: "${line}"`);

  // Find the word at the cursor position (PascalCase for types)
  const beforeCursor = line.substring(0, position.character);
  const afterCursor = line.substring(position.character);
  
  // Match PascalCase identifier (user-defined types start with uppercase)
  const beforeMatch = beforeCursor.match(/([A-Z][A-Za-z0-9_]*)$/);
  const afterMatch = afterCursor.match(/^([A-Za-z0-9_]*)/);
  
  if (!beforeMatch) {
    console.log(`[TypeDefinition] No PascalCase match before cursor`);
    return null;
  }
  
  const fullWord = beforeMatch[1] + (afterMatch ? afterMatch[1] : "");
  console.log(`[TypeDefinition] Extracted word: "${fullWord}"`);
  
  // Only match if it's a complete word (not part of a larger identifier)
  if (!/^[A-Z][A-Za-z0-9_]*$/.test(fullWord)) {
    console.log(`[TypeDefinition] Word "${fullWord}" doesn't match PascalCase pattern`);
    return null;
  }

  // Check if it's a user-defined type
  if (workspaceIndex.isUserDefinedType(fullWord)) {
    const location = workspaceIndex.getObjectLocation(fullWord);
    console.log(`[TypeDefinition] Found type definition for "${fullWord}":`, location);
    return location ? [location] : null;
  }

  console.log(`[TypeDefinition] "${fullWord}" is not a user-defined type`);
  return null;
});

connection.onReferences((_params): Location[] => {
  return [];
});

connection.languages.semanticTokens.on((_params) => {
  const builder = new SemanticTokensBuilder();
  // Placeholder: no semantic tokens yet.
  return builder.build();
});

// Handle workspace folder changes
connection.workspace.onDidChangeWorkspaceFolders((_event) => {
  // Re-initialize workspace index when folders change
  connection.workspace.getWorkspaceFolders().then((folders) => {
    workspaceIndex.initialize(folders);
  });
});

documents.listen(connection);
connection.listen();

