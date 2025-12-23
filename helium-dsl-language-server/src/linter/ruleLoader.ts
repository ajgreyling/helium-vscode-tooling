import path from "node:path";
import fs from "fs-extra";

const root = path.resolve(__dirname, "..", "..");

function getRulesPath(): string {
  // Try bundled path first (when packaged in extension)
  const bundledPath = path.join(root, "..", "generated", "rules", "dsl-rules.json");
  // Fallback to development path
  const devPath = path.join(root, "..", "..", "generated", "rules", "dsl-rules.json");
  // Check which exists synchronously (for path resolution)
  try {
    if (fs.existsSync(bundledPath)) {
      return bundledPath;
    }
  } catch {
    // Ignore errors
  }
  return devPath;
}

export type LoadedRule = {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  category: string;
};

export async function loadRules(): Promise<Record<string, LoadedRule>> {
  const rulesPath = getRulesPath();
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

