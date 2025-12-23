import path from "node:path";
import fs from "fs-extra";

const root = path.resolve(__dirname, "..");
const output = path.join(root, "generated/rules/dsl-rules.json");

type Rule = {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  category: string;
  sourceLines?: number[];
};

async function main() {
  // Define linting rules directly
  const rules: Record<string, Rule> = {
    "no-var-in-else": {
      id: "no-var-in-else",
      severity: "error",
      message: "Variables cannot be declared in else blocks. Declare before if statement.",
      category: "variables",
    },
    "dot-notation-limit": {
      id: "dot-notation-limit",
      severity: "warning",
      message: "Dot notation can only be used once per statement.",
      category: "syntax",
    },
    "naming-conventions": {
      id: "naming-conventions",
      severity: "warning",
      message: "Follow naming conventions",
      category: "style",
    },
  };

  await fs.ensureDir(path.dirname(output));
  await fs.writeJSON(output, rules, { spaces: 2 });
  console.log(`Wrote lint rule metadata to ${output} (${Object.keys(rules).length} rules)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
