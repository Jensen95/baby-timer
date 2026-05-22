#!/usr/bin/env bash
set -euo pipefail

# Read the tool input JSON from stdin
INPUT=$(cat)

# Extract the file path - handle both Edit (file_path) and Write (file_path) tool inputs
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
# Try different field names used by different tools
for key in ['file_path', 'path']:
    if key in data:
        print(data[key])
        break
" 2>/dev/null || echo "")

# Skip if no file path found or file doesn't exist
if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# Only process JS/TS/Svelte/CSS/SCSS/JSON/MD files
case "$FILE_PATH" in
  *.js|*.ts|*.svelte|*.css|*.scss|*.json|*.md)
    ;;
  *)
    exit 0
    ;;
esac

# Run prettier (format in place, silent)
npx prettier --write "$FILE_PATH" 2>/dev/null || true

# Run eslint fix only on JS/TS/Svelte files
case "$FILE_PATH" in
  *.js|*.ts|*.svelte)
    npx eslint --fix "$FILE_PATH" 2>/dev/null || true
    ;;
esac
