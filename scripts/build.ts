import { execSync } from "node:child_process";
import path from "node:path";
import fs from "fs-extra";

const root = path.resolve(__dirname, "..");
const generated = path.join(root, "generated");

function run(cmd: string, opts: { cwd?: string } = {}) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: opts.cwd ?? root });
}

async function ensureGenerated() {
  await fs.ensureDir(path.join(generated, "grammar"));
  await fs.ensureDir(path.join(generated, "parser"));
  await fs.ensureDir(path.join(generated, "rules"));
  await fs.ensureDir(path.join(generated, "bifs"));
}

async function main() {
  await ensureGenerated();

  // 1. Extract ANTLR3 grammar from Java project
  run("ts-node scripts/extract-grammar.ts");

  // 2. Convert ANTLR3 → ANTLR4
  run("ts-node scripts/convert-grammar.ts");

  // 3. Validate grammar
  run("ts-node scripts/validate-grammar.ts");

  // 4. Generate TypeScript parser
  run("npm run build:parser");

  // 5. Generate lint rules
  run("ts-node scripts/extract-rules.ts");

  // 6. Generate BIF metadata
  run("ts-node scripts/generate-bif-metadata.ts");

  // 7. Generate TextMate grammar
  run("ts-node scripts/generate-textmate.ts");

  // 8. Build language server + extension
  run("npm run build", { cwd: path.join(root, "..", "helium-dsl-language-server") });
  run("npm run build", { cwd: path.join(root, "helium-dsl-vscode") });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

