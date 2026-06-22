import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { AppHeader } from './AppHeader'
import { AppBottomNav, AppSidebar } from './AppSidebar'
import { useGradePilotData } from '../../db/useGradePilotData'
import {
  leaveWorkspace,
  saveWorkspaceFile,
  saveWorkspaceFileAs,
  setWorkspaceAutoSaveEnabled,
  useWorkspaceStore
} from '../../features/workspace/workspaceStore'
import {
  createCustomTerm,
  deleteTermAndCourses,
  deleteTermAndMoveCoursesToUncategorized,
  moveTerm,
  updateTermName
} from '../../db/repositories/termRepository'
import { useAppStore } from '../../stores/appStore'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'

export function AppShell() {
  const { data, isLoading, error } = useGradePilotData()
  const location = useLocation()
  const workspace = useWorkspaceStore()
  const [deleteTermOpen, setDeleteTermOpen] = useState(false)
  const [manageTermsOpen, setManageTermsOpen] = useState(false)
  const [renameDraft, setRenameDraft] = useState('')
  const selectedTermId = useAppStore((state) => state.selectedTermId)
  const setSelectedTermId = useAppStore((state) => state.setSelectedTermId)
  const selectedTerm = data.terms.find((term) => term.id === selectedTermId)
  const selectedTermCourses = data.courses.filter((course) => course.termId === selectedTermId)

  useEffect(() => {
    if ((!selectedTermId || !data.terms.some((term) => term.id === selectedTermId)) && data.terms.length > 0) {
      const current = data.terms.find((term) => term.isCurrent) ?? data.terms[0]
      setSelectedTermId(current.id)
    }
  }, [data.terms, selectedTermId, setSelectedTermId])

  async function selectFallbackTerm(termId?: string) {
    if (termId) {
      setSelectedTermId(termId)
      return
    }

    const fallback = await createCustomTerm('未归类')
    setSelectedTermId(fallback.id)
  }

  async function handleDeleteTermWithCourses() {
    if (!selectedTermId) {
      return
    }

    try {
      const nextTerm = await deleteTermAndCourses(selectedTermId)
      await selectFallbackTerm(nextTerm?.id)
      setDeleteTermOpen(false)
      toast.success('已删除学期')
    } catch {
      toast.error('删除学期失败')
    }
  }

  async function handleMoveCoursesToUncategorized() {
    if (!selectedTermId) {
      return
    }

    try {
      const targetTerm = await deleteTermAndMoveCoursesToUncategorized(selectedTermId)
      setSelectedTermId(targetTerm.id)
      setDeleteTermOpen(false)
      toast.success('课程已移到未归类')
    } catch {
      toast.error('移动课程失败')
    }
  }

  async function handleRenameTerm() {
    if (!selectedTermId || !renameDraft.trim()) {
      return
    }

    try {
      await updateTermName(selectedTermId, renameDraft)
      toast.success('已修改学期名称')
    } catch {
      toast.error('修改学期名称失败')
    }
  }

  async function handleCreateTerm() {
    try {
      const term = await createCustomTerm('新学期', selectedTermId)
      setSelectedTermId(term.id)
      setRenameDraft(term.name)
    } catch {
      toast.error('新建学期失败')
    }
  }

  function handleRequestDeleteTerm() {
    if (!selectedTermId) {
      return
    }

    setManageTermsOpen(false)
    setDeleteTermOpen(true)
  }

  async function handleMoveTerm(termId: string, direction: 'up' | 'down') {
    try {
      await moveTerm(termId, direction)
    } catch {
      toast.error('调整学期顺序失败')
    }
  }

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted">正在加载本地成绩数据...</div>
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app p-6">
        <EmptyState title="本地数据库读取失败" description={error.message} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-app">
      <AppHeader
        terms={data.terms}
        selectedTermId={selectedTermId}
        onTermChange={setSelectedTermId}
        onManageTerms={() => {
          setRenameDraft(selectedTerm?.name ?? '')
          setManageTermsOpen(true)
        }}
        workspaceMode={workspace.mode === 'file' ? 'file' : 'local'}
        workspaceFileName={workspace.fileName}
        workspaceSaveStatus={workspace.saveStatus}
        workspaceSaveMode={workspace.saveMode}
        workspaceAutoSaveEnabled={workspace.autoSaveEnabled}
        workspaceLastSavedAt={workspace.lastSavedAt}
        onToggleAutoSave={setWorkspaceAutoSaveEnabled}
        onSaveWorkspace={() => {
          void saveWorkspaceFile()
        }}
        onSaveWorkspaceAs={() => {
          void saveWorkspaceFileAs()
        }}
        onLeaveWorkspace={leaveWorkspace}
      />
      <div className="flex min-h-[calc(100vh-72px)]">
        <AppSidebar />
        <main className="min-w-0 flex-1 px-5 pb-24 pt-6 md:pb-6 lg:px-8">
          <div className="mx-auto max-w-[1440px]">
            <div key={location.pathname} className="animate-fade-in-up">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
      <AppBottomNav />
      <Modal open={deleteTermOpen} title="删除学期" onClose={() => setDeleteTermOpen(false)}>
        <div className="space-y-5">
          <div>
            <p className="text-sm leading-6 text-text">
              确定删除“{selectedTerm?.name ?? '当前学期'}”吗？
            </p>
            {selectedTermCourses.length > 0 ? (
              <p className="mt-2 text-sm leading-6 text-muted">
                这个学期内还有 {selectedTermCourses.length} 门课程。请选择是一起删除这些课程，还是把课程合并到“未归类”。
              </p>
            ) : (
              <p className="mt-2 text-sm leading-6 text-muted">这个学期内没有课程，可以直接删除。</p>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteTermOpen(false)}>
              取消
            </Button>
            {selectedTermCourses.length > 0 ? (
              <Button variant="secondary" onClick={handleMoveCoursesToUncategorized}>
                移到未归类
              </Button>
            ) : null}
            <Button variant="danger" onClick={handleDeleteTermWithCourses}>
              {selectedTermCourses.length > 0 ? '删除学期和课程' : '删除学期'}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal open={manageTermsOpen} title="学期管理" onClose={() => setManageTermsOpen(false)}>
        <div className="space-y-5">
          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Input
              label="当前学期名称"
              value={renameDraft}
              autoFocus
              onChange={(event) => setRenameDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleRenameTerm()
                }
              }}
            />
            <div className="flex items-end gap-2">
              <Button variant="secondary" onClick={handleCreateTerm}>
                <Plus className="h-4 w-4" />
                新建学期
              </Button>
              <Button variant="danger" onClick={handleRequestDeleteTerm} disabled={!selectedTermId}>
                <Trash2 className="h-4 w-4" />
                删除
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-line">
            <div className="border-b border-line bg-slate-50 px-4 py-3 text-xs font-semibold text-muted">
              学期顺序
            </div>
            <div className="divide-y divide-line">
              {data.terms.map((term, index) => {
                const isSelected = term.id === selectedTermId
                return (
                  <div key={term.id} className="flex min-w-0 flex-wrap items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        setSelectedTermId(term.id)
                        setRenameDraft(term.name)
                      }}
                    >
                      <span className="font-medium text-strong">{term.name}</span>
                      {isSelected ? (
                        <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">当前</span>
                      ) : null}
                    </button>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="icon"
                        aria-label={`上移 ${term.name}`}
                        disabled={index === 0}
                        onClick={() => handleMoveTerm(term.id, 'up')}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        aria-label={`下移 ${term.name}`}
                        disabled={index === data.terms.length - 1}
                        onClick={() => handleMoveTerm(term.id, 'down')}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={() => setManageTermsOpen(false)}>
              关闭
            </Button>
            <Button onClick={handleRenameTerm} disabled={!renameDraft.trim()}>
              保存名称
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
