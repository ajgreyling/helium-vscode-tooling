import chokidar from "chokidar";
import { execSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const grammarFile = "/Users/ajgreyling/code/appexec-dsl-commons/WebDSLParser-lib/src/main/antlr3/com/mezzanine/dsl/web/MezDSL.g";
const rulesFile = "";

console.log("Watching for changes...");
console.log("  Grammar:", grammarFile);
console.log("  Rules:", rulesFile);

const watcher = chokidar.watch([grammarFile, rulesFile], {
  persistent: true,
});

watcher.on("change", (filepath) => {
  console.log(`\nFile changed: ${filepath}`);
  console.log("Running build pipeline...");
  try {
    execSync("npm run build:all", { cwd: root, stdio: "inherit" });
    console.log("Build completed successfully!");
  } catch (err) {
    console.error("Build failed:", err);
  }
});

console.log("Press Ctrl+C to stop watching");
