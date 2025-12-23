import path from "node:path";
import fs from "fs-extra";

const root = path.resolve(__dirname, "..");
const grammarPath = path.join(root, "generated/grammar/MezDSL.g4");
const output = path.join(root, "generated/bifs/bif-metadata.json");

type Bif = {
  name: string;
  token?: string;
  signature?: string;
  returns?: string;
  deprecated?: boolean;
  replacedBy?: string;
  grammarLine?: number;
};

type Namespace = Record<string, Bif>;

async function main() {
  if (!(await fs.pathExists(grammarPath))) {
    throw new Error(`Generated grammar not found at ${grammarPath}`);
  }

  const grammar = await fs.readFile(grammarPath, "utf8");
  const namespaces: Record<string, Bif[]> = {};

  // Very lightweight extraction: find tokens ending with namespaces.
  const tokenRegex = /^([A-Z0-9_]+)\\s*:\\s*'([A-Za-z0-9:_]+)';/gm;
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(grammar))) {
    const [, tokenName, literal] = match;
    const parts = literal.split(":");
    if (parts.length === 2) {
      const [ns, fn] = parts;
      namespaces[ns] = namespaces[ns] ?? [];
      namespaces[ns].push({
        name: fn,
        token: tokenName,
        signature: literal,
        grammarLine: grammar.substring(0, match.index).split("\n").length,
      });
    }
  }

  const data = {
    version: "0.1.0",
    extractedFrom: grammarPath,
    extractedAt: new Date().toISOString(),
    namespaces,
  };

  await fs.ensureDir(path.dirname(output));
  await fs.writeJson(output, data, { spaces: 2 });
  console.log(
    `Generated BIF metadata to ${output} (${Object.values(namespaces).reduce(
      (sum, arr) => sum + arr.length,
      0
    )} entries)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

