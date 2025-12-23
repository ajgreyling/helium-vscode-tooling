"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const index_1 = require("../src/parser/index");
const engine_1 = require("../src/linter/engine");
describe('Munic-Chat Codebase Validation', () => {
    const MUNIC_CHAT_ROOT = '/Users/ajgreyling/code/munic-chat';
    const FOLDERS_TO_SCAN = ['model', 'services', 'utilities', 'web-app/presenters'];
    function findMezFiles(baseDir) {
        const mezFiles = [];
        function scanDir(dir) {
            if (!fs.existsSync(dir))
                return;
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    scanDir(fullPath);
                }
                else if (item.endsWith('.mez') && !item.includes('!')) {
                    mezFiles.push(fullPath);
                }
            }
        }
        for (const folder of FOLDERS_TO_SCAN) {
            const fullPath = path.join(baseDir, folder);
            scanDir(fullPath);
        }
        return mezFiles;
    }
    it('should validate all .mez files in munic-chat', async () => {
        const mezFiles = findMezFiles(MUNIC_CHAT_ROOT);
        console.log(`\n  Found ${mezFiles.length} .mez files to validate`);
        let totalIssues = 0;
        const issuesByFile = {};
        const issuesByRule = {};
        for (const filePath of mezFiles) {
            const relPath = path.relative(MUNIC_CHAT_ROOT, filePath);
            const content = fs.readFileSync(filePath, 'utf-8');
            try {
                const parseResult = (0, index_1.parseText)(content);
                const lintDiagnostics = await (0, engine_1.runLints)(content);
                const diagnostics = [...parseResult.diagnostics, ...lintDiagnostics];
                if (diagnostics.length > 0) {
                    issuesByFile[relPath] = diagnostics;
                    totalIssues += diagnostics.length;
                    for (const diag of diagnostics) {
                        const rule = diag.source || 'unknown';
                        issuesByRule[rule] = (issuesByRule[rule] || 0) + 1;
                    }
                }
            }
            catch (error) {
                console.log(`    ⚠️  ${relPath}: ${error.message}`);
            }
        }
        // Print summary
        console.log(`\n  📊 Summary:`);
        console.log(`    Files scanned: ${mezFiles.length}`);
        console.log(`    Files with issues: ${Object.keys(issuesByFile).length}`);
        console.log(`    Total issues: ${totalIssues}`);
        if (totalIssues > 0) {
            console.log(`\n  📋 Issues by rule:`);
            for (const [rule, count] of Object.entries(issuesByRule).sort((a, b) => b[1] - a[1])) {
                console.log(`    ${rule}: ${count}`);
            }
            console.log(`\n  📝 Files with issues:`);
            for (const [file, issues] of Object.entries(issuesByFile)) {
                console.log(`\n    ${file}:`);
                for (const issue of issues.slice(0, 5)) { // Show first 5 per file
                    const line = issue.range?.start.line ?? 0;
                    console.log(`      Line ${line + 1}: ${issue.message}`);
                }
                if (issues.length > 5) {
                    console.log(`      ... and ${issues.length - 5} more`);
                }
            }
        }
        // This test is informational - we're checking known-good code
        // We expect some warnings but no critical errors
        const errors = Object.values(issuesByFile)
            .flat()
            .filter((d) => d.severity === 1); // 1 = Error
        console.log(`\n  ${errors.length === 0 ? '✅' : '❌'} ${errors.length} errors found`);
        // For now, we just want to see what the linter finds
        // Don't fail the test - this is for validation purposes
        (0, chai_1.expect)(mezFiles.length).to.be.greaterThan(0, 'Should find .mez files');
    });
    it('should not flag variables in else blocks in ConversationService', async () => {
        const filePath = path.join(MUNIC_CHAT_ROOT, 'services/ConversationService.mez');
        if (!fs.existsSync(filePath)) {
            console.log('    Skipping - file not found');
            return;
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        const parseResult = (0, index_1.parseText)(content);
        const lintDiagnostics = await (0, engine_1.runLints)(content);
        const diagnostics = [...parseResult.diagnostics, ...lintDiagnostics];
        const varInElseIssues = diagnostics.filter(d => d.source === 'no-var-in-else');
        console.log(`    Found ${varInElseIssues.length} variable-in-else violations`);
        if (varInElseIssues.length > 0) {
            console.log(`    Issues found:`);
            for (const issue of varInElseIssues) {
                const line = issue.range?.start.line ?? 0;
                console.log(`      Line ${line + 1}: ${issue.message}`);
            }
        }
        // Known good code should not have this violation
        (0, chai_1.expect)(varInElseIssues).to.have.lengthOf(0, 'Should not declare variables in else blocks');
    });
});
