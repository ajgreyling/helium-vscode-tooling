# VSIX Packaging Problem: Workspace Hoisting and Dependency Management

## Problem Overview

When packaging the Helium DSL VSCode extension as a VSIX file, we encounter multiple issues related to npm workspaces, dependency hoisting, version conflicts, and duplicate files. The core challenge is creating a VSIX that works correctly in Cursor without using the `--no-dependencies` flag, which prevents Cursor from extracting `node_modules` during installation.

## Root Causes

### 1. NPM Workspace Hoisting

The project uses npm workspaces with the following structure:
- Root workspace: `helium-vscode-tooling/package.json` (defines workspaces)
- Extension workspace: `helium-dsl-vscode/` (VSCode extension)
- Language server workspace: `helium-dsl-language-server/` (Language server)

**Issue**: npm hoists dependencies to the workspace root, causing:
- Dependencies appear as "extraneous" at the root level
- `vscode-languageclient@9.0.1` marked as extraneous in workspace root
- Extension's dependencies are not isolated in its own `node_modules`

### 2. Version Conflicts

Different versions of the same package exist at different levels:

- **minimatch**: 
  - Workspace root may have `minimatch@9.0.5` (from other dependencies)
  - Extension requires `minimatch@^5.1.0` (via `vscode-languageclient@9.0.1`)
  - Conflict: `minimatch@9.0.5` vs `minimatch@5.1.6`

- **semver**:
  - Workspace root may have `semver@5.7.2` (from other dependencies)
  - Extension requires `semver@^7.3.7` (via `vscode-languageclient@9.0.1`)
  - Conflict: `semver@5.7.2` vs `semver@7.7.3`

### 3. Duplicate Files in VSIX

When `vsce package` runs, it encounters duplicate files with the same case-insensitive path:

```
ERROR The following files have the same case insensitive path, which isn't supported by the VSIX format:
  - extension/node_modules/vscode-languageclient/node.js
  - extension/node_modules/vscode-languageclient/node.js (duplicate)
```

**Causes**:
- Nested `node_modules` directories (e.g., `vscode-languageclient/node_modules/`)
- Symlinks from workspace hoisting that `vsce` follows
- Files appearing in both extension's `node_modules` and nested locations

### 4. NPM Validation Failures

When `vsce package` runs without `--no-dependencies`, it executes `npm list --production` which validates the dependency tree. This fails in workspace contexts:

```
npm error code ELSPROBLEMS
npm error extraneous: vscode-languageclient@9.0.1 /Users/.../helium-vscode-tooling/node_modules/vscode-languageclient
npm error extraneous: minimatch@9.0.5 /Users/.../helium-vscode-tooling/node_modules/minimatch
npm error missing: minimatch@^5.1.0, required by vscode-languageclient@9.0.1
npm error invalid: minimatch@9.0.5
```

**Why it fails**:
- `npm list` checks the workspace root, not just the extension directory
- Hoisted dependencies appear as "extraneous" (not declared in root `package.json`)
- Version conflicts cause "invalid" or "missing" dependency errors

### 5. Cursor Installation Requirements

**Critical Constraint**: We cannot use `--no-dependencies` because:
- When `vsce package --no-dependencies` is used, Cursor does NOT extract `node_modules` from the VSIX during installation
- This causes runtime errors: `Error: Cannot find module 'vscode-languageclient/node'`
- The extension fails to activate because dependencies are missing

**Required Solution**: The VSIX must be packaged with dependencies included, and `vsce` must bundle them automatically (which requires passing npm validation).

## Error Manifestations

### Error 1: Duplicate Files
```
ERROR The following files have the same case insensitive path, which isn't supported by the VSIX format
```

### Error 2: Missing Module at Runtime
```
Extension Host Output:
Error: Cannot find module 'vscode-languageclient/node'
```

### Error 3: NPM Validation Failure
```
npm error code ELSPROBLEMS
npm error extraneous: vscode-languageclient@9.0.1
npm error missing: minimatch@^5.1.0, required by vscode-languageclient@9.0.1
```

### Error 4: Missing Transitive Dependencies
```
npm error missing: brace-expansion@^2.0.1, required by minimatch@5.1.6
```

## Attempted Solutions

### Solution 1: Use `--no-dependencies` (Rejected)
- **Approach**: Package with `vsce package --no-dependencies` and manually inject dependencies
- **Problem**: Cursor doesn't extract `node_modules` when this flag is used
- **Result**: Extension fails to activate with "Cannot find module" errors

### Solution 2: Remove Nested node_modules
- **Approach**: Remove nested `node_modules` directories before packaging
- **Problem**: This removes transitive dependencies that are needed
- **Result**: Missing dependencies cause npm validation to fail

### Solution 3: Move Nested Dependencies to Root
- **Approach**: Move dependencies from `vscode-languageclient/node_modules/` to root `node_modules/`
- **Progress**: Partially successful - `minimatch` moved, but `brace-expansion` still missing
- **Result**: Still missing some transitive dependencies

### Solution 4: Temporarily Disable Workspace (Current)
- **Approach**: Rename workspace `package.json` to `package.json.workspace` before packaging
- **Status**: Implemented and working
- **How it works**:
  1. Temporarily rename root `package.json` so npm doesn't recognize workspace
  2. Run `npm install --production` in extension directory (now standalone)
  3. Move nested dependencies to root before cleanup
  4. Run `vsce package` without `--no-dependencies` (npm validation passes)
  5. Restore workspace `package.json` after packaging

## Current Implementation

### Files Modified

1. **`helium-dsl-vscode/scripts/package-with-deps.js`**:
   - Temporarily disables workspace by renaming root `package.json`
   - Runs `vsce package` without `--no-dependencies`
   - Verifies dependencies are in VSIX
   - Restores workspace after packaging

2. **`helium-dsl-vscode/scripts/prepublish.js`**:
   - Installs dependencies with `npm install --production --ignore-scripts`
   - Moves nested dependencies from `vscode-languageclient/node_modules/` to root
   - Removes nested `node_modules` to prevent duplicate files
   - Verifies all required dependencies are present

### Current Status

✅ **Working**:
- VSIX packages successfully (387 files)
- All dependencies included: `vscode-languageclient`, `vscode-languageserver-protocol`, `minimatch`, `semver`
- npm validation passes (workspace disabled during packaging)
- Extension installs in Cursor

⚠️ **Potential Issues**:
- Extension Host Output may still show errors during activation
- Need to verify all transitive dependencies are present
- Need to ensure module resolution works correctly

## Requirements

1. **Must NOT use `--no-dependencies`**: Cursor requires dependencies to be bundled normally
2. **Must pass npm validation**: `vsce` runs `npm list --production` which must succeed
3. **Must include all dependencies**: `vscode-languageclient` and all transitive deps must be in VSIX
4. **Must avoid duplicate files**: No case-insensitive duplicate paths in VSIX
5. **Must work in Cursor**: Extension must activate without "Cannot find module" errors

## Next Steps

1. Verify Extension Host Output has no errors
2. Ensure all transitive dependencies are properly bundled
3. Test extension activation in Cursor
4. Verify language server starts correctly
5. Document any remaining issues

## Technical Details

### Dependency Tree

```
helium-dsl-vscode/
├── vscode-languageclient@9.0.1
│   ├── minimatch@^5.1.0
│   │   └── brace-expansion@^2.0.1
│   ├── semver@^7.3.7
│   └── vscode-languageserver-protocol@3.17.5
└── (other dependencies)
```

### Workspace Structure

```
helium-vscode-tooling/ (workspace root)
├── package.json (defines workspaces)
├── node_modules/ (hoisted dependencies)
│   ├── vscode-languageclient@9.0.1 (extraneous)
│   ├── minimatch@9.0.5 (version conflict)
│   └── semver@5.7.2 (version conflict)
├── helium-dsl-vscode/
│   ├── package.json
│   └── node_modules/ (should be isolated)
└── helium-dsl-language-server/
    └── package.json
```

### VSIX Structure (Expected)

```
extension/
├── node_modules/
│   ├── vscode-languageclient/
│   │   ├── node.js ✅
│   │   ├── package.json ✅
│   │   └── lib/ ✅
│   ├── minimatch/ ✅
│   ├── semver/ ✅
│   ├── brace-expansion/ ✅
│   └── vscode-languageserver-protocol/ ✅
├── out/
│   └── extension.js
└── server/
    └── out/
        └── server.js
```

## References

- [VSCode Extension Packaging](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [npm workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces)
- [vsce documentation](https://github.com/microsoft/vscode-vsce)

