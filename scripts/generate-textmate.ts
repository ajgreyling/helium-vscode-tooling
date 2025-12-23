import path from "node:path";
import fs from "fs-extra";

const root = path.resolve(__dirname, "..");
const grammarPath = path.join(root, "generated/grammar/MezDSL.g4");
const bifMetaPath = path.join(root, "generated/bifs/bif-metadata.json");
const output = path.join(root, "helium-dsl-vscode/syntaxes/helium-dsl.tmLanguage.json");

async function main() {
  if (!(await fs.pathExists(grammarPath))) {
    throw new Error(`Missing grammar: ${grammarPath}`);
  }

  const bifMeta = (await fs.pathExists(bifMetaPath))
    ? await fs.readJson(bifMetaPath)
    : { namespaces: {} };

  // Keywords from primitive rules (simple heuristic).
  const grammar = await fs.readFile(grammarPath, "utf8");
  const keywordSet = new Set<string>();
  const keywordRegex = /\\b(unit|persistent|object|enum|validator|if|else|for|foreach|return)\\b/g;
  let m: RegExpExecArray | null;
  while ((m = keywordRegex.exec(grammar))) {
    keywordSet.add(m[1]);
  }

  const bifNamespaces = Object.keys(bifMeta.namespaces ?? {});

  const tmLanguage = {
    $schema: "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
    name: "Helium DSL",
    scopeName: "source.helium-dsl",
    patterns: [
      { include: "#comments" },
      { include: "#strings" },
      {
        name: "keyword.control.helium",
        match: `\\b(${Array.from(keywordSet).join("|")})\\b`,
      },
      {
        name: "support.namespace.helium",
        match: `\\b(${bifNamespaces.join("|")})(?=:)`,
      },
    ],
    repository: {
      comments: {
        patterns: [
          { name: "comment.line.double-slash.helium", match: "//.*$" },
          { name: "comment.block.helium", begin: "/\\*", end: "\\*/" },
        ],
      },
      strings: {
        patterns: [
          { name: "string.quoted.double.helium", begin: '"', end: '"', patterns: [{ include: "#escapes" }] },
          { name: "string.quoted.block.helium", begin: "/%", end: "%/" },
        ],
      },
      escapes: {
        patterns: [{ name: "constant.character.escape.helium", match: "\\\\." }],
      },
    },
    fileTypes: ["mez"],
    uuid: "a0416cfa-4b07-44d4-9f7a-8ad7f3f1b0f1",
  };

  await fs.writeJson(output, tmLanguage, { spaces: 2 });
  console.log(`Generated TextMate grammar at ${output}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

