const path = require("node:path");
const fs = require("fs-extra");
const { execSync } = require("node:child_process");

const extensionRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(extensionRoot, "..");
const languageServerRoot = path.join(workspaceRoot, "helium-dsl-language-server");
const generatedRoot = path.join(workspaceRoot, "generated");

async function main() {
  console.log("Preparing extension for packaging...");

  // 1. Build the language server
  console.log("Building language server...");
  execSync("npm run build", {
    cwd: languageServerRoot,
    stdio: "inherit",
  });

  // 2. Copy language server output and dependencies to extension package
  const serverDir = path.join(extensionRoot, "server");
  const serverOutDir = path.join(serverDir, "out");
  console.log(`Copying language server to ${serverOutDir}...`);
  await fs.ensureDir(serverOutDir);
  await fs.copy(
    path.join(languageServerRoot, "out"),
    serverOutDir,
    { overwrite: true }
  );

  // Copy language server dependencies
  const serverNodeModules = path.join(languageServerRoot, "node_modules");
  const serverPackageJson = path.join(languageServerRoot, "package.json");
  if (await fs.pathExists(serverNodeModules)) {
    console.log("Copying language server dependencies...");
    const destNodeModules = path.join(serverDir, "node_modules");
    await fs.copy(serverNodeModules, destNodeModules, { overwrite: true });
  }
  // Copy package.json for dependency resolution
  if (await fs.pathExists(serverPackageJson)) {
    await fs.copy(serverPackageJson, path.join(serverDir, "package.json"), { overwrite: true });
  }

  // 3. Copy required generated files to extension package
  const extensionGeneratedDir = path.join(extensionRoot, "generated");
  console.log(`Copying generated files to ${extensionGeneratedDir}...`);
  
  // Copy parser files (compiled JS files)
  const parserSourceDir = path.join(generatedRoot, "parser", "generated", "grammar");
  const parserDestDir = path.join(extensionGeneratedDir, "parser", "generated", "grammar");
  if (await fs.pathExists(parserSourceDir)) {
    await fs.ensureDir(parserDestDir);
    await fs.copy(parserSourceDir, parserDestDir, { overwrite: true });
  }

  // Copy BIF metadata
  const bifSourceDir = path.join(generatedRoot, "bifs");
  const bifDestDir = path.join(extensionGeneratedDir, "bifs");
  if (await fs.pathExists(bifSourceDir)) {
    await fs.ensureDir(bifDestDir);
    await fs.copy(bifSourceDir, bifDestDir, { overwrite: true });
  }

  // Copy rules
  const rulesSourceDir = path.join(generatedRoot, "rules");
  const rulesDestDir = path.join(extensionGeneratedDir, "rules");
  if (await fs.pathExists(rulesSourceDir)) {
    await fs.ensureDir(rulesDestDir);
    await fs.copy(rulesSourceDir, rulesDestDir, { overwrite: true });
  }

  // 4. Build the extension itself
  console.log("Building extension...");
  execSync("npm run build", {
    cwd: extensionRoot,
    stdio: "inherit",
  });

  console.log("Prepublish complete!");
}

main().catch((err) => {
  console.error("Prepublish failed:", err);
  process.exit(1);
});

