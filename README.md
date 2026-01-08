# Helium DSL VSCode Extension Tooling

This project provides automated tooling for building a VSCode extension for the Helium Rapid DSL, including:
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
│   └── package-docker.sh    # Docker-based VSIX packaging helper
├── docker/               # Docker packaging infrastructure
│   ├── Dockerfile.vsix   # Docker image for VSIX packaging
│   └── package.sh        # Packaging script (runs inside Docker)
├── docker-compose.yml    # Docker Compose configuration
├── helium-dsl-language-server/  # LSP server implementation
├── helium-dsl-vscode/      # VSCode extension client
├── generated/              # Generated files (not in git)
├── dist/                   # VSIX output directory (not in git)
├── validate-dsl.sh         # Validation pipeline script
└── package.json
```

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
- ✅ Works correctly in Cursor

**How it works:**

1. Builds the language server and extension on the host
2. Uses Docker to create an isolated packaging environment
3. Copies extension, language server, and generated files into Docker
4. Installs production dependencies in isolation
5. Flattens nested dependencies to ensure all are included
6. Packages the VSIX using `vsce`

**Prerequisites for Packaging:**

- Docker and Docker Compose must be installed and running
- Language server and extension must be built first (handled automatically)

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

This will:
1. Build the language server (if needed)
2. Build the extension (if needed)
3. Run Docker-based packaging
4. Create a `.vsix` file in `dist/helium-dsl.vsix`

Or use the validation script which includes packaging:

```bash
./validate-dsl.sh -d <dsl-commons-path> -p <sample-project-path>
```

The packaging process:
1. Builds all prerequisites (grammar, parser, rules, BIFs)
2. Builds the language server
3. Builds the extension
4. Uses Docker to package the VSIX with all dependencies
5. Outputs the VSIX to `dist/helium-dsl.vsix`

The generated `.vsix` file includes all required dependencies and can be installed manually or published to a marketplace.

### Installing Locally

To manually install the extension:

**For Cursor:**
```bash
# Install from the .vsix file
cursor --install-extension dist/helium-dsl.vsix --force
```

**For VSCode:**
```bash
# Install from the .vsix file
code --install-extension dist/helium-dsl.vsix
```

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
# Then retry packaging
npm run package
```

**Missing dependencies in VSIX:**
- The Docker-based packaging automatically includes all transitive dependencies
- If you see "Cannot find module" errors, ensure you're using the latest VSIX from `dist/helium-dsl.vsix`
- Rebuild and repackage if needed: `npm run package`

**Packaging fails:**
- Ensure Docker is running: `docker ps`
- Check that language server builds successfully: `cd helium-dsl-language-server && npm run build`
- Check that extension builds successfully: `cd helium-dsl-vscode && npm run build`

## Contributing

When the Helium DSL is updated:

1. Run the validation script with updated paths
2. Review any new linting errors
3. Update linting rules if needed
4. Commit any changes to tooling scripts

## Notes

- The generated parser may have warnings about unreachable tokens or duplicate names - these are from the original ANTLR3 grammar and can be safely ignored
- Semantic actions containing `token()` calls are automatically removed during conversion
- The parser is regenerated from scratch each time to ensure consistency


