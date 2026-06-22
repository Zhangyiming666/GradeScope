/**
 * Tauri 桌面版的文件读写封装。
 * 用 dialog 插件选路径、用自定义 Rust 命令（read_text_file / write_text_file）读写。
 * 仅在 Tauri 环境下调用（调用前请先用 isTauri() 判断）。
 */
import { invoke } from '@tauri-apps/api/core'
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog'

const FILE_FILTERS = [{ name: 'GradeScope 数据文件', extensions: ['gradepilot.json', 'json'] }]

/** 取路径里的文件名（兼容 / 和 \\ 分隔符）。 */
export function basename(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}

/** 弹出"打开文件"对话框，返回选中的绝对路径；用户取消返回 null。 */
export async function pickOpenPath(): Promise<string | null> {
  const selected = await openDialog({ multiple: false, directory: false, filters: FILE_FILTERS })
  if (typeof selected === 'string') {
    return selected
  }
  return null
}

/** 弹出"另存为"对话框，返回选择的绝对路径；用户取消返回 null。 */
export async function pickSavePath(suggestedName = 'gradepilot.gradepilot.json'): Promise<string | null> {
  const selected = await saveDialog({ defaultPath: suggestedName, filters: FILE_FILTERS })
  return selected ?? null
}

export async function readTextFile(path: string): Promise<string> {
  return invoke<string>('read_text_file', { path })
}

export async function writeTextFile(path: string, contents: string): Promise<void> {
  await invoke('write_text_file', { path, contents })
}

export async function fileExists(path: string): Promise<boolean> {
  return invoke<boolean>('file_exists', { path })
}
