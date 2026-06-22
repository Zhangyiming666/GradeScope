# GradeScope 桌面版打包说明（Tauri）

GradeScope 现在可以打包成原生桌面应用：

- **macOS**：`.app` + `.dmg`
- **Windows**：`.exe`（NSIS 安装包）/ `.msi`

应用是纯前端（数据存在本机浏览器引擎的 IndexedDB 中），打包后的桌面版**完全离线、不依赖 Node**。

---

## 一、本地构建 Mac 版

### 依赖（一次性）
- **Node + pnpm**：本项目使用的 node/pnpm 来自 codex 运行时缓存：
  - node: `~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`
  - pnpm: `~/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin`
- **Rust 工具链**：已通过 rustup 安装在 `~/.cargo`（删除该目录即可完全卸载，不影响其他东西）。
- **Xcode Command Line Tools**：已安装。

### 构建命令
```bash
# 把 node / pnpm / cargo 加入 PATH
export PATH="$HOME/.cargo/bin:$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:$PATH"

cd ~/Downloads/Gradepilot

# 只打 macOS 产物（app + dmg）
pnpm exec tauri build --bundles app,dmg
```

构建产物位置：
- App：`src-tauri/target/release/bundle/macos/GradeScope.app`
- DMG：`src-tauri/target/release/bundle/dmg/GradeScope_1.0.1_aarch64.dmg`

> 注意：本机是 Apple Silicon (arm64)，本地打出的就是 arm64 版。要打 Intel 版需要 `rustup target add x86_64-apple-darwin` 后加 `--target x86_64-apple-darwin`。

### 开发调试（热重载）
```bash
pnpm exec tauri dev
```

---

## 二、Windows 版怎么来

**Tauri 不能在 Mac 上交叉编译出 Windows 安装包**，有两条路：

### 方案 A：用 GitHub Actions 自动打（推荐）
仓库里已经配好 [.github/workflows/build.yml](.github/workflows/build.yml)。

1. 把项目推到 GitHub。
2. 打一个 tag 触发构建并自动发 Release：
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
3. Actions 会在 Windows 和 macOS 机器上分别构建安装包，产物自动上传到一个 **Release**（Windows 下 `.exe`，macOS 下 `.dmg`）。
4. 也可以在 GitHub 的 **Actions 页面手动触发**（workflow_dispatch），产物作为 Artifact 下载；手动触发不会自动创建 Release。

### 方案 B：在一台 Windows 机器上本地打
在 Windows 上装好 Node + pnpm + Rust（rustup）+ Microsoft C++ Build Tools (含 WebView2)，然后：
```powershell
pnpm install
pnpm exec tauri build --bundles nsis
```
产物在 `src-tauri\target\release\bundle\nsis\`。

---

## 三、换图标

当前图标是脚本生成的占位图（靛蓝底 + 成绩条形图）。要换成自己的：
1. 准备一张 1024x1024 的 PNG。
2. 运行：`pnpm exec tauri icon path/to/your-icon.png`
   会自动生成所有平台所需尺寸到 `src-tauri/icons/`。

---

## 四、签名 / 公证（可选）

- 现在打出来的 Mac App **未签名**：别人下载后首次打开会被 Gatekeeper 拦，需要右键「打开」→ 确认，或在「系统设置 → 隐私与安全性」里放行。
- Windows 未签名：SmartScreen 会提示「未知发布者」，点「仍要运行」即可。
- 要去掉这些提示需要 Apple Developer 证书（公证）和 Windows 代码签名证书，属于付费项，按需再加。
