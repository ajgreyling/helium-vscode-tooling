import path from "node:path";
import fs from "fs-extra";

const root = path.resolve(__dirname, "..");
const source = path.join(root, "generated/grammar/MezDSL.g3");
const target = path.join(root, "generated/grammar/MezDSL.g4");

async function convert() {
  const content = await fs.readFile(source, "utf8");

  // Basic automated transformations to get closer to ANTLR4.
  let converted = content;

  // Remove ANTLR3 options not supported in ANTLR4.
  converted = converted.replace(/options\s*\{[^}]*output=AST;[^}]*\};?/g, "");
  converted = converted.replace(/ASTLabelType\s*=\s*CommonTree;?/g, "");
  converted = converted.replace(/superClass\s*=\s*MezBasicParser;?/g, "");

  // Fix tokens {} syntax: ANTLR3 uses semicolons, ANTLR4 uses commas
  converted = converted.replace(/tokens\s*\{([^}]*)\}/g, (match, content) => {
    const tokens = content.replace(/;/g, ",");
    return `tokens {${tokens}}`;
  });

  // Remove all tree rewrite operators (-> ...) and tree construction operators (^, !)
  // These need to be removed line by line to handle multi-line rules
  // Be careful not to remove ! that's part of token literals like '!='
  const lines = converted.split('\n');
  const processedLines = lines.map(line => {
    // Remove tree rewrite operators (-> ...)
    let processed = line.replace(/\s*->\s*[^;]*/g, '');
    // Remove tree root operators (^)
    processed = processed.replace(/\^/g, '');
    // Remove tree ignore operators (!) but NOT when it's part of a token literal like '!='
    // Check if line contains token definitions with '!=' and preserve them
    if (line.includes("'!='") || line.includes('"!="')) {
      // Preserve != in token literals, only remove standalone ! operators
      // Remove ! that's not followed by = and not inside quotes
      let result = '';
      let inString = false;
      let stringChar = '';
      for (let i = 0; i < processed.length; i++) {
        const char = processed[i];
        const nextChar = i + 1 < processed.length ? processed[i + 1] : '';
        
        if ((char === '"' || char === "'") && (i === 0 || processed[i - 1] !== '\\')) {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
            stringChar = '';
          }
        }
        
        if (!inString && char === '!' && nextChar !== '=') {
          // Skip this ! character (it's a tree ignore operator)
          continue;
        }
        
        result += char;
      }
      processed = result;
    } else {
      // No != in this line, safe to remove all !
      processed = processed.replace(/!/g, '');
    }
    return processed;
  });
  converted = processedLines.join('\n');

  // Remove semantic predicates and actions that reference AST ($tree, $start, etc.)
  converted = converted.replace(/\$tree/g, '');
  converted = converted.replace(/\$start/g, '');
  
  // Remove embedded actions in curly braces containing token() calls
  // This needs to handle nested braces and quoted strings properly
  // Do this line by line to avoid matching across rules
  const tokenLines = converted.split('\n');
  converted = tokenLines.map(line => {
    let result = line;
    // Find all occurrences of { followed by token( and remove the entire action block
    // We need to match balanced braces to handle nested structures
    let pos = 0;
    while (pos < result.length) {
      const openBrace = result.indexOf('{', pos);
      if (openBrace === -1) break;
      
      // Check if this brace is part of a string literal (preceded by a quote)
      if (openBrace > 0 && result[openBrace - 1] === "'") {
        pos = openBrace + 1;
        continue;
      }
      
      // Check if this brace is followed by token(
      const afterBrace = result.substring(openBrace + 1).trim();
      if (afterBrace.startsWith('token(') || afterBrace.startsWith('{token(')) {
        // Find the matching closing brace
        let depth = 1;
        let i = openBrace + 1;
        let inString = false;
        let stringChar = '';
        let escapeNext = false;
        
        while (i < result.length && depth > 0) {
          const char = result[i];
          if (escapeNext) {
            escapeNext = false;
            i++;
            continue;
          }
          if (char === '\\') {
            escapeNext = true;
            i++;
            continue;
          }
          if ((char === '"' || char === "'") && !inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar && inString) {
            inString = false;
            stringChar = '';
          }
          if (!inString) {
            if (char === '{') depth++;
            if (char === '}') depth--;
          }
          i++;
        }
        
        if (depth === 0) {
          // Found matching brace, remove the entire action
          result = result.substring(0, openBrace) + result.substring(i);
          pos = openBrace; // Check again at this position
          continue;
        }
      }
      pos = openBrace + 1;
    }
    return result;
  }).join('\n');

  // Remove greedy options and convert wildcard .* to non-greedy .*?
  converted = converted.replace(/options\s*\{\s*greedy\s*=\s*false\s*;\s*\}\s*:\s*\.\s*\)/g, '.*?)');
  converted = converted.replace(/options\s*\{\s*greedy\s*=\s*false\s*;\s*\}\s*:\s*/g, '');

  // Replace $channel=HIDDEN with -> channel(HIDDEN) for ANTLR4
  converted = converted.replace(/\{\s*\$channel\s*=\s*HIDDEN\s*;\s*\}/g, '-> channel(HIDDEN)');

  // Fix multi-character literals in lexer sets: '\r\n' should be removed since it's redundant
  // ('\r' | '\n' | '\r\n') is the same as ('\r' | '\n')
  converted = converted.replace(/~\('\\r'\s*\|\s*'\\n'\s*\|\s*'\\r\\n'\)/g, "~('\\r' | '\\n')");

  // Remove @header sections entirely (they're Java-specific)
  converted = converted.replace(
    /@header\s*\{[^}]*\}\s*/g,
    ""
  );
  converted = converted.replace(
    /@lexer::header\s*\{[^}]*\}\s*/g,
    ""
  );
  converted = converted.replace(
    /@parser::header\s*\{[^}]*\}\s*/g,
    ""
  );

  // Fix NEQU token if it was corrupted (should be '!=' not '=')
  converted = converted.replace(/NEQU\s*:\s*'='\s*;/g, "NEQU       : '!=';");

  await fs.writeFile(target, converted, "utf8");
  console.log(`Converted grammar written to ${target}`);
}

convert().catch((err) => {
  console.error(err);
  process.exit(1);
});

