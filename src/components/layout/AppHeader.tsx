import { Download, ListOrdered, LogOut, Save } from 'lucide-react'
import type { Term } from '../../types/domain'
import { cn } from '../../utils/cn'
import { isTauri } from '../../utils/platform'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'

interface AppHeaderProps {
  terms: Term[]
  selectedTermId?: string
  onTermChange: (termId: string) => void
  onManageTerms: () => void
  workspaceMode: 'local' | 'file'
  workspaceFileName?: string
  workspaceSaveStatus: 'idle' | 'saved' | 'dirty' | 'saving' | 'error'
  workspaceSaveMode?: 'native' | 'download' | 'tauri'
  workspaceAutoSaveEnabled: boolean
  workspaceLastSavedAt?: string
  onToggleAutoSave: (enabled: boolean) => void
  onSaveWorkspace: () => void
  onSaveWorkspaceAs: () => void
  onLeaveWorkspace: () => void
}

const saveStatusLabels = {
  idle: '浏览器本地',
  saved: '已保存',
  dirty: '未保存',
  saving: '保存中',
  error: '保存失败'
} as const

function formatSavedAt(value?: string): string {
  if (!value) {
    return ''
  }

  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date(value))
}

export function AppHeader({
  terms,
  selectedTermId,
  onTermChange,
  onManageTerms,
  workspaceMode,
  workspaceFileName,
  workspaceSaveStatus,
  workspaceSaveMode,
  workspaceAutoSaveEnabled,
  workspaceLastSavedAt,
  onToggleAutoSave,
  onSaveWorkspace,
  onSaveWorkspaceAs,
  onLeaveWorkspace
}: AppHeaderProps) {
  const savedAtText = workspaceSaveStatus === 'saved' ? formatSavedAt(workspaceLastSavedAt) : ''
  const autoSaveActive = workspaceSaveMode === 'native' && workspaceAutoSaveEnabled
  const showAutoSaveToggle = !isTauri()

  return (
    <header className="sticky top-0 z-30 flex min-h-[72px] flex-wrap items-center gap-x-3 gap-y-3 border-b border-line bg-white px-5 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="truncate text-xl font-bold text-strong">GradeScope</div>
      </div>
      <div className="mx-6 hidden h-8 w-px bg-line lg:block" />
      <Select
        aria-label="选择学期"
        className="w-56 border-transparent bg-white font-medium"
        value={selectedTermId ?? ''}
        onChange={(event) => onTermChange(event.target.value)}
      >
        {terms.map((term) => (
          <option key={term.id} value={term.id}>
            {term.name}
          </option>
        ))}
      </Select>
      <Button variant="secondary" size="sm" onClick={onManageTerms} disabled={terms.length === 0}>
        <ListOrdered className="h-4 w-4" />
        学期管理
      </Button>
      <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
        <div className="max-w-[260px] truncate rounded-lg border border-line bg-slate-50 px-3 py-2 text-xs text-text">
          {workspaceMode === 'file' ? (workspaceFileName ?? 'GradeScope 数据文件') : '浏览器本地数据'}
          <span className="ml-2 text-muted">
            {saveStatusLabels[workspaceSaveStatus]}
            {savedAtText ? `（${savedAtText}）` : ''}
          </span>
        </div>
        {workspaceMode === 'file' ? (
          <>
            <Button variant="secondary" size="sm" onClick={onSaveWorkspace} disabled={workspaceSaveStatus === 'saving'}>
              <Save className="h-4 w-4" />
              {workspaceSaveMode === 'download' ? '下载保存' : '保存'}
            </Button>
            {showAutoSaveToggle ? (
              <button
                type="button"
                role="switch"
                aria-label="自动保存"
                aria-checked={autoSaveActive}
                disabled={workspaceSaveStatus === 'saving' || workspaceSaveMode !== 'native'}
                onClick={() => onToggleAutoSave(!workspaceAutoSaveEnabled)}
                className={cn(
                  'inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50',
                  autoSaveActive
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-line bg-white text-text hover:bg-primary-soft'
                )}
                title={workspaceSaveMode === 'download' ? '下载保存模式不能自动写回原文件' : undefined}
              >
                <span
                  className={cn(
                    'relative h-4 w-8 shrink-0 rounded-full transition-colors duration-200',
                    autoSaveActive ? 'bg-primary' : 'bg-slate-300'
                  )}
                  aria-hidden="true"
                >
                  <span
                    className={cn(
                      'absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200 ease-smooth',
                      autoSaveActive ? 'translate-x-4' : 'translate-x-0'
                    )}
                  />
                </span>
                自动保存
              </button>
            ) : null}
          </>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onSaveWorkspaceAs} disabled={workspaceSaveStatus === 'saving'}>
          <Download className="h-4 w-4" />
          另存为
        </Button>
        <Button variant="ghost" size="sm" onClick={onLeaveWorkspace} disabled={workspaceSaveStatus === 'saving'}>
          <LogOut className="h-4 w-4" />
          退出
        </Button>
      </div>
    </header>
  )
}
