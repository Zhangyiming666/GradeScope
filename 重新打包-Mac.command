#!/bin/zsh
# GradeScope 一键重新打包 Mac 版
# 用法：双击本文件，或在终端运行  ./重新打包-Mac.command
# 每次更新代码后跑这个就行，会自动重新构建前端 + 打出新的 .app 和 .dmg

set -euo pipefail

PROJECT_DIR="/Users/azhangyiming666/Downloads/Gradepilot"
CODEX_DEP="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies"

# 把 node / pnpm / cargo 加进 PATH
export PATH="$HOME/.cargo/bin:$CODEX_DEP/node/bin:$CODEX_DEP/bin:$PATH"

cd "$PROJECT_DIR"

echo "==> 检查环境"
node --version >/dev/null 2>&1 || { echo "❌ 找不到 node"; exit 1; }
pnpm --version >/dev/null 2>&1 || { echo "❌ 找不到 pnpm"; exit 1; }
cargo --version >/dev/null 2>&1 || { echo "❌ 找不到 cargo（Rust），请先安装"; exit 1; }
echo "    node $(node --version) / pnpm $(pnpm --version) / $(cargo --version)"

echo "==> 安装/更新依赖（如有变动）"
pnpm install

echo "==> 构建桌面 App（前端会自动重新 build）"
pnpm exec tauri build --bundles app,dmg

echo ""
echo "✅ 完成！新产物在："
echo "   App: $PROJECT_DIR/src-tauri/target/release/bundle/macos/GradeScope.app"
echo "   DMG: $PROJECT_DIR/src-tauri/target/release/bundle/dmg/"
echo ""

# 顺手把产物复制到好找的文件夹
OUT="$PROJECT_DIR/构建产物-Mac版"
mkdir -p "$OUT"
rm -rf "$OUT/GradeScope.app"
cp -R "$PROJECT_DIR/src-tauri/target/release/bundle/macos/GradeScope.app" "$OUT/"
cp -f "$PROJECT_DIR"/src-tauri/target/release/bundle/dmg/*.dmg "$OUT/" 2>/dev/null || true
echo "📦 已复制到：$OUT"

# 双击运行时，结束后停留，方便看输出
if [[ -t 0 ]]; then
  echo ""
  read "?按回车键关闭…"
fi
