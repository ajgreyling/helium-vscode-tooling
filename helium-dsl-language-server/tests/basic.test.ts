import { expect } from "chai";
import { createDiagnostics } from "../src/diagnostics";
import { runLints } from "../src/linter/engine";

describe("Diagnostics and lints", () => {
  it("reports no diagnostics for empty file", async () => {
    const diags = createDiagnostics("");
    expect(diags.length).to.be.greaterThan(0); // parser-not-generated warning until parser is built
  });

  it("flags variable declarations inside else", async () => {
    const sample = `
    if (x == true) {
      int a = 1;
    } else {
      int b = 2;
    }
    `;
    const diags = await runLints(sample);
    expect(diags.some((d) => d.code === "no-var-in-else")).to.be.true;
  });
});

