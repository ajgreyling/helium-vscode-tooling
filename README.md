# Helium DSL VSCode Extension Tooling

This project provides automated tooling for building a VSCode extension for the Helium Rapid DSL. **The extension is primarily designed for Cursor IDE**, though it is compatible with VS Code.

The project includes:
- ANTLR3 to ANTLR4 grammar conversion
- Parser generation
- Linting rule extraction
- Language server implementation
- VSCode extension packaging

## Project Structure

```
helium-vscode-tooling/
├── scripts/              # Build automation scripts
│   ├── extract-grammar.ts    # Extract ANTLR3 grammar from Java project
│   ├── convert-grammar.ts    # Convert ANTLR3 to ANTLR4
│   ├── validate-grammar.ts   # Validate converted grammar
│   ├── extract-rules.ts      # Generate linting rules
│   ├── generate-bif-metadata.ts  # Generate BIF metadata
│   ├── generate-textmate.ts  # Generate TextMate grammar
│   ├── build.ts             # Main build orchestrator
│   ├── watch.ts             # Watch for changes
│   ├── version-check.ts     # Version tracking
│   └── package-docker.sh    # Docker-based VSIX packaging orchestrator
├── docker/               # Docker packaging infrastructure
│   ├── Dockerfile.vsix   # Docker image definition (Node 20.11.1, vsce 2.26.0)
│   └── package.sh        # Packaging script (runs inside Docker container)
├── docker-compose.yml    # Docker Compose configuration (volume mounts, service definition)
├── helium-dsl-language-server/  # LSP server implementation
├── helium-dsl-vscode/      # VSCode extension client
├── generated/              # Generated files (not in git)
├── dist/                   # VSIX output directory (not in git)
├── validate-dsl.sh         # Validation pipeline script
└── package.json
```

### Script Files Explained

**`scripts/package-docker.sh`** - Main packaging orchestrator (runs on host)
- **Purpose**: Coordinates the complete packaging workflow
- **Steps**:
  1. Builds language server with local dependencies (`--no-workspaces`)
  2. Builds extension
  3. Invokes Docker Compose to run packaging
  4. Verifies VSIX output
- **Why separate**: Ensures prerequisites are built before Docker runs

**`docker/Dockerfile.vsix`** - Docker image definition
- **Base**: `node:20.11.1-bookworm` (pinned Node version for reproducibility)
- **Installs**: 
  - `git` (required by `vsce`)
  - `@vscode/vsce@2.26.0` (pinned version for consistency)
- **Working directory**: `/build`

**`docker/package.sh`** - Packaging script (runs inside Docker container)
- **Purpose**: Assembles and packages the extension in isolation
- **Key operations**:
  - Creates writable working copy (source files are read-only mounts)
  - Copies language server output and dependencies
  - Copies generated files
  - Installs extension production dependencies
  - Flattens nested dependencies (critical for `vsce` to include all deps)
  - Validates dependency tree
  - Runs `vsce package`
- **Why in Docker**: Isolates from npm workspace, ensures clean dependency tree

**`docker-compose.yml`** - Docker Compose configuration
- **Service**: `vsix`
- **Volumes**: Maps host directories to container paths
  - Read-only mounts for source files (prevents accidental modifications)
  - Writable mount for output (`dist/`)
- **Command**: Executes `docker/package.sh` inside container

## Prerequisites

- Node.js >= 18
- npm or pnpm
- Docker and Docker Compose (for VSIX packaging)
- Access to `appexec-dsl-commons` repository
- Access to a sample DSL project for validation

## Installation

```bash
cd /Users/ajgreyling/code/helium-vscode-tooling
npm install
```

## Usage

### Quick Start: Run Full Validation Pipeline

The `validate-dsl.sh` script automates the entire process:

```bash
# Make script executable (first time only)
chmod +x validate-dsl.sh

# Run validation
./validate-dsl.sh \
  -d /Users/ajgreyling/code/appexec-dsl-commons \
  -p /Users/ajgreyling/code/munic-chat
```

This will:
1. Configure paths to your DSL commons and sample project
2. Extract the ANTLR3 grammar
3. Convert it to ANTLR4
4. Generate the TypeScript parser
5. Generate linting rules
6. Generate BIF metadata
7. Generate TextMate grammar for syntax highlighting
8. Build the language server
9. Build the VSCode extension
10. Update extension version with epoch-based build number
11. Package the VSCode extension as a `.vsix` file
12. Restore original version in package.json
13. Run validation tests against your sample project
14. Automatically install the extension in Cursor

### Manual Build Steps

If you prefer to run steps individually:

```bash
# Extract grammar from appexec-dsl-commons
npm run build:extract

# Convert ANTLR3 to ANTLR4
npm run build:grammar

# Validate converted grammar
npm run build:validate

# Generate parser
npm run build:parser

# Extract rules
npm run build:rules

# Generate BIF metadata
npm run build:bifs

# Generate TextMate grammar
npm run build:textmate

# Build language server
npm run build

# Run tests
npm test

# Package extension
npm run package
```

### Development Workflow

```bash
# Watch for changes in grammar and rules
npm run watch

# Build everything
npm run build:all

# Run tests
npm test

# Check versions
npm run version-check
```

## Configuration

The validation script automatically configures the following paths:

- **Grammar Source**: `${DSL_COMMONS}/WebDSLParser-lib/src/main/antlr3/com/mezzanine/dsl/web/MezDSL.g`
- **Rules**: Defined in `scripts/extract-rules.ts`
- **Sample Project**: Path provided via `-p` parameter

## Linting Rules

The linter currently implements the following rules:

1. **no-var-in-else** (error): Variables cannot be declared in else blocks
2. **dot-notation-limit** (warning): Dot notation can only be used once per statement  
3. **naming-conventions** (warning): Follow naming conventions (camelCase, PascalCase, etc.)

## Test Output

The validation script will output:
- Number of files scanned
- Total issues found
- Issues grouped by rule type
- Detailed list of issues per file
- Special focus on critical errors (variables in else blocks)

Example output:
```
📊 Summary:
  Files scanned: 73
  Files with issues: 73
  Total issues: 162

📋 Issues by rule:
  helium-dsl-linter: 162
  
✅ 0 critical "variable-in-else" errors found!
```

## Troubleshooting

### Parser Not Generated

If you see "Parser not generated yet" errors:
```bash
npm run build:parser
```

### Grammar Conversion Errors

If grammar validation fails:
1. Check that the source grammar exists
2. Review the conversion script output
3. Check `generated/grammar/MezDSL.g4` for syntax errors

### Test Failures

If tests fail:
1. Ensure paths are correct
2. Run `npm run build:all` to regenerate everything
3. Check the test output for specific file issues

### Extension Activation Errors

If the extension fails to activate with "Cannot find module" errors:
1. Ensure you're using the VSIX from `dist/helium-dsl.vsix` (created by Docker packaging)
2. Rebuild and repackage: `npm run package`
3. Reinstall the extension: `cursor --install-extension dist/helium-dsl.vsix --force`
4. Check Extension Host logs: Command Palette → "Developer: Show Extension Host Log"

## Automation & Repeatability

This tooling is designed to be fully automated and repeatable:

1. All source files (grammar, rules) are referenced by path
2. Generated files are in `generated/` (gitignored)
3. The build pipeline can be re-run any time the DSL changes
4. Version checking tracks changes to source files
5. Each build automatically gets a unique version number based on the epoch timestamp
6. The extension is automatically installed in Cursor after successful packaging (when using `validate-dsl.sh`)

## Packaging and Publishing

### Docker-Based VSIX Packaging

The extension uses **Docker-based packaging** to ensure reproducible builds and proper dependency bundling. This approach:

- ✅ Isolates packaging from npm workspace context
- ✅ Ensures all transitive dependencies are included (e.g., `minimatch`, `semver`, `brace-expansion`)
- ✅ Provides reproducible builds across different environments
- ✅ Eliminates workspace hoisting issues
- ✅ Works correctly in Cursor IDE (primary target)

**Why Docker?**

1. **Workspace Isolation**: npm workspaces hoist dependencies to the root, causing `vsce` validation to fail. Docker containers never see the workspace root, eliminating hoisting issues entirely.

2. **Reproducible Builds**: Same Docker image and Node version every time ensures consistent builds across different developer machines and CI environments.

3. **Clean Dependency Tree**: Each Docker run starts with a fresh environment, ensuring no cached dependencies, symlinks, or workspace artifacts interfere with packaging.

4. **Proper Dependency Bundling**: Docker allows us to install dependencies in isolation, flatten nested dependencies, and ensure ALL transitive dependencies are included in the VSIX.

5. **Cursor Compatibility**: Cursor requires all dependencies to be properly bundled. Docker ensures this without hacks or workarounds.

**Critical Principles:**

- ❌ **NEVER use `--no-dependencies` flag**: Cursor requires dependencies to be bundled normally
- ❌ **NO hoisting hacks**: Never rename `package.json`, remove symlinks, or disable workspaces
- ✅ **Robust builds**: Use distinct steps, multiple containers if needed, explicit Node versions
- ✅ **Target Cursor**: Always use `cursor --install-extension`, not `code --install-extension`

**Architecture:**

The packaging uses three main components:

1. **`scripts/package-docker.sh`** - Host-side orchestrator script
   - Builds language server and extension
   - Ensures dependencies are installed locally (not hoisted)
   - Invokes Docker Compose
   - Verifies output

2. **`docker-compose.yml`** - Docker configuration
   - Defines volumes for extension, language server, generated files, and output
   - Mounts source directories as read-only to prevent accidental modifications
   - Volume mappings:
     - `./helium-dsl-vscode` → `/build/extension` (read-only)
     - `./helium-dsl-language-server/out` → `/build/server-out` (read-only)
     - `./helium-dsl-language-server/node_modules` → `/build/server-node-modules` (read-only)
     - `./generated` → `/build/generated` (read-only)
     - `./dist` → `/build/out` (writable, for VSIX output)
   - Runs `docker/package.sh` inside container

3. **`docker/package.sh`** - Container-side packaging script
   - Creates writable working copy at `/build/work`
   - Assembles all required files (extension, server, generated files)
   - Installs and flattens dependencies
   - Runs `vsce package`

**Prerequisites for Packaging:**

- Docker and Docker Compose must be installed and running
- Language server and extension must be built first (handled automatically by `package-docker.sh`)

**Design Principles:**

- **No Hoisting Hacks**: Never rename `package.json`, remove symlinks, or disable workspaces. Docker's isolation solves these problems naturally.
- **Robust Builds**: Use distinct, clear steps. Prefer multiple containers with correct Node versions if needed rather than complex workarounds.
- **No `--no-dependencies`**: NEVER use `vsce package --no-dependencies`. Cursor requires all dependencies to be properly bundled for extraction.
- **Cursor-First**: This extension targets Cursor IDE primarily. Always use `cursor --install-extension` commands, not `code --install-extension`.

### Prerequisites for Publishing

Before publishing the extension to [Open VSX Registry](https://open-vsx.org/), you need:

1. **Open VSX Account**: Create an account at https://open-vsx.org/ if you haven't already
2. **Install ovsx**: Install the Open VSX CLI tool globally:
   ```bash
   npm install -g ovsx
   ```

### Packaging the Extension

To create a `.vsix` package file:

```bash
# From the root directory
npm run package
```

This runs `scripts/package-docker.sh`, which orchestrates the complete packaging workflow.

#### Detailed Packaging Workflow

**Step 1: Build Language Server** (`scripts/package-docker.sh` lines 12-30)
- Changes to `helium-dsl-language-server/` directory
- Installs dependencies locally using `npm install --no-workspaces` (bypasses workspace hoisting to ensure dependencies are in the language server directory)
- Compiles TypeScript: `npm run build` → creates `out/` directory
- Verifies `node_modules/` exists and contains packages (ensures dependencies are available for Docker)

**Step 2: Build Extension** (`scripts/package-docker.sh` lines 32-42)
- Changes to `helium-dsl-vscode/` directory
- Installs dependencies if needed: `npm install`
- Compiles TypeScript: `npm run build` → creates `out/extension.js`

**Step 3: Docker-Based Packaging** (`scripts/package-docker.sh` lines 44-48)
- Runs `docker compose run --rm vsix` which executes `docker/package.sh` inside a Docker container

**Inside Docker Container** (`docker/package.sh`):

1. **Create Working Copy** (lines 10-14)
   - Creates writable directory `/build/work`
   - Copies extension from read-only mount to working directory
   - This allows modifications without affecting source files

2. **Copy Language Server** (lines 16-30)
   - Copies compiled language server from `helium-dsl-language-server/out/` → `server/out/`
   - Copies language server dependencies from `helium-dsl-language-server/node_modules/` → `server/node_modules/`
   - These are required for the language server to run at runtime

3. **Copy Generated Files** (lines 32-36)
   - Copies `generated/` directory (parser, BIF metadata, rules) into extension
   - These files are needed by the language server for parsing and linting

4. **Install Extension Dependencies** (lines 38-41)
   - Runs `npm install --production` in the working copy
   - Installs only production dependencies (e.g., `vscode-languageclient`)
   - Creates isolated dependency tree without workspace hoisting

5. **Flatten Nested Dependencies** (lines 43-62)
   - Moves nested dependencies from `node_modules/vscode-languageclient/node_modules/` to root `node_modules/`
   - This ensures transitive dependencies like `minimatch`, `semver`, `brace-expansion` are accessible
   - Removes all remaining nested `node_modules` directories to prevent duplicate file errors in VSIX

6. **Validate Dependencies** (lines 64-65)
   - Runs `npm list --production` to verify dependency tree is valid
   - Ensures `vsce` will pass its validation checks

7. **Package VSIX** (lines 67-71)
   - Runs `vsce package` to create the VSIX file
   - **Critical**: Does NOT use `--no-dependencies` flag (Cursor requires dependencies to be bundled)
   - Outputs to `dist/helium-dsl.vsix` (mounted from host)

**Step 4: Verify Output** (`scripts/package-docker.sh` lines 50-62)
- Checks that VSIX file was created
- Displays file location and size

#### Complete Workflow Summary

```
Host Machine                          Docker Container
─────────────────                    ─────────────────
1. package-docker.sh
   ├─ Build language server          (on host)
   │  └─ npm install --no-workspaces
   ├─ Build extension                (on host)
   │  └─ npm run build
   └─ docker compose run vsix
                                     2. docker/package.sh
                                        ├─ Create working copy
                                        ├─ Copy server/out/
                                        ├─ Copy server/node_modules/
                                        ├─ Copy generated/
                                        ├─ npm install --production
                                        ├─ Flatten nested deps
                                        ├─ npm list (validate)
                                        └─ vsce package
                                     3. Output to /build/out/
                                        └─ Mounted to dist/helium-dsl.vsix
4. Verify VSIX created
```

#### Why Docker?

The Docker-based approach solves several problems:

1. **Workspace Isolation**: npm workspaces hoist dependencies to the root, causing `vsce` validation to fail. Docker never sees the workspace root, eliminating hoisting issues entirely without hacks.

2. **Dependency Flattening**: npm may install transitive dependencies in nested `node_modules/`. Docker script flattens them so `vsce` includes all dependencies.

3. **Reproducibility**: Same Docker image and Node version every time ensures consistent builds across all environments.

4. **Clean Environment**: Each build starts fresh without workspace artifacts, symlinks, or cached dependencies.

5. **No Hacks Required**: Unlike workspace-based solutions that require renaming files or disabling workspaces, Docker naturally isolates the packaging process.

6. **Cursor Compatibility**: Cursor requires all dependencies to be properly bundled. Docker ensures this without using `--no-dependencies` flag, which would break Cursor's dependency extraction.

**If Multiple Node Versions Are Needed:**

If different Node versions are required for different build steps, use multiple Docker containers rather than complex workarounds:
- Create separate Dockerfiles for each Node version requirement
- Use Docker Compose to orchestrate multi-stage builds
- Keep each step distinct and verifiable

#### Alternative: Using Validation Script

The validation script also includes packaging:

```bash
./validate-dsl.sh -d <dsl-commons-path> -p <sample-project-path>
```

This will:
1. Build all prerequisites (grammar, parser, rules, BIFs)
2. Build the language server
3. Build the extension
4. Run the Docker-based packaging workflow (same as `npm run package`)
5. Output the VSIX to `dist/helium-dsl.vsix`

The generated `.vsix` file includes all required dependencies and can be installed manually or published to a marketplace.

### Installing Locally

To manually install the extension:

**For Cursor:**
```bash
# Install from the .vsix file
cursor --install-extension dist/helium-dsl.vsix --force
```

**For VSCode (secondary target):**
```bash
# Install from the .vsix file
code --install-extension dist/helium-dsl.vsix
```

**Note**: This extension is primarily designed for Cursor IDE. While it works in VS Code, Cursor is the intended target platform.

The VSIX file is created in the `dist/` directory and includes all required dependencies, ensuring the extension activates correctly without module errors.

### Publishing to Open VSX Registry

1. **Get your access token**:
   - Log in to your account at https://open-vsx.org/
   - Go to your account settings
   - Generate an access token

2. **Publish the extension**:
   ```bash
   cd helium-dsl-vscode
   ovsx publish -p <your-access-token>
   ```

   Or set the token as an environment variable for convenience:
   ```bash
   export OVSX_PAT=<your-access-token>
   cd helium-dsl-vscode
   ovsx publish
   ```

   To publish a specific version:
   ```bash
   ovsx publish -p <your-access-token> --packagePath helium-dsl-vscode-<version>.vsix
   ```

3. **Verify**: Check the [Open VSX Registry](https://open-vsx.org/) for your extension. It should appear shortly after publishing.

### Manual Distribution

You can also distribute the `.vsix` file manually:
- Share it directly with users
- Host it on your website
- Include it in your project repository

Users can install it using:
```bash
# For Cursor (primary target)
cursor --install-extension <path-to-vsix-file> --force

# For VS Code (secondary target)
code --install-extension <path-to-vsix-file>
```

### Extension Structure

When packaged, the extension includes:
- `out/` - Compiled extension code
- `server/out/` - Bundled language server
- `server/node_modules/` - Language server dependencies
- `generated/` - Required generated files (parser, BIF metadata, rules)
- `syntaxes/` - TextMate grammar for syntax highlighting
- `language-configuration.json` - Language configuration
- `node_modules/` - Extension dependencies (including `vscode-languageclient` and all transitive dependencies like `minimatch`, `semver`, `brace-expansion`)

### Troubleshooting Packaging

**Docker not running:**
```bash
# Start Docker Desktop or Docker daemon
# Verify Docker is running:
docker ps

# Then retry packaging
npm run package
```

**Language server dependencies missing:**
- The script uses `npm install --no-workspaces` to ensure dependencies are in the language server directory
- If you see "Language server node_modules missing or empty" error:
  ```bash
  cd helium-dsl-language-server
  npm install --no-workspaces
  npm run build
  ```

**Missing dependencies in VSIX:**
- The Docker-based packaging automatically includes all transitive dependencies
- If you see "Cannot find module" errors, ensure you're using the latest VSIX from `dist/helium-dsl.vsix`
- Rebuild and repackage if needed: `npm run package`
- Check Extension Host logs for specific missing modules

**Packaging fails:**
- Ensure Docker is running: `docker ps`
- Check that language server builds successfully: `cd helium-dsl-language-server && npm run build`
- Check that extension builds successfully: `cd helium-dsl-vscode && npm run build`
- Check Docker logs: `docker compose logs vsix`

**Language server fails to start:**
- Ensure the VSIX includes `server/node_modules/` (check with `unzip -l dist/helium-dsl.vsix | grep "server/node_modules"`)
- If missing, the language server dependencies weren't copied - rebuild with `npm run package`
- Verify language server dependencies are installed locally: `ls helium-dsl-language-server/node_modules`

## Contributing

When the Helium DSL is updated:

1. Run the validation script with updated paths
2. Review any new linting errors
3. Update linting rules if needed
4. Commit any changes to tooling scripts

## Script Reference

### Packaging Scripts

**`npm run package`** → `scripts/package-docker.sh`
- Orchestrates complete packaging workflow
- Builds prerequisites, then runs Docker packaging
- Output: `dist/helium-dsl.vsix`

**`docker compose run --rm vsix`**
- Runs Docker container with packaging script
- Requires Docker to be running
- Output: `dist/helium-dsl.vsix`

### Build Scripts

**`npm run build:all`** → `scripts/build.ts`
- Orchestrates all build steps (grammar, parser, rules, BIFs, language server, extension)

**`npm run build:extract`** → `scripts/extract-grammar.ts`
- Extracts ANTLR3 grammar from Java project

**`npm run build:grammar`** → `scripts/convert-grammar.ts`
- Converts ANTLR3 grammar to ANTLR4 format

**`npm run build:parser`**
- Generates TypeScript parser from ANTLR4 grammar using `antlr4ts`

**`npm run build:rules`** → `scripts/extract-rules.ts`
- Extracts linting rules from grammar

**`npm run build:bifs`** → `scripts/generate-bif-metadata.ts`
- Generates metadata for Built-In Functions

**`npm run build:textmate`** → `scripts/generate-textmate.ts`
- Generates TextMate grammar for syntax highlighting

## Notes

- The generated parser may have warnings about unreachable tokens or duplicate names - these are from the original ANTLR3 grammar and can be safely ignored
- Semantic actions containing `token()` calls are automatically removed during conversion
- The parser is regenerated from scratch each time to ensure consistency
- The Docker-based packaging ensures all dependencies are included, preventing "Cannot find module" errors at runtime


