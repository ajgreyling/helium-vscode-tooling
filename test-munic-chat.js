#!/usr/bin/env node

/**
 * Test script to run the Helium DSL linter against munic-chat codebase
 */

const fs = require('fs');
const path = require('path');
const { parseDocument, validateDocument } = require('./helium-dsl-language-server/src/parser/index.ts');
const { loadRules } = require('./helium-dsl-language-server/src/linter/ruleLoader.ts');
const { LinterEngine } = require('./helium-dsl-language-server/src/linter/engine.ts');

// Paths
const MUNIC_CHAT_ROOT = '/Users/ajgreyling/code/munic-chat';
const FOLDERS_TO_SCAN = ['model', 'services', 'utilities', 'web-app/presenters'];

// Find all .mez files
function findMezFiles(baseDir) {
    const mezFiles = [];
    
    function scanDir(dir) {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                scanDir(fullPath);
            } else if (item.endsWith('.mez')) {
                mezFiles.push(fullPath);
            }
        }
    }
    
    for (const folder of FOLDERS_TO_SCAN) {
        const fullPath = path.join(baseDir, folder);
        if (fs.existsSync(fullPath)) {
            scanDir(fullPath);
        }
    }
    
    return mezFiles;
}

async function main() {
    console.log('🔍 Testing Helium DSL Linter against munic-chat codebase\n');
    console.log(`Scanning folders: ${FOLDERS_TO_SCAN.join(', ')}\n`);
    
    // Find all .mez files
    const mezFiles = findMezFiles(MUNIC_CHAT_ROOT);
    console.log(`Found ${mezFiles.length} .mez files\n`);
    
    // Load linter rules
    const rules = await loadRules();
    const linter = new LinterEngine(rules);
    
    // Statistics
    let totalFiles = 0;
    let filesWithIssues = 0;
    let totalIssues = 0;
    const issuesByRule = {};
    const fileIssues = [];
    
    // Process each file
    for (const filePath of mezFiles) {
        totalFiles++;
        const relPath = path.relative(MUNIC_CHAT_ROOT, filePath);
        
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            
            // Parse and validate
            const parseResult = parseDocument(content, filePath);
            const diagnostics = validateDocument(parseResult, linter);
            
            if (diagnostics.length > 0) {
                filesWithIssues++;
                totalIssues += diagnostics.length;
                
                fileIssues.push({
                    file: relPath,
                    issues: diagnostics
                });
                
                // Count by rule
                for (const diag of diagnostics) {
                    const rule = diag.source || 'unknown';
                    issuesByRule[rule] = (issuesByRule[rule] || 0) + 1;
                }
            }
        } catch (error) {
            console.error(`❌ Error processing ${relPath}: ${error.message}`);
        }
    }
    
    // Print results
    console.log('\n' + '='.repeat(80));
    console.log('RESULTS');
    console.log('='.repeat(80) + '\n');
    
    console.log(`📊 Summary:`);
    console.log(`  Total files scanned: ${totalFiles}`);
    console.log(`  Files with issues: ${filesWithIssues}`);
    console.log(`  Total issues found: ${totalIssues}\n`);
    
    if (totalIssues > 0) {
        console.log(`📋 Issues by rule:`);
        for (const [rule, count] of Object.entries(issuesByRule).sort((a, b) => b[1] - a[1])) {
            console.log(`  ${rule}: ${count}`);
        }
        console.log();
        
        // Show detailed issues
        console.log(`📝 Detailed issues:\n`);
        for (const { file, issues } of fileIssues) {
            console.log(`\n${file}:`);
            for (const issue of issues) {
                const severity = issue.severity === 1 ? '❗' : issue.severity === 2 ? '⚠️' : 'ℹ️';
                const line = issue.range ? issue.range.start.line + 1 : '?';
                console.log(`  ${severity} Line ${line}: ${issue.message} [${issue.source}]`);
            }
        }
    } else {
        console.log('✅ No issues found! All files conform to Helium DSL rules.');
    }
    
    console.log('\n' + '='.repeat(80));
}

main().catch(console.error);

