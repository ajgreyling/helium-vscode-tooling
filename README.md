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
│   ├── extract-rules.ts      # Extract linting rules from rules.md
│   ├── generate-bif-metadata.ts  # Generate BIF metadata
│   ├── generate-textmate.ts  # Generate TextMate grammar
│   ├── build.ts             # Main build orchestrator
│   ├── watch.ts             # Watch for changes
│   └── version-check.ts     # Version tracking
├── helium-dsl-language-server/  # LSP server implementation
├── helium-dsl-vscode/      # VSCode extension client
├── generated/              # Generated files (not in git)
├── validate-dsl.sh         # Validation pipeline script
└── package.json
```

## Prerequisites

- Node.js >= 18
- npm or pnpm
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
5. Extract linting rules from rules.md
6. Generate BIF metadata
7. Generate TextMate grammar for syntax highlighting
8. Build the language server
9. Build the VSCode extension
10. Run validation tests against your sample project

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
- **Rules Source**: `${DSL_COMMONS}/rules.md`
- **Sample Project**: Path provided via `-p` parameter

## Linting Rules

The linter currently implements the following rules extracted from `rules.md`:

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

## Automation & Repeatability

This tooling is designed to be fully automated and repeatable:

1. All source files (grammar, rules) are referenced by path
2. Generated files are in `generated/` (gitignored)
3. The build pipeline can be re-run any time the DSL changes
4. Version checking tracks changes to source files

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


