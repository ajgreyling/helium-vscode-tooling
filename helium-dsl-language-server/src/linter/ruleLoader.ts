import path from "node:path";
import fs from "fs-extra";

const root = path.resolve(__dirname, "..", "..");
const rulesPath = path.join(root, "..", "generated", "rules", "dsl-rules.json");

export type LoadedRule = {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  category: string;
};

export async function loadRules(): Promise<Record<string, LoadedRule>> {
  if (!(await fs.pathExists(rulesPath))) {
    return defaultRules();
  }
  const data = await fs.readJson(rulesPath);
  const rules = data.rules || {};
  return Object.keys(rules).length ? rules : defaultRules();
}

function defaultRules(): Record<string, LoadedRule> {
  return {
    "no-var-in-else": {
      id: "no-var-in-else",
      severity: "error",
      message: "Variables cannot be declared in else blocks. Declare before if statement.",
      category: "variables",
    },
    "dot-notation-limit": {
      id: "dot-notation-limit",
      severity: "warning",
      message: "Dot notation can only be used once per statement",
      category: "style",
    },
    "naming-conventions": {
      id: "naming-conventions",
      severity: "warning",
      message: "Identifiers must follow Helium DSL naming conventions.",
      category: "style",
    },
    "forbidden-operators": {
      id: "forbidden-operators",
      severity: "warning",
      message: "Forbidden operator usage.",
      category: "style",
    },
  };
}

