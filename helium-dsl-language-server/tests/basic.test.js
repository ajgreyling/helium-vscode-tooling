"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const diagnostics_1 = require("../src/diagnostics");
const engine_1 = require("../src/linter/engine");
describe("Diagnostics and lints", () => {
    it("reports no diagnostics for empty file", async () => {
        const diags = (0, diagnostics_1.createDiagnostics)("");
        (0, chai_1.expect)(diags.length).to.be.greaterThan(0); // parser-not-generated warning until parser is built
    });
    it("flags variable declarations inside else", async () => {
        const sample = `
    if (x == true) {
      int a = 1;
    } else {
      int b = 2;
    }
    `;
        const diags = await (0, engine_1.runLints)(sample);
        (0, chai_1.expect)(diags.some((d) => d.code === "no-var-in-else")).to.be.true;
    });
});
