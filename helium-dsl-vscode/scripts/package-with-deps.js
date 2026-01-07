const { execSync } = require("node:child_process");
const path = require("node:path");
const fs = require("fs-extra");
const AdmZip = require("adm-zip");

const extensionRoot = path.resolve(__dirname, "..");

async function main() {
  console.log("Packaging extension with dependencies...");
  
  // Package with --no-dependencies to avoid npm validation issues
  // The prepublish script will copy vscode-languageclient and its dependencies before vsce runs
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
    
    // Also check for dependencies of vscode-languageclient
    const workspaceNodeModules = path.join(path.resolve(extensionRoot, ".."), "node_modules");
    const requiredDeps = [
      "vscode-languageclient",
      "vscode-languageserver-protocol",
      "minimatch",
      "semver"
    ];
    
    // Check if vscode-languageclient and its dependencies are in the VSIX
    const zip = new AdmZip(vsixPath);
    const entries = zip.getEntries();
    const hasVscodeLanguageClient = entries.some(e => {
      const name = e.entryName;
      return name === "extension/node_modules/vscode-languageclient/node.js" ||
             name.includes("extension/node_modules/vscode-languageclient/node.js");
    });
    
    if (!hasVscodeLanguageClient) {
      console.log("vscode-languageclient not found in VSIX, adding it and its dependencies...");
      
      try {
        // Add vscode-languageclient
        zip.addLocalFolder(vscodeLanguageClientPath, "extension/node_modules/vscode-languageclient");
        console.log("  ✓ Added vscode-languageclient");
        
        // Add its dependencies from workspace node_modules
        for (const dep of requiredDeps.slice(1)) { // Skip vscode-languageclient, already added
          const depPath = path.join(workspaceNodeModules, dep);
          const depExtensionPath = path.join(extensionRoot, "node_modules", dep);
          
          // Try extension node_modules first (might have been copied by prepublish)
          if (await fs.pathExists(depExtensionPath)) {
            zip.addLocalFolder(depExtensionPath, `extension/node_modules/${dep}`);
            console.log(`  ✓ Added ${dep} from extension node_modules`);
          } else if (await fs.pathExists(depPath)) {
            zip.addLocalFolder(depPath, `extension/node_modules/${dep}`);
            console.log(`  ✓ Added ${dep} from workspace node_modules`);
          } else {
            console.warn(`  ⚠ Warning: ${dep} not found, extension may fail`);
          }
        }
        
        zip.writeZip(vsixPath);
        console.log("✓ All dependencies added to VSIX");
        
        // Note: VSCode/Cursor should extract all files from the VSIX during installation
        // If node_modules is not being extracted, it may be a Cursor-specific issue
        // The user may need to reload Cursor after installation
        
        // Verify vscode-languageclient was added
        const verifyZip = new AdmZip(vsixPath);
        const verifyEntries = verifyZip.getEntries();
        const verifyHasIt = verifyEntries.some(e => {
          const name = e.entryName;
          return name === "extension/node_modules/vscode-languageclient/node.js" ||
                 name.includes("extension/node_modules/vscode-languageclient/node.js");
        });
        
        if (verifyHasIt) {
          const count = verifyEntries.filter(e => 
            e.entryName.includes("extension/node_modules/vscode-languageclient")
          ).length;
          console.log(`✓ Verified: vscode-languageclient is now in VSIX (${count} files)`);
          
          // Verify dependencies
          for (const dep of requiredDeps.slice(1)) {
            const hasDep = verifyEntries.some(e => 
              e.entryName.includes(`extension/node_modules/${dep}/`)
            );
            if (hasDep) {
              const depCount = verifyEntries.filter(e => 
                e.entryName.includes(`extension/node_modules/${dep}/`)
              ).length;
              console.log(`✓ Verified: ${dep} is in VSIX (${depCount} files)`);
            } else {
              console.warn(`⚠ Warning: ${dep} not found in VSIX`);
            }
          }
        } else {
          console.error("✗ Error: Verification failed - vscode-languageclient still not found in VSIX");
          process.exit(1);
        }
      } catch (error) {
        console.error(`Error adding dependencies: ${error.message}`);
        throw error;
      }
    } else {
      const count = entries.filter(e => 
        e.entryName.includes("extension/node_modules/vscode-languageclient")
      ).length;
      console.log(`✓ vscode-languageclient already in VSIX (${count} files)`);
      
      // Check if dependencies are also present
      for (const dep of requiredDeps.slice(1)) {
        const hasDep = entries.some(e => 
          e.entryName.includes(`extension/node_modules/${dep}/`)
        );
        if (!hasDep) {
          console.log(`Adding missing dependency: ${dep}...`);
          const depPath = path.join(workspaceNodeModules, dep);
          const depExtensionPath = path.join(extensionRoot, "node_modules", dep);
          
          if (await fs.pathExists(depExtensionPath)) {
            zip.addLocalFolder(depExtensionPath, `extension/node_modules/${dep}`);
            console.log(`  ✓ Added ${dep}`);
          } else if (await fs.pathExists(depPath)) {
            zip.addLocalFolder(depPath, `extension/node_modules/${dep}`);
            console.log(`  ✓ Added ${dep}`);
          } else {
            console.warn(`  ⚠ Warning: ${dep} not found`);
          }
        }
      }
      
      if (entries.length !== zip.getEntries().length) {
        zip.writeZip(vsixPath);
        console.log("✓ Updated VSIX with missing dependencies");
      }
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

