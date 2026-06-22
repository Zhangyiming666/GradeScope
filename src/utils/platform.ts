/**
 * 判断当前是否运行在 Tauri 打包的桌面 App 中（而非普通浏览器）。
 * Tauri v2 会在 window 上注入 __TAURI_INTERNALS__ / isTauri 标记。
 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  const w = window as unknown as {
    __TAURI_INTERNALS__?: unknown
    __TAURI__?: unknown
    isTauri?: boolean
  }
  return Boolean(w.__TAURI_INTERNALS__ ?? w.__TAURI__ ?? w.isTauri)
}
