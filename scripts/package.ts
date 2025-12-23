import path from "node:path";
import { execSync } from "node:child_process";
import fs from "fs-extra";

const root = path.resolve(__dirname, "..");
const extensionDir = path.join(root, "helium-dsl-vscode");

async function main() {
  console.log("🚀 Starting extension packaging process...\n");

  // 1. Build all prerequisites (grammar, parser, rules, BIFs)
  console.log("📦 Step 1: Building prerequisites (grammar, parser, rules, BIFs)...");
  execSync("npm run build:all", { cwd: root, stdio: "inherit" });

  // 2. Build language server
  console.log("\n🔧 Step 2: Building language server...");
  execSync("npm run build", {
    cwd: path.join(root, "helium-dsl-language-server"),
    stdio: "inherit",
  });

  // 3. Build extension (this will run prepublish which bundles everything)
  console.log("\n📝 Step 3: Building extension and bundling dependencies...");
  execSync("npm run build", { cwd: extensionDir, stdio: "inherit" });

  // 4. Package the extension
  console.log("\n📦 Step 4: Creating VSIX package...");
  execSync("npm run package", { cwd: extensionDir, stdio: "inherit" });

  // 5. Find and report the generated .vsix file
  const vsixFiles = await fs.readdir(extensionDir);
  const vsixFile = vsixFiles.find((f) => f.endsWith(".vsix"));
  
  if (vsixFile) {
    const vsixPath = path.join(extensionDir, vsixFile);
    const stats = await fs.stat(vsixPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`\n✅ Package created successfully!`);
    console.log(`   File: ${vsixPath}`);
    console.log(`   Size: ${sizeMB} MB`);
    console.log(`\n📥 To install locally:`);
    console.log(`   code --install-extension ${vsixFile}`);
    console.log(`\n📤 To publish to Open VSX:`);
    console.log(`   cd helium-dsl-vscode`);
    console.log(`   ovsx publish -p <your-access-token>`);
    console.log(`\n   Or set OVSX_PAT environment variable:`);
    console.log(`   export OVSX_PAT=<your-access-token>`);
    console.log(`   ovsx publish`);
  } else {
    console.error("\n❌ Error: .vsix file not found after packaging");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n❌ Packaging failed:", err);
  process.exit(1);
});

