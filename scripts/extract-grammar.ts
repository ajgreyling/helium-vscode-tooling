import path from "node:path";
import fs from "fs-extra";
import crypto from "node:crypto";

const root = path.resolve(__dirname, "..");
const sourceGrammar = "/Users/ajgreyling/code/appexec-dsl-commons/WebDSLParser-lib/src/main/antlr3/com/mezzanine/dsl/web/MezDSL.g";
const targetGrammar = path.join(root, "generated/grammar/MezDSL.g3");
const hashFile = path.join(root, "generated/grammar/MezDSL.g3.hash");

async function fileHash(file: string) {
  const buf = await fs.readFile(file);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function main() {
  if (!(await fs.pathExists(sourceGrammar))) {
    throw new Error(`Source grammar not found: ${sourceGrammar}`);
  }

  await fs.ensureDir(path.dirname(targetGrammar));
  await fs.copyFile(sourceGrammar, targetGrammar);

  const hash = await fileHash(targetGrammar);
  await fs.writeFile(hashFile, hash, "utf8");

  console.log(`Extracted grammar to ${targetGrammar}`);
  console.log(`SHA256: ${hash}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
