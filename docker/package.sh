#!/usr/bin/env bash
set -euo pipefail

EXT_DIR=/build/extension
SERVER_OUT=/build/server-out
SERVER_NODE_MODULES=/build/server-node-modules
GENERATED=/build/generated
OUT_DIR=/build/out

# Create writable working copy of extension
WORK_DIR=/build/work
echo "Creating working copy of extension..."
rm -rf $WORK_DIR
cp -r $EXT_DIR $WORK_DIR

# Copy language server output and dependencies
echo "Copying language server files..."
mkdir -p $WORK_DIR/server/out
cp -r $SERVER_OUT/* $WORK_DIR/server/out/ 2>/dev/null || true

echo "Checking for language server dependencies..."
if [ -d "$SERVER_NODE_MODULES" ] && [ "$(ls -A $SERVER_NODE_MODULES 2>/dev/null)" ]; then
  echo "Copying language server dependencies..."
  mkdir -p $WORK_DIR/server/node_modules
  cp -r $SERVER_NODE_MODULES/* $WORK_DIR/server/node_modules/
  echo "  ✓ Language server dependencies copied"
else
  echo "  ⚠ Warning: Language server node_modules not found or empty"
  echo "  This may cause the language server to fail to start"
fi

# Copy generated files
if [ -d "$GENERATED" ] && [ "$(ls -A $GENERATED 2>/dev/null)" ]; then
  echo "Copying generated files..."
  cp -r $GENERATED $WORK_DIR/
fi

cd $WORK_DIR

echo "Installing production dependencies..."
npm install --production --no-audit --no-fund

# Move nested dependencies to root node_modules (vsce doesn't follow nested node_modules)
echo "Moving nested dependencies to root node_modules..."
if [ -d "node_modules/vscode-languageclient/node_modules" ]; then
  for dep in node_modules/vscode-languageclient/node_modules/*; do
    if [ -d "$dep" ] && [ -e "$dep" ]; then
      dep_name=$(basename "$dep")
      # Skip if it's the parent package itself or already exists at root
      if [ "$dep_name" != "vscode-languageclient" ] && [ ! -d "node_modules/$dep_name" ]; then
        echo "  Moving $dep_name to root..."
        mv "$dep" "node_modules/$dep_name" 2>/dev/null || cp -r "$dep" "node_modules/$dep_name" && rm -rf "$dep"
      fi
    fi
  done
  # Remove empty nested node_modules directory if it exists
  rmdir node_modules/vscode-languageclient/node_modules 2>/dev/null || true
fi

# Remove all remaining nested node_modules to prevent duplicate file errors
echo "Removing remaining nested node_modules..."
find node_modules -type d -name node_modules ! -path "node_modules" -exec rm -rf {} + 2>/dev/null || true

echo "Validating dependency tree..."
npm list --production

echo "Packaging VSIX..."
vsce package --out $OUT_DIR/helium-dsl.vsix --no-yarn --allow-missing-repository

echo "VSIX created:"
ls -lh $OUT_DIR

