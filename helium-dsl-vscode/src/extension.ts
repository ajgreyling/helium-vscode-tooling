import * as path from "node:path";
import * as fs from "fs";
import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log("[HeliumDSL] Activating extension...");
  
  const serverModule = context.asAbsolutePath(
    path.join("server", "out", "server.js")
  );

  console.log(`[HeliumDSL] Server module path: ${serverModule}`);

  // Check if server file exists
  if (!fs.existsSync(serverModule)) {
    const errorMsg = `[HeliumDSL] ERROR: Server file not found at ${serverModule}`;
    console.error(errorMsg);
    vscode.window.showErrorMessage(`Helium DSL: Language server not found. Please rebuild the extension.`);
    return;
  }

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ["--nolazy", "--inspect=6009"] },
    },
  };

  // Create output channel for language server logs
  const outputChannel = vscode.window.createOutputChannel("Helium DSL Language Server");
  context.subscriptions.push(outputChannel);

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "helium-dsl" },
      { scheme: "file", language: "helium-vxml" },
    ],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher("**/*.mez"),
    },
    outputChannel: outputChannel,
    traceOutputChannel: outputChannel,
  };

  client = new LanguageClient(
    "heliumDslLanguageServer",
    "Helium DSL Language Server",
    serverOptions,
    clientOptions
  );

  console.log("[HeliumDSL] Starting language client...");
  client.start().then(
    () => {
      console.log("[HeliumDSL] Language client started successfully");
      outputChannel.appendLine("Helium DSL Language Server started successfully");
    },
    (error) => {
      const errorMsg = `[HeliumDSL] ERROR: Failed to start language client: ${error}`;
      console.error(errorMsg);
      outputChannel.appendLine(`ERROR: ${errorMsg}`);
      vscode.window.showErrorMessage(`Helium DSL: Failed to start language server. Check the output channel for details.`);
    }
  );
  
  context.subscriptions.push({ dispose: () => client?.stop() });
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

