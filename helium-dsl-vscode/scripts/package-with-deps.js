const { execSync } = require("node:child_process");
const path = require("node:path");
const fs = require("fs-extra");
const AdmZip = require("adm-zip");

const extensionRoot = path.resolve(__dirname, "..");

async function main() {
  console.log("Packaging extension with dependencies...");
  
  // Package with --no-dependencies to avoid npm validation issues
  // The prepublish script will copy vscode-languageclient before vsce runs
  try {
    console.log("Running vsce package with --no-dependencies...");
    execSync("npx @vscode/vsce package --no-yarn --allow-missing-repository --skip-license --no-dependencies", {
      cwd: extensionRoot,
      stdio: "inherit",
    });
    
    // Find the created VSIX file
    const vsixFiles = await fs.readdir(extensionRoot);
    const vsixFile = vsixFiles.find(f => f.endsWith(".vsix"));
    
    if (!vsixFile) {
      console.error("Error: VSIX file not found after packaging");
      process.exit(1);
    }
    
    const vsixPath = path.join(extensionRoot, vsixFile);
    console.log(`\n✓ VSIX created: ${vsixFile}`);
    
    // Check if vscode-languageclient exists (prepublish should have copied it)
    const vscodeLanguageClientPath = path.join(extensionRoot, "node_modules", "vscode-languageclient");
    if (!await fs.pathExists(vscodeLanguageClientPath)) {
      console.warn("⚠ Warning: vscode-languageclient not found in node_modules after prepublish");
      console.warn("  The extension may fail to activate. Check prepublish script.");
      return;
    }
    
    // Check if vscode-languageclient is in the VSIX
    const zip = new AdmZip(vsixPath);
    const entries = zip.getEntries();
    const hasVscodeLanguageClient = entries.some(e => 
      e.entryName.includes("extension/node_modules/vscode-languageclient/node.js")
    );
    
    if (!hasVscodeLanguageClient) {
      console.log("vscode-languageclient not found in VSIX, adding it manually...");
      
      // Add vscode-languageclient to the VSIX
      zip.addLocalFolder(vscodeLanguageClientPath, "extension/node_modules/vscode-languageclient");
      zip.writeZip(vsixPath);
      
      console.log("✓ vscode-languageclient added to VSIX");
    } else {
      console.log("✓ vscode-languageclient already in VSIX");
    }
  } catch (error) {
    console.error("Packaging failed:", error.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Package script failed:", err);
  process.exit(1);
});

