#!/bin/zsh
set -euo pipefail

PROJECT_DIR="/Users/azhangyiming666/Downloads/Gradepilot"
NODE_BIN="/Users/azhangyiming666/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
SERVER_BIN="$PROJECT_DIR/tools/serve-gradepilot.mjs"
LOG_FILE="$PROJECT_DIR/.gradepilot-server.log"

cd "$PROJECT_DIR"
exec "$NODE_BIN" "$SERVER_BIN" "$PROJECT_DIR/dist" "127.0.0.1" "5173" >> "$LOG_FILE" 2>&1
