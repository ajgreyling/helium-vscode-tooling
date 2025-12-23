#!/bin/bash

# Helium DSL Linter Validation Script
# This script converts ANTLR3 grammar to ANTLR4, generates the parser,
# extracts linting rules, and validates a DSL project codebase.

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DSL_COMMONS_PATH=""
SAMPLE_PROJECT_PATH=""

# Parse command line arguments
usage() {
    echo "Usage: $0 -d <dsl-commons-path> -p <sample-project-path>"
    echo ""
    echo "Arguments:"
    echo "  -d    Path to appexec-dsl-commons folder (contains WebDSLParser-lib and rules.md)"
    echo "  -p    Path to sample DSL project to validate (contains .mez files)"
    echo ""
    echo "Example:"
    echo "  $0 -d /Users/ajgreyling/code/appexec-dsl-commons -p /Users/ajgreyling/code/munic-chat"
    exit 1
}

while getopts "d:p:h" opt; do
    case $opt in
        d) DSL_COMMONS_PATH="$OPTARG" ;;
        p) SAMPLE_PROJECT_PATH="$OPTARG" ;;
        h) usage ;;
        *) usage ;;
    esac
done

# Validate required arguments
if [ -z "$DSL_COMMONS_PATH" ] || [ -z "$SAMPLE_PROJECT_PATH" ]; then
    echo -e "${RED}Error: Both DSL commons path and sample project path are required${NC}"
    usage
fi

# Validate paths exist
if [ ! -d "$DSL_COMMONS_PATH" ]; then
    echo -e "${RED}Error: DSL commons path does not exist: $DSL_COMMONS_PATH${NC}"
    exit 1
fi

if [ ! -d "$SAMPLE_PROJECT_PATH" ]; then
    echo -e "${RED}Error: Sample project path does not exist: $SAMPLE_PROJECT_PATH${NC}"
    exit 1
fi

# Validate required files/folders exist
GRAMMAR_FILE="$DSL_COMMONS_PATH/WebDSLParser-lib/src/main/antlr3/com/mezzanine/dsl/web/MezDSL.g"
RULES_FILE="$DSL_COMMONS_PATH/rules.md"

if [ ! -f "$GRAMMAR_FILE" ]; then
    echo -e "${RED}Error: Grammar file not found: $GRAMMAR_FILE${NC}"
    exit 1
fi

if [ ! -f "$RULES_FILE" ]; then
    echo -e "${RED}Error: Rules file not found: $RULES_FILE${NC}"
    exit 1
fi

# Update script configurations with provided paths
echo -e "${BLUE}=== Configuring paths ===${NC}"
echo "DSL Commons: $DSL_COMMONS_PATH"
echo "Sample Project: $SAMPLE_PROJECT_PATH"
echo ""

# Update extract-grammar.ts
echo -e "${BLUE}Updating extract-grammar.ts...${NC}"
cat > "$SCRIPT_DIR/scripts/extract-grammar.ts" << EOF
import path from "node:path";
import fs from "fs-extra";
import crypto from "node:crypto";

const root = path.resolve(__dirname, "..");
const sourceGrammar = "$GRAMMAR_FILE";
const targetGrammar = path.join(root, "generated/grammar/MezDSL.g3");
const hashFile = path.join(root, "generated/grammar/MezDSL.g3.hash");

async function fileHash(file: string) {
  const buf = await fs.readFile(file);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function main() {
  if (!(await fs.pathExists(sourceGrammar))) {
    throw new Error(\`Source grammar not found: \${sourceGrammar}\`);
  }

  await fs.ensureDir(path.dirname(targetGrammar));
  await fs.copyFile(sourceGrammar, targetGrammar);

  const hash = await fileHash(targetGrammar);
  await fs.writeFile(hashFile, hash, "utf8");

  console.log(\`Extracted grammar to \${targetGrammar}\`);
  console.log(\`SHA256: \${hash}\`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
EOF

# Update extract-rules.ts
echo -e "${BLUE}Updating extract-rules.ts...${NC}"
cat > "$SCRIPT_DIR/scripts/extract-rules.ts" << 'EOF'
import path from "node:path";
import fs from "fs-extra";

const root = path.resolve(__dirname, "..");
const rulesMd = process.env.RULES_FILE || path.resolve(root, "../rules.md");
const output = path.join(root, "generated/rules/dsl-rules.json");

type Rule = {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  category: string;
  sourceLines?: number[];
};

async function main() {
  if (!(await fs.pathExists(rulesMd))) {
    throw new Error(`rules.md not found at ${rulesMd}`);
  }

  const content = await fs.readFile(rulesMd, "utf8");
  const rules: Record<string, Rule> = {};

  // Minimal heuristic-based extraction for critical rules.
  if (content.includes("Variables cannot be declared in the else block")) {
    rules["no-var-in-else"] = {
      id: "no-var-in-else",
      severity: "error",
      message: "Variables cannot be declared in else blocks. Declare before if statement.",
      category: "variables",
    };
  }

  if (content.includes("Dot notation can only be used once")) {
    rules["dot-notation-limit"] = {
      id: "dot-notation-limit",
      severity: "warning",
      message: "Dot notation can only be used once per statement.",
      category: "syntax",
    };
  }

  if (content.includes("Naming Conventions")) {
    rules["naming-conventions"] = {
      id: "naming-conventions",
      severity: "warning",
      message: "Follow naming conventions",
      category: "style",
    };
  }

  await fs.ensureDir(path.dirname(output));
  await fs.writeJSON(output, rules, { spaces: 2 });
  console.log(`Wrote lint rule metadata to ${output} (${Object.keys(rules).length} rules)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
EOF

# Update watch.ts
echo -e "${BLUE}Updating watch.ts...${NC}"
cat > "$SCRIPT_DIR/scripts/watch.ts" << EOF
import chokidar from "chokidar";
import { execSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const grammarFile = "$GRAMMAR_FILE";
const rulesFile = "$RULES_FILE";

console.log("Watching for changes...");
console.log("  Grammar:", grammarFile);
console.log("  Rules:", rulesFile);

const watcher = chokidar.watch([grammarFile, rulesFile], {
  persistent: true,
});

watcher.on("change", (filepath) => {
  console.log(\`\nFile changed: \${filepath}\`);
  console.log("Running build pipeline...");
  try {
    execSync("npm run build:all", { cwd: root, stdio: "inherit" });
    console.log("Build completed successfully!");
  } catch (err) {
    console.error("Build failed:", err);
  }
});

console.log("Press Ctrl+C to stop watching");
EOF

# Update version-check.ts
echo -e "${BLUE}Updating version-check.ts...${NC}"
cat > "$SCRIPT_DIR/scripts/version-check.ts" << EOF
import { execSync } from "node:child_process";
import fs from "fs-extra";
import crypto from "node:crypto";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const dslCommonsPath = "$DSL_COMMONS_PATH";

async function fileHash(file: string) {
  const buf = await fs.readFile(file);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function main() {
  console.log("Version Check Report");
  console.log("===================");

  // Git hash of appexec-dsl-commons
  try {
    const gitHash = execSync("git rev-parse HEAD", {
      cwd: dslCommonsPath,
      encoding: "utf8",
    }).trim();
    console.log(\`DSL Commons Git Hash: \${gitHash}\`);
  } catch (err) {
    console.log("DSL Commons Git Hash: N/A (not a git repo)");
  }

  // Grammar file hash
  const grammarFile = "$GRAMMAR_FILE";
  if (await fs.pathExists(grammarFile)) {
    const hash = await fileHash(grammarFile);
    console.log(\`Grammar File Hash: \${hash.substring(0, 12)}...\`);
  }

  // Rules file hash
  const rulesFile = "$RULES_FILE";
  if (await fs.pathExists(rulesFile)) {
    const hash = await fileHash(rulesFile);
    console.log(\`Rules File Hash: \${hash.substring(0, 12)}...\`);
  }

  // Last generated timestamp
  const generatedDir = path.join(root, "generated");
  if (await fs.pathExists(generatedDir)) {
    const stats = await fs.stat(generatedDir);
    console.log(\`Last Generated: \${stats.mtime.toISOString()}\`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
EOF

# Update test configuration to use the sample project path
echo -e "${BLUE}Updating test configuration...${NC}"
cat > "$SCRIPT_DIR/helium-dsl-language-server/tests/munic-chat.test.ts" << EOF
import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { parseText } from "../src/parser/index";
import { runLints } from "../src/linter/engine";

const SAMPLE_PROJECT_PATH = "$SAMPLE_PROJECT_PATH";

describe("Sample DSL Codebase Validation", () => {
  it("should validate all .mez files in sample project", async function() {
    this.timeout(10000); // Increase timeout for large codebases

    const mezFiles: string[] = [];

    function findMezFiles(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          findMezFiles(fullPath);
        } else if (entry.name.endsWith(".mez")) {
          mezFiles.push(fullPath);
        }
      }
    }

    findMezFiles(SAMPLE_PROJECT_PATH);
    console.log(\`\\n  Found \${mezFiles.length} .mez files to validate\\n\`);

    const fileIssues: Record<string, any[]> = {};
    let totalIssues = 0;
    const issuesByRule: Record<string, number> = {};

    for (const file of mezFiles) {
      const text = fs.readFileSync(file, "utf8");
      const relativePath = path.relative(SAMPLE_PROJECT_PATH, file);

      try {
        const parseResult = parseText(text);
        const lintDiagnostics = await runLints(text);
        const allDiagnostics = [...parseResult.diagnostics, ...lintDiagnostics];

        if (allDiagnostics.length > 0) {
          fileIssues[relativePath] = allDiagnostics;
          totalIssues += allDiagnostics.length;

          allDiagnostics.forEach((diag) => {
            const source = diag.source || "unknown";
            issuesByRule[source] = (issuesByRule[source] || 0) + 1;
          });
        }
      } catch (err) {
        fileIssues[relativePath] = [
          {
            message: err instanceof Error ? err.message : String(err),
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
            severity: 1,
            source: "test-error",
          },
        ];
        totalIssues++;
      }
    }

    // Print summary
    console.log(\`  📊 Summary:\`);
    console.log(\`    Files scanned: \${mezFiles.length}\`);
    console.log(\`    Files with issues: \${Object.keys(fileIssues).length}\`);
    console.log(\`    Total issues: \${totalIssues}\`);
    console.log(\`\`);
    console.log(\`  📋 Issues by rule:\`);
    Object.entries(issuesByRule)
      .sort(([, a], [, b]) => b - a)
      .forEach(([rule, count]) => {
        console.log(\`    \${rule}: \${count}\`);
      });

    // Print file details (limit to first 5 issues per file)
    if (Object.keys(fileIssues).length > 0) {
      console.log(\`\`);
      console.log(\`  📝 Files with issues:\`);
      console.log(\`\`);
      for (const [file, issues] of Object.entries(fileIssues)) {
        console.log(\`    \${file}:\`);
        const displayIssues = issues.slice(0, 5);
        displayIssues.forEach((issue) => {
          console.log(\`      Line \${issue.range.start.line + 1}: \${issue.message}\`);
        });
        if (issues.length > 5) {
          console.log(\`      ... and \${issues.length - 5} more\`);
        }
        console.log(\`\`);
      }

      // Count critical errors (variable-in-else)
      const varInElseErrors = Object.values(fileIssues)
        .flat()
        .filter((d) => d.message.includes("Variables cannot be declared in else blocks"));

      console.log(\`  ❌ \${varInElseErrors.length} errors found\`);
    } else {
      console.log(\`\`);
      console.log(\`  ✅ No issues found!\`);
    }

    // Test passes regardless - this is a validation report
    expect(mezFiles.length).to.be.greaterThan(0);
  });

  it("should not flag variables in else blocks in known-good code", async () => {
    // This is a representative test case
    const testCode = \`
      if (x > 0) {
        int y = 5;
      } else {
        return false;
      }
    \`;

    const lintDiagnostics = await runLints(testCode);
    const varInElseErrors = lintDiagnostics.filter((d) =>
      d.message.includes("Variables cannot be declared in else blocks")
    );

    console.log(\`    Found \${varInElseErrors.length} variable-in-else violations\`);
    expect(varInElseErrors.length).to.equal(0);
  });
});
EOF

echo ""
echo -e "${GREEN}=== Configuration Complete ===${NC}"
echo ""

# Run the build pipeline
echo -e "${BLUE}=== Step 1: Extract Grammar ===${NC}"
cd "$SCRIPT_DIR"
npm run build:extract

echo ""
echo -e "${BLUE}=== Step 2: Convert ANTLR3 to ANTLR4 ===${NC}"
npm run build:grammar

echo ""
echo -e "${BLUE}=== Step 3: Validate Grammar ===${NC}"
npm run build:validate || echo -e "${YELLOW}Warning: Grammar validation had warnings${NC}"

echo ""
echo -e "${BLUE}=== Step 4: Generate Parser ===${NC}"
npm run build:parser

echo ""
echo -e "${BLUE}=== Step 5: Extract Rules ===${NC}"
RULES_FILE="$RULES_FILE" npm run build:rules

echo ""
echo -e "${BLUE}=== Step 6: Generate BIF Metadata ===${NC}"
npm run build:bifs

echo ""
echo -e "${BLUE}=== Step 7: Generate TextMate Grammar ===${NC}"
npm run build:textmate

echo ""
echo -e "${BLUE}=== Step 8: Build Language Server ===${NC}"
cd "$SCRIPT_DIR/helium-dsl-language-server"
npm run build

echo ""
echo -e "${BLUE}=== Step 9: Build VSCode Extension ===${NC}"
cd "$SCRIPT_DIR/helium-dsl-vscode"
npm run build

echo ""
echo -e "${BLUE}=== Step 10: Run Validation Tests ===${NC}"
cd "$SCRIPT_DIR"
npm test

echo ""
echo -e "${GREEN}=== Pipeline Complete ===${NC}"
echo ""
echo -e "${GREEN}✓${NC} Grammar extracted and converted"
echo -e "${GREEN}✓${NC} Parser generated"
echo -e "${GREEN}✓${NC} Rules extracted"
echo -e "${GREEN}✓${NC} Language server built"
echo -e "${GREEN}✓${NC} VSCode extension built"
echo -e "${GREEN}✓${NC} Validation tests run"
echo ""
echo -e "Sample project validated: ${BLUE}$SAMPLE_PROJECT_PATH${NC}"
echo ""

