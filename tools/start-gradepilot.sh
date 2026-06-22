#!/bin/zsh
set -euo pipefail

PROJECT_DIR="/Users/azhangyiming666/Downloads/Gradepilot"
NODE_BIN="/Users/azhangyiming666/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
PNPM_BIN="/Users/azhangyiming666/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/pnpm"
NODE_BIN_FULL="/Users/azhangyiming666/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
SERVER_BIN="${PROJECT_DIR}/tools/serve-gradepilot.mjs"
HOST="127.0.0.1"
PORT="${GRADEPILOT_PORT:-5173}"
URL="http://${HOST}:${PORT}/"
LOG_DIR="${HOME}/Library/Logs/GradeScope"
PID_FILE="${LOG_DIR}/dev-server.pid"
LOG_FILE="${LOG_DIR}/dev-server.log"

mkdir -p "${LOG_DIR}"
cd "${PROJECT_DIR}"

is_port_open() {
  /usr/bin/nc -z "${HOST}" "${PORT}" >/dev/null 2>&1
}

open_gradepilot() {
  if [[ "${GRADEPILOT_OPEN:-1}" != "0" ]]; then
    /usr/bin/open "${URL}"
  fi
}

notify_failure() {
  local message="$1"
  if [[ "${GRADEPILOT_OPEN:-1}" != "0" ]]; then
    /usr/bin/open "${LOG_FILE}" 2>/dev/null || true
    /usr/bin/osascript -e "display dialog \"${message}\" buttons {\"OK\"} default button \"OK\" with title \"GradeScope\""
  fi
}

if is_port_open; then
  open_gradepilot
  exit 0
fi

if [[ -f "${PID_FILE}" ]] && ! /bin/kill -0 "$(/bin/cat "${PID_FILE}")" 2>/dev/null; then
  /bin/rm -f "${PID_FILE}"
fi

if [[ -f "${PID_FILE}" ]] && /bin/kill -0 "$(/bin/cat "${PID_FILE}")" 2>/dev/null; then
  open_gradepilot
  exit 0
fi

export PATH="${NODE_BIN}:${PATH}"

if [[ -f "${PROJECT_DIR}/dist/index.html" && -f "${SERVER_BIN}" ]]; then
  /usr/bin/nohup "${NODE_BIN_FULL}" "${SERVER_BIN}" "${PROJECT_DIR}/dist" "${HOST}" "${PORT}" </dev/null >"${LOG_FILE}" 2>&1 &
else
  /usr/bin/nohup "${PNPM_BIN}" exec vite --host "${HOST}" --port "${PORT}" </dev/null >"${LOG_FILE}" 2>&1 &
fi
echo "$!" >"${PID_FILE}"

for _ in {1..60}; do
  if is_port_open; then
    open_gradepilot
    exit 0
  fi
  /bin/sleep 0.25
done

notify_failure "GradeScope 启动超时，请查看日志：${LOG_FILE}"
exit 1
