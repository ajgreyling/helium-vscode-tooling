import * as fs from "fs";
import * as path from "path";
import { URI } from "vscode-uri";
import { Location } from "vscode-languageserver";

export interface ObjectDefinition {
  name: string;
  uri: string;
  line: number;
  character: number;
  isPersistent: boolean;
}

export class WorkspaceIndex {
  private objectDefinitions: Map<string, ObjectDefinition> = new Map();
  private workspaceRoots: string[] = [];

  /**
   * Initialize the workspace index by scanning workspace folders
   */
  initialize(workspaceFolders: { uri: string; name?: string }[] | null): void {
    console.log("[WorkspaceIndex] Initializing workspace index...");
    this.workspaceRoots = (workspaceFolders || []).map((folder) => {
      const uri = URI.parse(folder.uri);
      console.log(`[WorkspaceIndex] Workspace folder: ${folder.name || "unnamed"} -> ${uri.fsPath}`);
      return uri.fsPath;
    });
    if (this.workspaceRoots.length === 0) {
      console.log("[WorkspaceIndex] WARNING: No workspace folders found!");
    }
    this.scanWorkspace();
    console.log(`[WorkspaceIndex] Index initialized. Found ${this.objectDefinitions.size} object definitions:`, Array.from(this.objectDefinitions.keys()));
  }

  /**
   * Scan all .mez files in model directories to find object definitions
   */
  private scanWorkspace(): void {
    this.objectDefinitions.clear();

    for (const root of this.workspaceRoots) {
      this.scanDirectory(root);
    }
  }

  /**
   * Recursively scan a directory for .mez files in model folders
   */
  private scanDirectory(dir: string): void {
    try {
      if (!fs.existsSync(dir)) {
        return;
      }

      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Scan model directories and subdirectories
          if (entry.name === "model" || entry.name.startsWith(".") === false) {
            this.scanDirectory(fullPath);
          }
        } else if (entry.isFile() && entry.name.endsWith(".mez")) {
          // Check if this file is in a model directory (any level)
          if (this.isInModelDirectory(fullPath)) {
            this.scanMezFile(fullPath);
          }
        }
      }
    } catch (err) {
      // Silently ignore errors (permissions, etc.)
    }
  }

  /**
   * Check if a file path is in a model directory
   */
  private isInModelDirectory(filePath: string): boolean {
    const parts = filePath.split(path.sep);
    return parts.includes("model");
  }

  /**
   * Scan a .mez file for object definitions
   */
  private scanMezFile(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const lines = content.split(/\r?\n/);
      const uri = URI.file(filePath).toString();
      let foundInFile = 0;

      lines.forEach((line, idx) => {
        // Match persistent object definitions
        const persistentMatch = line.match(/(?:@\w+\s+)*persistent\s+object\s+([A-Z][A-Za-z0-9_]*)/);
        if (persistentMatch) {
          const objectName = persistentMatch[1];
          this.objectDefinitions.set(objectName, {
            name: objectName,
            uri,
            line: idx,
            character: persistentMatch.index ?? 0,
            isPersistent: true,
          });
          foundInFile++;
          console.log(`[WorkspaceIndex] Found persistent object: ${objectName} in ${filePath} at line ${idx + 1}`);
          return;
        }

        // Match non-persistent object definitions (only if not already found as persistent)
        const objectMatch = line.match(/(?:@\w+\s+)*object\s+([A-Z][A-Za-z0-9_]*)/);
        if (objectMatch && !this.objectDefinitions.has(objectMatch[1])) {
          const objectName = objectMatch[1];
          this.objectDefinitions.set(objectName, {
            name: objectName,
            uri,
            line: idx,
            character: objectMatch.index ?? 0,
            isPersistent: false,
          });
          foundInFile++;
          console.log(`[WorkspaceIndex] Found object: ${objectName} in ${filePath} at line ${idx + 1}`);
        }
      });
      
      if (foundInFile === 0 && this.isInModelDirectory(filePath)) {
        console.log(`[WorkspaceIndex] Scanned model file but found no objects: ${filePath}`);
      }
    } catch (err) {
      console.error(`[WorkspaceIndex] Error scanning file ${filePath}:`, err);
    }
  }

  /**
   * Find the definition location for an object type
   */
  findObjectDefinition(typeName: string): ObjectDefinition | undefined {
    return this.objectDefinitions.get(typeName);
  }

  /**
   * Get location for an object definition
   */
  getObjectLocation(typeName: string): Location | null {
    const definition = this.findObjectDefinition(typeName);
    if (!definition) {
      return null;
    }

    return {
      uri: definition.uri,
      range: {
        start: { line: definition.line, character: definition.character },
        end: { line: definition.line, character: definition.character + definition.name.length },
      },
    };
  }

  /**
   * Update the index when a file changes
   */
  updateFile(uri: string): void {
    const filePath = URI.parse(uri).fsPath;
    console.log(`[WorkspaceIndex] updateFile called for: ${uri} (${filePath})`);
    if (filePath.endsWith(".mez") && this.isInModelDirectory(filePath)) {
      console.log(`[WorkspaceIndex] Updating model file: ${filePath}`);
      // Remove old definitions from this file
      const removed: string[] = [];
      for (const [name, def] of this.objectDefinitions.entries()) {
        if (def.uri === uri) {
          this.objectDefinitions.delete(name);
          removed.push(name);
        }
      }
      if (removed.length > 0) {
        console.log(`[WorkspaceIndex] Removed ${removed.length} old definitions:`, removed);
      }
      // Re-scan the file
      this.scanMezFile(filePath);
    } else {
      console.log(`[WorkspaceIndex] File not a model .mez file, skipping update`);
    }
  }
  
  /**
   * Get debug information about the index
   */
  getDebugInfo(): { objectCount: number; objects: string[]; workspaceRoots: string[] } {
    return {
      objectCount: this.objectDefinitions.size,
      objects: Array.from(this.objectDefinitions.keys()),
      workspaceRoots: this.workspaceRoots,
    };
  }

  /**
   * Check if a type name is a user-defined object (not a system type)
   */
  isUserDefinedType(typeName: string): boolean {
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
    const isSystemType = systemTypes.includes(typeName.toLowerCase());
    const isInIndex = this.objectDefinitions.has(typeName);
    console.log(`[WorkspaceIndex] Checking type "${typeName}": isSystemType=${isSystemType}, isInIndex=${isInIndex}, result=${!isSystemType && isInIndex}`);
    if (isInIndex) {
      const def = this.objectDefinitions.get(typeName);
      if (def) {
        console.log(`[WorkspaceIndex] Definition found: ${def.name} at ${def.uri}:${def.line + 1}`);
      }
    }
    return !isSystemType && isInIndex;
  }
}


