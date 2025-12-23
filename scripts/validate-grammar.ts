import path from "node:path";
import { execSync } from "node:child_process";
import fs from "fs-extra";

const root = path.resolve(__dirname, "..");
const grammar = path.join(root, "generated/grammar/MezDSL.g4");

async function main() {
  if (!(await fs.pathExists(grammar))) {
    throw new Error(`Generated grammar not found: ${grammar}`);
  }

  // Use antlr4ts-cli for validation; it will throw on syntax errors.
  console.log(`Validating grammar at ${grammar}`);
  execSync(`antlr4ts -listener -visitor ${grammar} -o /tmp/antlr-validate`, {
    stdio: "inherit",
    cwd: root,
  });
  await fs.remove("/tmp/antlr-validate");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

