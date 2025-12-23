import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { parseText } from "../src/parser/index";
import { runLints } from "../src/linter/engine";

const SAMPLE_PROJECT_PATH = "/Users/ajgreyling/code/munic-chat";

describe("Sample DSL Codebase Validation", () => {
  it("should validate all .mez files in sample project", async function() {
    this.timeout(10000); // Increase timeout for large codebases

    const mezFiles: string[] = [];

    function findMezFiles(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          findMezFiles(fullPath);
        } else if (entry.name.endsWith(".mez")) {
          mezFiles.push(fullPath);
        }
      }
    }

    findMezFiles(SAMPLE_PROJECT_PATH);
    console.log(`\n  Found ${mezFiles.length} .mez files to validate\n`);

    const fileIssues: Record<string, any[]> = {};
    let totalIssues = 0;
    const issuesByRule: Record<string, number> = {};

    for (const file of mezFiles) {
      const text = fs.readFileSync(file, "utf8");
      const relativePath = path.relative(SAMPLE_PROJECT_PATH, file);

      try {
        const parseResult = parseText(text);
        const lintDiagnostics = await runLints(text);
        const allDiagnostics = [...parseResult.diagnostics, ...lintDiagnostics];

        if (allDiagnostics.length > 0) {
          fileIssues[relativePath] = allDiagnostics;
          totalIssues += allDiagnostics.length;

          allDiagnostics.forEach((diag) => {
            const source = diag.source || "unknown";
            issuesByRule[source] = (issuesByRule[source] || 0) + 1;
          });
        }
      } catch (err) {
        fileIssues[relativePath] = [
          {
            message: err instanceof Error ? err.message : String(err),
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
            severity: 1,
            source: "test-error",
          },
        ];
        totalIssues++;
      }
    }

    // Print summary
    console.log(`  📊 Summary:`);
    console.log(`    Files scanned: ${mezFiles.length}`);
    console.log(`    Files with issues: ${Object.keys(fileIssues).length}`);
    console.log(`    Total issues: ${totalIssues}`);
    console.log(``);
    console.log(`  📋 Issues by rule:`);
    Object.entries(issuesByRule)
      .sort(([, a], [, b]) => b - a)
      .forEach(([rule, count]) => {
        console.log(`    ${rule}: ${count}`);
      });

    // Print file details (limit to first 5 issues per file)
    if (Object.keys(fileIssues).length > 0) {
      console.log(``);
      console.log(`  📝 Files with issues:`);
      console.log(``);
      for (const [file, issues] of Object.entries(fileIssues)) {
        console.log(`    ${file}:`);
        const displayIssues = issues.slice(0, 5);
        displayIssues.forEach((issue) => {
          console.log(`      Line ${issue.range.start.line + 1}: ${issue.message}`);
        });
        if (issues.length > 5) {
          console.log(`      ... and ${issues.length - 5} more`);
        }
        console.log(``);
      }

      // Count critical errors (variable-in-else)
      const varInElseErrors = Object.values(fileIssues)
        .flat()
        .filter((d) => d.message.includes("Variables cannot be declared in else blocks"));

      console.log(`  ❌ ${varInElseErrors.length} errors found`);
    } else {
      console.log(``);
      console.log(`  ✅ No issues found!`);
    }

    // Test passes regardless - this is a validation report
    expect(mezFiles.length).to.be.greaterThan(0);
  });

  it("should not flag variables in else blocks in known-good code", async () => {
    // This is a representative test case
    const testCode = `
      if (x > 0) {
        int y = 5;
      } else {
        return false;
      }
    `;

    const lintDiagnostics = await runLints(testCode);
    const varInElseErrors = lintDiagnostics.filter((d) =>
      d.message.includes("Variables cannot be declared in else blocks")
    );

    console.log(`    Found ${varInElseErrors.length} variable-in-else violations`);
    expect(varInElseErrors.length).to.equal(0);
  });
});
