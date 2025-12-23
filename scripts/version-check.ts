import { execSync } from "node:child_process";
import fs from "fs-extra";
import crypto from "node:crypto";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const dslCommonsPath = "/Users/ajgreyling/code/appexec-dsl-commons";

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
    console.log(`DSL Commons Git Hash: ${gitHash}`);
  } catch (err) {
    console.log("DSL Commons Git Hash: N/A (not a git repo)");
  }

  // Grammar file hash
  const grammarFile = "/Users/ajgreyling/code/appexec-dsl-commons/WebDSLParser-lib/src/main/antlr3/com/mezzanine/dsl/web/MezDSL.g";
  if (await fs.pathExists(grammarFile)) {
    const hash = await fileHash(grammarFile);
    console.log(`Grammar File Hash: ${hash.substring(0, 12)}...`);
  }

  // Rules file hash
  const rulesFile = "";
  if (await fs.pathExists(rulesFile)) {
    const hash = await fileHash(rulesFile);
    console.log(`Rules File Hash: ${hash.substring(0, 12)}...`);
  }

  // Last generated timestamp
  const generatedDir = path.join(root, "generated");
  if (await fs.pathExists(generatedDir)) {
    const stats = await fs.stat(generatedDir);
    console.log(`Last Generated: ${stats.mtime.toISOString()}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
