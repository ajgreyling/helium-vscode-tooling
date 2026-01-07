const { execSync } = require("node:child_process");
const path = require("node:path");
const fs = require("fs-extra");
const AdmZip = require("adm-zip"); // Only used for verification, not manipulation

const extensionRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(extensionRoot, "..");
const workspacePackageJson = path.join(workspaceRoot, "package.json");
const workspacePackageJsonBackup = path.join(workspaceRoot, "package.json.workspace");

async function main() {
  console.log("Packaging extension with dependencies...");
  
  // Temporarily disable workspace to fix npm validation
  // vsce runs `npm list --production` which fails in workspace contexts due to hoisting
  let workspaceDisabled = false;
  try {
    // Check if workspace package.json exists and has workspaces
    if (await fs.pathExists(workspacePackageJson)) {
      const workspacePkg = await fs.readJson(workspacePackageJson);
      if (workspacePkg.workspaces && workspacePkg.workspaces.length > 0) {
        console.log("Temporarily disabling workspace to fix npm validation...");
        // Rename workspace package.json so npm doesn't recognize it as a workspace
        await fs.move(workspacePackageJson, workspacePackageJsonBackup);
        workspaceDisabled = true;
        console.log("✓ Workspace disabled");
      }
    }
    
    // The prepublish script has already installed all dependencies via npm install --production
    // Now that workspace is disabled, npm validation should pass
    console.log("Running vsce package (without --no-dependencies)...");
    execSync("npx @vscode/vsce package --no-yarn --allow-missing-repository --skip-license", {
      cwd: extensionRoot,
      stdio: "inherit",
    });
    
    // Find the created VSIX file
    const vsixFiles = await fs.readdir(extensionRoot);
    const vsixFile = vsixFiles.find(f => f.endsWith(".vsix"));
    
    if (!vsixFile) {
      console.error("Error: VSIX file not found after packaging");
      // Restore workspace before exiting
      if (workspaceDisabled && await fs.pathExists(workspacePackageJsonBackup)) {
        await fs.move(workspacePackageJsonBackup, workspacePackageJson);
        console.log("✓ Workspace restored");
      }
      process.exit(1);
    }
    
    const vsixPath = path.join(extensionRoot, vsixFile);
    console.log(`\n✓ VSIX created: ${vsixFile}`);
    
    // Verify that vscode-languageclient is in the VSIX
    // vsce should have included it automatically when dependencies are properly installed
    const zip = new AdmZip(vsixPath);
    const entries = zip.getEntries();
    const hasVscodeLanguageClient = entries.some(e => {
      const name = e.entryName;
      return name === "extension/node_modules/vscode-languageclient/node.js" ||
             name.includes("extension/node_modules/vscode-languageclient/node.js");
    });
    
    if (hasVscodeLanguageClient) {
      const count = entries.filter(e => 
        e.entryName.includes("extension/node_modules/vscode-languageclient")
      ).length;
      console.log(`✓ Verified: vscode-languageclient is in VSIX (${count} files)`);
      
      // Check for key dependencies
      const requiredDeps = ["vscode-languageserver-protocol", "minimatch", "semver"];
      for (const dep of requiredDeps) {
        const hasDep = entries.some(e => 
          e.entryName.includes(`extension/node_modules/${dep}/`)
        );
        if (hasDep) {
          const depCount = entries.filter(e => 
            e.entryName.includes(`extension/node_modules/${dep}/`)
          ).length;
          console.log(`✓ Verified: ${dep} is in VSIX (${depCount} files)`);
        } else {
          console.warn(`⚠ Warning: ${dep} not found in VSIX - may cause runtime errors`);
        }
      }
    } else {
      console.error("✗ Error: vscode-languageclient not found in VSIX");
      console.error("  This should not happen when dependencies are properly installed");
      console.error("  Check that prepublish script ran successfully");
      // Restore workspace before exiting
      if (workspaceDisabled && await fs.pathExists(workspacePackageJsonBackup)) {
        await fs.move(workspacePackageJsonBackup, workspacePackageJson);
        console.log("✓ Workspace restored");
      }
      process.exit(1);
    }
  } catch (error) {
    console.error("Packaging failed:", error.message);
    // Restore workspace on error
    if (workspaceDisabled && await fs.pathExists(workspacePackageJsonBackup)) {
      await fs.move(workspacePackageJsonBackup, workspacePackageJson);
      console.log("✓ Workspace restored after error");
    }
    process.exit(1);
  } finally {
    // Always restore workspace package.json
    if (workspaceDisabled && await fs.pathExists(workspacePackageJsonBackup)) {
      await fs.move(workspacePackageJsonBackup, workspacePackageJson);
      console.log("✓ Workspace restored");
    }
  }
}

main().catch((err) => {
  console.error("Package script failed:", err);
  process.exit(1);
});

