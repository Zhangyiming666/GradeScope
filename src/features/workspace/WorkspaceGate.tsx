import { Download, FolderOpen, Plus } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { PropsWithChildren } from 'react'
import { toast } from 'sonner'
import { GradeScopeMark } from '../../components/brand/GradeScopeMark'
import { isTauri } from '../../utils/platform'
import {
  createWorkspaceFile,
  loadLastWorkspaceFileIfPermitted,
  openWorkspaceFile,
  openWorkspaceFileFromUpload,
  supportsNativeWorkspaceFiles,
  useWorkspaceStore
} from './workspaceStore'

export function WorkspaceGate({ children }: PropsWithChildren) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { isReady, isLoading, setState, error } = useWorkspaceStore()
  const nativeFilesSupported = supportsNativeWorkspaceFiles()

  useEffect(() => {
    let cancelled = false
    Promise.resolve()
      .then(async () => {
        // Tauri 桌面版：尝试自动加载上次打开的文件
        if (isTauri()) {
          return loadLastWorkspaceFileIfPermitted()
        }
        return false
      })
      .then((loaded) => {
        if (!cancelled && !loaded) {
          setState({ isLoading: false })
        }
      })
      .catch((nextError: unknown) => {
        if (!cancelled) {
          setState({
            isLoading: false,
            error: nextError instanceof Error ? nextError.message : '读取上次数据文件失败'
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [setState])

  if (isReady) {
    return children
  }

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-app text-sm text-muted">正在检查工作区...</div>
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-5 py-10">
      <div className="mx-auto w-full max-w-5xl animate-fade-in-up rounded-3xl border border-line bg-white p-6 shadow-soft md:p-10">
        <div className="mx-auto max-w-2xl text-center">
          <GradeScopeMark className="mx-auto h-16 w-16" />
          <h1 className="mt-5 text-4xl font-bold text-strong">GradeScope</h1>
          <p className="mt-3 text-sm leading-6 text-muted md:text-base">
            GradeScope 是一个本地成绩管理与目标成绩反推工具。选择已有数据文件继续分析，或新建一个工作区开始记录课程、分数和 GPA。
          </p>
        </div>

        {error ? <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-danger">{error}</div> : null}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <button
            className="flex min-h-44 flex-col rounded-2xl border border-line bg-white p-6 text-left shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:border-primary hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/20"
            onClick={() => {
              if (nativeFilesSupported || isTauri()) {
                openWorkspaceFile().catch((nextError: unknown) =>
                  toast.error(nextError instanceof Error ? nextError.message : '打开数据文件失败')
                )
              } else {
                inputRef.current?.click()
              }
            }}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <FolderOpen className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="mt-4 font-semibold text-strong">打开数据文件</div>
            <p className="mt-2 text-sm leading-6 text-muted">
              {nativeFilesSupported || isTauri()
                ? '打开已有的 .gradepilot.json 工作区，并在编辑后保存回本地文件。'
                : '上传已有的 .gradepilot.json 工作区，保存时下载新版文件。'}
            </p>
          </button>

          <button
            className="flex min-h-44 flex-col rounded-2xl border border-line bg-white p-6 text-left shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:border-primary hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/20"
            onClick={() =>
              createWorkspaceFile().catch((nextError: unknown) =>
                toast.error(nextError instanceof Error ? nextError.message : '新建数据文件失败')
              )
            }
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Plus className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="mt-4 font-semibold text-strong">新建数据文件</div>
            <p className="mt-2 text-sm leading-6 text-muted">创建一个新的 GradeScope 工作区，从空白学期开始。</p>
          </button>
        </div>

        {!nativeFilesSupported && !isTauri() ? (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <Download className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            当前浏览器不支持直接写回文件。你仍可打开 JSON 文件，保存时会下载新版文件。
          </div>
        ) : null}

        <p className="mt-6 border-t border-line pt-5 text-center text-xs leading-6 text-muted">
          数据保存在你选择的本地 JSON 文件中；CSV 导入/导出可在成绩数据库中使用。
        </p>

        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept=".gradepilot.json,.json,application/json"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file) {
              return
            }
            openWorkspaceFileFromUpload(file).catch((nextError: unknown) =>
              toast.error(nextError instanceof Error ? nextError.message : '打开数据文件失败')
            )
            event.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
