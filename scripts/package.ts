import path from "node:path";
import { execSync } from "node:child_process";
import fs from "fs-extra";

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "dist");

async function main() {
  await fs.ensureDir(outDir);
  console.log("Building extension package...");
  execSync("npm run package", { cwd: root, stdio: "inherit" });
  console.log(`Packages generated in ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

