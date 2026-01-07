const path = require("node:path");
const fs = require("fs-extra");
const { execSync } = require("node:child_process");
const { lstatSync, realpathSync } = require("node:fs");

const extensionRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(extensionRoot, "..");
const languageServerRoot = path.resolve(workspaceRoot, "helium-dsl-language-server");
const generatedRoot = path.resolve(workspaceRoot, "generated");

/**
 * Filter function to exclude any paths that reference parent directories
 * This prevents symlinks or relative paths from including parent directory files
 * 
 * The filter resolves symlinks to check their actual targets, ensuring we only
 * copy files that are within the source directory tree.
 */
function createPathFilter(sourceDir) {
  const sourceAbsolute = path.resolve(sourceDir);
  return (src) => {
    try {
      const srcAbsolute = path.resolve(src);
      
      // Check if the path is a symlink and resolve it
      let resolvedPath = srcAbsolute;
      try {
        const stats = lstatSync(srcAbsolute);
        if (stats.isSymbolicLink()) {
          resolvedPath = realpathSync(srcAbsolute);
        }
      } catch (e) {
        // If we can't stat the file (e.g., it doesn't exist yet), use the original path
        // This can happen during directory traversal
      }
      
      // Reject if resolved path is outside the source directory
      if (!resolvedPath.startsWith(sourceAbsolute + path.sep) && resolvedPath !== sourceAbsolute) {
        return false;
      }
      
      // Additional safety: reject if path contains parent directory references
      const normalizedPath = path.normalize(resolvedPath);
      if (normalizedPath.includes("..")) {
        return false;
      }
      
      return true;
    } catch (e) {
      // If there's any error checking the path, reject it to be safe
      console.warn(`Warning: Could not check path ${src}:`, e.message);
      return false;
    }
  };
}

async function main() {
  console.log("Preparing extension for packaging...");

  // 1. Build the language server
  console.log("Building language server...");
  execSync("npm run build", {
    cwd: languageServerRoot,
    stdio: "inherit",
  });

  // 2. Clean up server directory before copying to avoid stale symlinks
  const serverDir = path.resolve(extensionRoot, "server");
  const serverOutDir = path.resolve(serverDir, "out");
  const serverNodeModules = path.resolve(serverDir, "node_modules");
  
  console.log("Cleaning up server directory...");
  if (await fs.pathExists(serverOutDir)) {
    await fs.remove(serverOutDir);
  }
  if (await fs.pathExists(serverNodeModules)) {
    await fs.remove(serverNodeModules);
  }

  // 3. Copy language server output and dependencies to extension package
  console.log(`Copying language server to ${serverOutDir}...`);
  await fs.ensureDir(serverOutDir);
  const languageServerOut = path.resolve(languageServerRoot, "out");
  await fs.copy(
    languageServerOut,
    serverOutDir,
    {
      overwrite: true,
      dereference: true, // Resolve symlinks to actual files
      filter: createPathFilter(languageServerOut)
    }
  );

  // Copy language server dependencies
  const sourceNodeModules = path.resolve(languageServerRoot, "node_modules");
  const serverPackageJson = path.resolve(languageServerRoot, "package.json");
  if (await fs.pathExists(sourceNodeModules)) {
    console.log("Copying language server dependencies...");
    const destNodeModules = path.resolve(serverDir, "node_modules");
    await fs.copy(
      sourceNodeModules,
      destNodeModules,
      {
        overwrite: true,
        dereference: true, // Resolve symlinks to actual files
        filter: createPathFilter(sourceNodeModules)
      }
    );
    // Remove any nested node_modules that might have been copied
    await removeNestedNodeModules(destNodeModules);
  }
  // Copy package.json for dependency resolution
  if (await fs.pathExists(serverPackageJson)) {
    await fs.copy(
      serverPackageJson,
      path.resolve(serverDir, "package.json"),
      { overwrite: true }
    );
  }

  // 4. Copy required generated files to extension package
  const extensionGeneratedDir = path.resolve(extensionRoot, "generated");
  console.log(`Copying generated files to ${extensionGeneratedDir}...`);
  
  // Copy parser files (compiled JS files)
  const parserSourceDir = path.resolve(generatedRoot, "parser", "generated", "grammar");
  const parserDestDir = path.resolve(extensionGeneratedDir, "parser", "generated", "grammar");
  if (await fs.pathExists(parserSourceDir)) {
    await fs.ensureDir(parserDestDir);
    await fs.copy(
      parserSourceDir,
      parserDestDir,
      {
        overwrite: true,
        dereference: true, // Resolve symlinks to actual files
        filter: createPathFilter(parserSourceDir)
      }
    );
  }

  // Copy BIF metadata
  const bifSourceDir = path.resolve(generatedRoot, "bifs");
  const bifDestDir = path.resolve(extensionGeneratedDir, "bifs");
  if (await fs.pathExists(bifSourceDir)) {
    await fs.ensureDir(bifDestDir);
    await fs.copy(
      bifSourceDir,
      bifDestDir,
      {
        overwrite: true,
        dereference: true, // Resolve symlinks to actual files
        filter: createPathFilter(bifSourceDir)
      }
    );
  }

  // Copy rules
  const rulesSourceDir = path.resolve(generatedRoot, "rules");
  const rulesDestDir = path.resolve(extensionGeneratedDir, "rules");
  if (await fs.pathExists(rulesSourceDir)) {
    await fs.ensureDir(rulesDestDir);
    await fs.copy(
      rulesSourceDir,
      rulesDestDir,
      {
        overwrite: true,
        dereference: true, // Resolve symlinks to actual files
        filter: createPathFilter(rulesSourceDir)
      }
    );
  }

  // 5. Clean extension node_modules completely to remove any symlinks from npm workspaces
  // This ensures we start with a clean slate and can copy actual files
  console.log("Cleaning extension node_modules to remove workspace symlinks...");
  const extensionNodeModules = path.resolve(extensionRoot, "node_modules");
  const workspaceNodeModules = path.resolve(workspaceRoot, "node_modules");
  
  // Remove the entire extension node_modules directory if it exists
  // This removes any symlinks that npm workspaces might have created
  if (await fs.pathExists(extensionNodeModules)) {
    console.log("Removing extension node_modules directory...");
    await fs.remove(extensionNodeModules);
  }
  
  // Ensure extension dependencies are available
  // This is critical for vsce to bundle vscode-languageclient
  console.log("Ensuring extension dependencies are available...");
  
  /**
   * Filter function for copying npm packages that excludes nested node_modules directories
   * This prevents copying nested dependencies that would cause duplicate file errors in vsce
   * 
   * The filter properly identifies nested node_modules by checking path segments,
   * ensuring we only exclude node_modules that are inside the package being copied.
   */
  function createPackageFilterWithoutNestedNodeModules(sourceDir) {
    const sourceAbsolute = path.resolve(sourceDir);
    
    return (src) => {
      // First apply standard path filter
      if (!createPathFilter(sourceDir)(src)) {
        return false;
      }
      
      // Get relative path from package root
      const relativePath = path.relative(sourceAbsolute, src);
      
      // If no relative path or it goes outside, reject (shouldn't happen due to path filter)
      if (!relativePath || relativePath.startsWith("..")) {
        return false;
      }
      
      // Exclude if path contains a nested node_modules directory
      // Pattern: anything/node_modules/anything (but not the package root itself)
      const pathParts = relativePath.split(path.sep);
      let foundNestedNodeModules = false;
      
      for (let i = 0; i < pathParts.length; i++) {
        if (pathParts[i] === 'node_modules' && i > 0) {
          // Found a node_modules that's not at the root - it's nested
          foundNestedNodeModules = true;
          break;
        }
      }
      
      return !foundNestedNodeModules;
    };
  }

  /**
   * Recursively removes all nested node_modules directories from a directory tree
   * This ensures no nested dependencies are included in the packaged extension
   */
  async function removeNestedNodeModules(dir) {
    // Skip if directory doesn't exist
    if (!await fs.pathExists(dir)) {
      return;
    }
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules') {
            // This is a nested node_modules - remove it
            console.log(`Removing nested node_modules: ${path.relative(extensionRoot, fullPath)}`);
            await fs.remove(fullPath);
          } else {
            // Recurse into other directories
            await removeNestedNodeModules(fullPath);
          }
        }
      }
    } catch (e) {
      // Ignore errors for individual directories (e.g., if directory was deleted)
      // Only warn if it's not a "not found" error
      if (!e.message.includes('ENOENT') && !e.message.includes('no such file')) {
        console.warn(`Warning: Could not process directory ${dir}:`, e.message);
      }
    }
  }
  
  // Check if vscode-languageclient exists in workspace root (npm workspaces)
  const vscodeLanguageClientWorkspace = path.resolve(workspaceNodeModules, "vscode-languageclient");
  const vscodeLanguageClientExtension = path.resolve(extensionNodeModules, "vscode-languageclient");
  
  // Check if target exists and is a symlink (npm workspaces creates symlinks)
  let needsVscodeLanguageClientCopy = true;
  if (await fs.pathExists(vscodeLanguageClientExtension)) {
    const stats = await fs.lstat(vscodeLanguageClientExtension);
    if (stats.isSymbolicLink()) {
      console.log("Removing symlink to workspace vscode-languageclient...");
      await fs.remove(vscodeLanguageClientExtension);
      needsVscodeLanguageClientCopy = true;
    } else {
      // Already exists as actual files, skip copy
      needsVscodeLanguageClientCopy = false;
    }
  }
  
  if (needsVscodeLanguageClientCopy && await fs.pathExists(vscodeLanguageClientWorkspace)) {
    console.log("Copying vscode-languageclient from workspace to extension...");
    await fs.ensureDir(extensionNodeModules);
    await fs.copy(
      vscodeLanguageClientWorkspace,
      vscodeLanguageClientExtension,
      {
        overwrite: true,
        dereference: true,
        filter: createPackageFilterWithoutNestedNodeModules(vscodeLanguageClientWorkspace)
      }
    );
    // Remove any nested node_modules that might have been copied despite the filter
    await removeNestedNodeModules(vscodeLanguageClientExtension);
  } else if (!await fs.pathExists(vscodeLanguageClientExtension)) {
    console.warn("Warning: vscode-languageclient not found. Extension may fail to activate.");
  }
  
  // Also copy vscode-languageserver-textdocument if it exists (dependency of vscode-languageclient)
  const vscodeLanguageserverTextdocumentWorkspace = path.resolve(workspaceNodeModules, "vscode-languageserver-textdocument");
  const vscodeLanguageserverTextdocumentExtension = path.resolve(extensionNodeModules, "vscode-languageserver-textdocument");
  
  // Check if target exists and is a symlink
  let needsVscodeLanguageserverTextdocumentCopy = true;
  if (await fs.pathExists(vscodeLanguageserverTextdocumentExtension)) {
    const stats = await fs.lstat(vscodeLanguageserverTextdocumentExtension);
    if (stats.isSymbolicLink()) {
      console.log("Removing symlink to workspace vscode-languageserver-textdocument...");
      await fs.remove(vscodeLanguageserverTextdocumentExtension);
      needsVscodeLanguageserverTextdocumentCopy = true;
    } else {
      // Already exists as actual files, skip copy
      needsVscodeLanguageserverTextdocumentCopy = false;
    }
  }
  
  if (needsVscodeLanguageserverTextdocumentCopy && await fs.pathExists(vscodeLanguageserverTextdocumentWorkspace)) {
    await fs.copy(
      vscodeLanguageserverTextdocumentWorkspace,
      vscodeLanguageserverTextdocumentExtension,
      {
        overwrite: true,
        dereference: true,
        filter: createPackageFilterWithoutNestedNodeModules(vscodeLanguageserverTextdocumentWorkspace)
      }
    );
    // Remove any nested node_modules that might have been copied despite the filter
    await removeNestedNodeModules(vscodeLanguageserverTextdocumentExtension);
  }

  // 6. Build the extension itself
  console.log("Building extension...");
  execSync("npm run build", {
    cwd: extensionRoot,
    stdio: "inherit",
  });

  // 7. Remove ALL symlinks in extension directory (especially in node_modules)
  // vsce will follow symlinks and include files from workspace, causing duplicates
  console.log("Removing all symlinks in extension directory...");
  const { readdir, lstat, readlink, unlink } = require("fs").promises;
  const walkDir = async (dir) => {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.resolve(dir, entry.name);
        try {
          const stats = await lstat(fullPath);
          if (stats.isSymbolicLink()) {
            const target = await readlink(fullPath);
            const resolved = path.resolve(path.dirname(fullPath), target);
            const normalizedResolved = path.normalize(resolved);
            
            // Remove ALL symlinks, especially those pointing to workspace
            // This prevents vsce from following symlinks and including duplicate files
            console.log(`Removing symlink: ${path.relative(extensionRoot, fullPath)} -> ${path.relative(extensionRoot, resolved)}`);
            await unlink(fullPath);
            
            // If symlink points outside extension directory, copy the target
            if (!normalizedResolved.startsWith(extensionRoot + path.sep) && normalizedResolved !== extensionRoot) {
              try {
                const targetStats = await fs.lstat(resolved);
                if (targetStats.isDirectory()) {
                  await fs.copy(resolved, fullPath, { 
                    dereference: true, 
                    filter: createPathFilter(extensionRoot),
                    overwrite: true
                  });
                } else if (targetStats.isFile()) {
                  await fs.copy(resolved, fullPath, { dereference: true, overwrite: true });
                }
              } catch (e) {
                // Target doesn't exist or can't be copied, just remove the symlink
                console.warn(`  Could not copy target: ${e.message}`);
              }
            }
          } else if (stats.isDirectory()) {
            // Recurse into directories
            await walkDir(fullPath);
          }
        } catch (e) {
          // Ignore errors for individual files
        }
      }
    } catch (e) {
      // Ignore directory read errors
    }
  };
  await walkDir(extensionRoot);
  
  // Double-check: Remove any remaining symlinks in node_modules specifically
  if (await fs.pathExists(extensionNodeModules)) {
    console.log("Double-checking for remaining symlinks in node_modules...");
    await walkDir(extensionNodeModules);
  }

  console.log("Prepublish complete!");
}

main().catch((err) => {
  console.error("Prepublish failed:", err);
  process.exit(1);
});

