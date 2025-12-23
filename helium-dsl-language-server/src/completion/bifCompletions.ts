import path from "node:path";
import fs from "fs-extra";

const root = path.resolve(__dirname, "..", "..");
const bifPath = path.join(root, "..", "generated", "bifs", "bif-metadata.json");

export type BifCompletion = {
  label: string;
  detail?: string;
};

export async function loadBifCompletions(): Promise<BifCompletion[]> {
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

