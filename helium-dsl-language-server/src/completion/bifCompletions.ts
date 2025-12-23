import path from "node:path";
import fs from "fs-extra";

const root = path.resolve(__dirname, "..", "..");

function getBifPath(): string {
  // Try bundled path first (when packaged in extension)
  const bundledPath = path.join(root, "..", "generated", "bifs", "bif-metadata.json");
  // Fallback to development path
  const devPath = path.join(root, "..", "..", "generated", "bifs", "bif-metadata.json");
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

export type BifCompletion = {
  label: string;
  detail?: string;
};

export async function loadBifCompletions(): Promise<BifCompletion[]> {
  const bifPath = getBifPath();
  if (!(await fs.pathExists(bifPath))) return [];
  const data = await fs.readJson(bifPath);
  const namespaces = data.namespaces || {};
  const completions: BifCompletion[] = [];
  Object.entries(namespaces).forEach(([ns, entries]: [string, any]) => {
    (entries as any[]).forEach((fn) => {
      completions.push({
        label: `${ns}:${fn.name}`,
        detail: fn.signature || `${ns}:${fn.name}`,
      });
    });
  });
  return completions;
}

