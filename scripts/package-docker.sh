#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo "Helium DSL VSIX Packaging (Docker-based)"
echo "=========================================="
echo ""

# Step 1: Build language server
echo "Step 1: Building language server..."
LANGUAGE_SERVER_DIR="$WORKSPACE_ROOT/../helium-dsl-language-server"
if [ ! -d "$LANGUAGE_SERVER_DIR" ]; then
  echo "  ✗ Error: Language server directory not found at $LANGUAGE_SERVER_DIR"
  exit 1
fi
cd "$LANGUAGE_SERVER_DIR"
# Install dependencies locally (not via workspace) to ensure they're in the language server directory
if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
  echo "  Installing language server dependencies..."
  npm install
fi
echo "  Building language server..."
npm run build
echo "  Verifying language server dependencies..."
if [ -d "node_modules" ] && [ -n "$(ls -A node_modules 2>/dev/null)" ]; then
  echo "  ✓ Language server dependencies present ($(ls node_modules | wc -l | tr -d ' ') packages)"
else
  echo "  ✗ Error: Language server node_modules missing or empty"
  exit 1
fi
echo "  ✓ Language server built"
echo ""

# Step 2: Build extension
echo "Step 2: Building extension..."
cd "$WORKSPACE_ROOT/helium-dsl-vscode"
if [ ! -d "node_modules" ]; then
  echo "  Installing extension dependencies..."
  npm install
fi
echo "  Building extension..."
npm run build
echo "  ✓ Extension built"
echo ""

# Step 3: Package VSIX using Docker
echo "Step 3: Packaging VSIX using Docker..."
cd "$WORKSPACE_ROOT"
docker compose run --rm vsix
echo ""

# Step 4: Verify output
VSIX_FILE="$WORKSPACE_ROOT/dist/helium-dsl.vsix"
if [ -f "$VSIX_FILE" ]; then
  VSIX_SIZE=$(ls -lh "$VSIX_FILE" | awk '{print $5}')
  echo "=========================================="
  echo "✓ VSIX packaging complete!"
  echo "  Location: $VSIX_FILE"
  echo "  Size: $VSIX_SIZE"
  echo "=========================================="
else
  echo "✗ Error: VSIX file not found at $VSIX_FILE"
  exit 1
fi



