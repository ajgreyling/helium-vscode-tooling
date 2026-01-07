import path from "node:path";
import fs from "fs-extra";
import { glob } from "glob";

const root = path.resolve(__dirname, "..");
const grammarPath = path.join(root, "generated/grammar/MezDSL.g4");
const bifMetaPath = path.join(root, "generated/bifs/bif-metadata.json");
const output = path.join(root, "helium-dsl-vscode/syntaxes/helium-dsl.tmLanguage.json");

// System/primitive types
const systemTypes = [
  "int",
  "decimal",
  "bigint",
  "uuid",
  "blob",
  "bool",
  "string",
  "void",
  "date",
  "datetime",
  "json",
  "jsonarray",
];

// Function to scan model files for user-defined types
async function extractUserDefinedTypes(projectPath?: string): Promise<{
  persistent: Set<string>;
  nonPersistent: Set<string>;
}> {
  const persistent = new Set<string>();
  const nonPersistent = new Set<string>();

  if (!projectPath) {
    return { persistent, nonPersistent };
  }

  try {
    const modelDir = path.join(projectPath, "model");
    if (!(await fs.pathExists(modelDir))) {
      return { persistent, nonPersistent };
    }

    // Find all .mez files in model directory
    const mezFiles = await glob("**/*.mez", {
      cwd: modelDir,
      absolute: true,
    });

    // Regex to match object definitions (handle annotations and whitespace)
    const persistentObjectRegex = /(?:^|\n)\s*(?:@\w+\s+)*persistent\s+object\s+([A-Z][a-zA-Z0-9_]*)/m;
    const objectRegex = /(?:^|\n)\s*(?:@\w+\s+)*object\s+([A-Z][a-zA-Z0-9_]*)/m;

    for (const file of mezFiles) {
      try {
        const content = await fs.readFile(file, "utf8");
        
        // Check for persistent objects
        const persistentMatch = content.match(persistentObjectRegex);
        if (persistentMatch) {
          persistent.add(persistentMatch[1]);
        }

        // Check for non-persistent objects (only if not already found as persistent)
        const objectMatch = content.match(objectRegex);
        if (objectMatch && !persistent.has(objectMatch[1])) {
          nonPersistent.add(objectMatch[1]);
        }
      } catch (err) {
        // Skip files that can't be read
        console.warn(`Warning: Could not read ${file}: ${err}`);
      }
    }
  } catch (err) {
    console.warn(`Warning: Could not scan model directory: ${err}`);
  }

  return { persistent, nonPersistent };
}

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
  const keywordRegex = /\b(unit|persistent|object|enum|validator|if|else|for|foreach|return)\b/g;
  let m: RegExpExecArray | null;
  while ((m = keywordRegex.exec(grammar))) {
    keywordSet.add(m[1]);
  }

  const bifNamespaces = Object.keys(bifMeta.namespaces ?? {});

  // Extract user-defined types (optional - check for project path in environment or common locations)
  const projectPath = process.env.MEZ_PROJECT_PATH || process.env.SAMPLE_PROJECT_PATH;
  const { persistent: persistentTypes, nonPersistent: nonPersistentTypes } =
    await extractUserDefinedTypes(projectPath);

  const allUserTypes = new Set([...persistentTypes, ...nonPersistentTypes]);

  // Build patterns array
  const patterns: any[] = [
    { include: "#comments" },
    { include: "#strings" },
    {
      name: "keyword.control.helium",
      match: `\\b(${Array.from(keywordSet).join("|")})\\b`,
    },
  ];

  // Add system types pattern
  patterns.push({
    name: "storage.type.primitive.helium",
    match: `\\b(${systemTypes.join("|")})\\b`,
  });

  // Add object definition patterns (must come before user-defined types to catch definitions)
  // Pattern for persistent object definitions
  patterns.push({
    name: "meta.object.definition.persistent.helium",
    begin: "\\b(persistent)\\s+(object)\\s+",
    end: "\\s*\\{",
    beginCaptures: {
      1: {
        name: "storage.modifier.helium",
      },
      2: {
        name: "keyword.control.helium",
      },
    },
    endCaptures: {
      0: {
        name: "punctuation.definition.block.begin.helium",
      },
    },
    patterns: [
      {
        name: "entity.name.type.class.helium",
        match: "\\b([A-Z][a-zA-Z0-9_]*)\\b",
      },
    ],
  });

  // Pattern for non-persistent object definitions
  patterns.push({
    name: "meta.object.definition.helium",
    begin: "\\b(object)\\s+",
    end: "\\s*\\{",
    beginCaptures: {
      1: {
        name: "keyword.control.helium",
      },
    },
    endCaptures: {
      0: {
        name: "punctuation.definition.block.begin.helium",
      },
    },
    patterns: [
      {
        name: "entity.name.type.class.helium",
        match: "\\b([A-Z][a-zA-Z0-9_]*)\\b",
      },
    ],
  });

  // Add user-defined types pattern (if we found any)
  if (allUserTypes.size > 0) {
    const userTypeArray = Array.from(allUserTypes);
    patterns.push({
      name: "entity.name.type.class.helium",
      match: `\\b(${userTypeArray.join("|")})\\b`,
    });
  }

  // Add BIF namespace pattern
  if (bifNamespaces.length > 0) {
    patterns.push({
      name: "support.namespace.helium",
      match: `\\b(${bifNamespaces.join("|")})(?=:)`,
    });
  }

  const tmLanguage = {
    $schema: "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
    name: "Helium DSL",
    scopeName: "source.helium-dsl",
    patterns,
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

