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

  // 5. Build the extension itself
  console.log("Building extension...");
  execSync("npm run build", {
    cwd: extensionRoot,
    stdio: "inherit",
  });

  // 6. Remove any symlinks pointing outside extension directory and replace with copies
  console.log("Removing external symlinks...");
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
            
            // Check if symlink points outside extension directory
            if (!normalizedResolved.startsWith(extensionRoot + path.sep) && normalizedResolved !== extensionRoot) {
              console.log(`Removing external symlink: ${path.relative(extensionRoot, fullPath)} -> ${path.relative(extensionRoot, resolved)}`);
              await unlink(fullPath);
              // If target exists and is a file/directory, copy it
              try {
                const targetStats = await fs.lstat(resolved);
                if (targetStats.isDirectory()) {
                  await fs.copy(resolved, fullPath, { dereference: true, filter: createPathFilter(extensionRoot) });
                } else if (targetStats.isFile()) {
                  await fs.copy(resolved, fullPath, { dereference: true });
                }
              } catch (e) {
                // Target doesn't exist or can't be copied, just remove the symlink
                console.warn(`  Could not copy target: ${e.message}`);
              }
            } else if (stats.isDirectory()) {
              await walkDir(fullPath);
            }
          } else if (stats.isDirectory()) {
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

  console.log("Prepublish complete!");
}

main().catch((err) => {
  console.error("Prepublish failed:", err);
  process.exit(1);
});

