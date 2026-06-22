import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { componentStatusLabels } from '../config/ui'
import { defaultGradingProfile, getProfileForCourse } from '../config/gradingProfile'
import { useGradePilotData } from '../db/useGradePilotData'
import { createComponent, deleteComponent, upsertComponent } from '../db/repositories/componentRepository'
import { upsertCourse } from '../db/repositories/courseRepository'
import { useAppStore } from '../stores/appStore'
import type { AssessmentComponent } from '../types/domain'
import { cn } from '../utils/cn'
import { formatGpa, formatNumber, formatRequiredScore, formatScore, parseOptionalNumber, toInputNumber } from '../utils/format'
import { getGpaFromUniversityScore, knownContribution, knownWeight, unknownWeight, validateAssessmentComponent } from '../utils/gradeMath'
import { reverseSolve } from '../utils/reverseSolver'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { CommittedInput } from '../components/ui/CommittedInput'
import { EmptyState } from '../components/ui/EmptyState'
import { Select } from '../components/ui/Select'

interface ScoreRowProps {
  component: AssessmentComponent
  onChange: (component: AssessmentComponent) => void
  onDelete: (component: AssessmentComponent) => void
}

function SortableScoreRow({ component, onChange, onDelete }: ScoreRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: component.id })
  const validationErrors = validateAssessmentComponent(component)
  const earnedPointsError = validationErrors.find((error) => error.field === 'earnedPoints')?.message
  const maxPointsError = validationErrors.find((error) => error.field === 'maxPoints')?.message

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('border-b border-line last:border-0', isDragging && 'bg-primary-soft')}
    >
      <td className="w-10 px-4 py-3">
        <button aria-label={`拖动 ${component.name}`} className="cursor-grab rounded p-1 text-muted hover:bg-primary-soft" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
      <td className="px-3 py-3">
        <CommittedInput aria-label="项目名称" value={component.name} onCommit={(value) => onChange({ ...component, name: value.slice(0, 40) })} />
      </td>
      <td className="px-3 py-3">
        <CommittedInput
          aria-label="权重"
          type="number"
          min={0}
          max={100}
          step={0.1}
          value={toInputNumber(component.weightPercent)}
          onCommit={(value) => onChange({ ...component, weightPercent: Math.min(Math.max(parseOptionalNumber(value) ?? component.weightPercent, 0), 100) })}
        />
      </td>
      <td className="px-3 py-3">
        <CommittedInput
          aria-label="已得分"
          type="number"
          min={0}
          max={component.maxPoints}
          step={0.1}
          disabled={component.scoreStatus === 'unknown'}
          value={toInputNumber(component.earnedPoints)}
          error={earnedPointsError}
          onCommit={(value) => onChange({ ...component, earnedPoints: parseOptionalNumber(value) })}
        />
      </td>
      <td className="px-3 py-3">
        <CommittedInput
          aria-label="满分"
          type="number"
          min={0.1}
          step={0.1}
          value={toInputNumber(component.maxPoints)}
          error={maxPointsError}
          onCommit={(value) => onChange({ ...component, maxPoints: parseOptionalNumber(value) ?? component.maxPoints })}
        />
      </td>
      <td className="px-3 py-3">
        <Select
          aria-label="状态"
          value={component.scoreStatus}
          onChange={(event) => {
            const nextStatus = event.target.value as AssessmentComponent['scoreStatus']
            onChange({
              ...component,
              scoreStatus: nextStatus,
              earnedPoints: nextStatus === 'unknown' ? undefined : component.earnedPoints
            })
          }}
        >
          <option value="actual">{componentStatusLabels.actual}</option>
          <option value="predicted">{componentStatusLabels.predicted}</option>
          <option value="unknown">{componentStatusLabels.unknown}</option>
        </Select>
      </td>
      <td className="w-12 px-4 py-3 text-right">
        <Button variant="ghost" size="icon" aria-label={`删除 ${component.name}`} onClick={() => onDelete(component)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  )
}

function scoreStatusText(status: ReturnType<typeof reverseSolve>['status']): string {
  if (status === 'already_achieved') return '已达标'
  if (status === 'feasible') return '可达成'
  if (status === 'impossible') return '无法达成'
  return '信息不足'
}

function statusClasses(status: ReturnType<typeof reverseSolve>['status']): string {
  if (status === 'already_achieved') return 'border-blue-200 bg-blue-50 text-blue-800'
  if (status === 'feasible') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (status === 'impossible') return 'border-red-200 bg-red-50 text-red-800'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

export function ScorePage() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const { data } = useGradePilotData()
  const selectedTermId = useAppStore((state) => state.selectedTermId)
  const [lockedState, setLockedState] = useState<{ courseId?: string; scores: Record<string, number | undefined> }>({
    scores: {}
  })
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const visibleCourses = useMemo(() => {
    const termCourses = selectedTermId ? data.courses.filter((course) => course.termId === selectedTermId) : []
    return termCourses.length > 0 ? termCourses : data.courses
  }, [data.courses, selectedTermId])
  const selectedCourse =
    visibleCourses.find((course) => course.id === courseId) ??
    visibleCourses.find((course) => course.status === 'in_progress') ??
    visibleCourses[0]
  const components = useMemo(
    () => data.components.filter((component) => component.courseId === selectedCourse?.id).sort((a, b) => a.order - b.order),
    [data.components, selectedCourse?.id]
  )
  const lockedScores = lockedState.courseId === selectedCourse?.id ? lockedState.scores : {}
  const selectedProfile = selectedCourse ? getProfileForCourse(selectedCourse, data.gradingProfiles) : defaultGradingProfile
  const unknownComponents = components.filter((component) => component.scoreStatus === 'unknown')
  const result = reverseSolve({
    targetUniversityScore: selectedCourse?.targetUniversityScore,
    components,
    profile: selectedProfile,
    lockedScores
  })
  const targetGpa =
    selectedCourse?.targetUniversityScore !== undefined
      ? getGpaFromUniversityScore(selectedCourse.targetUniversityScore, selectedProfile)
      : undefined

  useEffect(() => {
    if (selectedCourse && courseId !== selectedCourse.id) {
      navigate(`/scores/${selectedCourse.id}`, { replace: true })
    }
  }, [courseId, navigate, selectedCourse])

  async function saveComponent(component: AssessmentComponent) {
    try {
      await upsertComponent(component)
      toast.success('已自动保存')
    } catch {
      toast.error('保存分数失败')
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = components.findIndex((component) => component.id === active.id)
    const newIndex = components.findIndex((component) => component.id === over.id)
    const reordered = [...components]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)
    await Promise.all(reordered.map((component, index) => upsertComponent({ ...component, order: index + 1 })))
  }

  async function savePredictions() {
    const updates: AssessmentComponent[] = []
    for (const component of unknownComponents) {
      let scorePercent = lockedScores[component.id]
      if (scorePercent === undefined && result.exactRequiredComponent?.componentId === component.id) {
        scorePercent = result.exactRequiredComponent.requiredScore
      }
      if (scorePercent === undefined && result.requiredAverage !== undefined && !result.exactRequiredComponent) {
        scorePercent = result.requiredAverage
      }
      if (scorePercent === undefined) {
        continue
      }
      const safeScore = Math.min(Math.max(scorePercent, 0), 100)
      updates.push({
        ...component,
        earnedPoints: (safeScore / 100) * component.maxPoints,
        scoreStatus: 'predicted'
      })
    }

    await Promise.all(updates.map((component) => upsertComponent(component)))
    setLockedState({ courseId: selectedCourse.id, scores: {} })
    toast.success('已保存为预测值')
  }

  if (!selectedCourse) {
    return <EmptyState title="还没有课程记录" description="创建课程后即可进行目标反推。" />
  }

  const known = knownContribution(components)
  const knownPercent = knownWeight(components)
  const unknownPercent = unknownWeight(components)

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 xl:grid-cols-[minmax(240px,1.4fr)_minmax(180px,1fr)_repeat(4,minmax(120px,0.8fr))]">
          <Select label="课程" value={selectedCourse.id} onChange={(event) => navigate(`/scores/${event.target.value}`)}>
            {visibleCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name} ({course.code})
              </option>
            ))}
          </Select>
          <CommittedInput
            label="当前目标课程总分"
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={toInputNumber(selectedCourse.targetUniversityScore)}
            onCommit={(value) => {
              void upsertCourse({ ...selectedCourse, targetUniversityScore: parseOptionalNumber(value) }).catch(() =>
                toast.error('保存目标分失败')
              )
            }}
          />
          <SummaryTile label="目标绩点" value={formatGpa(targetGpa)} />
          <SummaryTile label="已知加权分" value={`${formatNumber(known, 2)} / 100`} />
          <SummaryTile label="剩余需贡献" value={`${formatNumber(result.requiredUnknownContribution, 2)} / 100`} />
          <SummaryTile label="当前状态" value={scoreStatusText(result.status)} />
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>当前已知成绩</CardTitle>
            <Button variant="secondary" onClick={() => createComponent(selectedCourse.id, components.length + 1)}>
              <Plus className="h-4 w-4" />
              添加一行
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <SortableContext items={components.map((component) => component.id)} strategy={verticalListSortingStrategy}>
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="border-b border-line bg-slate-50 text-xs text-muted">
                      <tr>
                        <th className="px-4 py-3" />
                        <th className="px-3 py-3 text-left">项目名称</th>
                        <th className="px-3 py-3 text-left">权重</th>
                        <th className="px-3 py-3 text-left">已得分</th>
                        <th className="px-3 py-3 text-left">满分</th>
                        <th className="px-3 py-3 text-left">状态</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {components.map((component) => (
                        <SortableScoreRow key={component.id} component={component} onChange={saveComponent} onDelete={(next) => deleteComponent(next.id)} />
                      ))}
                    </tbody>
                  </table>
                </SortableContext>
              </DndContext>
            </div>
            <div className="m-5 grid gap-4 rounded-xl border border-line bg-slate-50 p-4 text-sm md:grid-cols-3">
              <div>
                <div className="text-muted">已知部分加权分</div>
                <div className="text-2xl font-semibold text-primary">{formatNumber(known, 2)} / 100</div>
              </div>
              <div>
                <div className="text-muted">已知部分占比</div>
                <div className="text-2xl font-semibold text-strong">{formatNumber(knownPercent, 1)}%</div>
              </div>
              <div>
                <div className="text-muted">未知部分占比</div>
                <div className="text-2xl font-semibold text-strong">{formatNumber(unknownPercent, 1)}%</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>目标反推结果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className={cn('rounded-2xl border p-5', statusClasses(result.status))}>
              <div className="text-base font-semibold">{scoreStatusText(result.status)}</div>
              {result.exactRequiredComponent ? (
                <div className="mt-4">
                  <div className="text-sm">
                    仅剩 1 项未知：
                    {components.find((component) => component.id === result.exactRequiredComponent?.componentId)?.name ?? '未知项目'}
                  </div>
                  <div className="mt-3 text-5xl font-bold">{formatRequiredScore(result.exactRequiredComponent.requiredScore)} 分</div>
                  <div className="mt-2 text-sm">最低要求，百分制</div>
                </div>
              ) : result.requiredAverage !== undefined ? (
                <div className="mt-4">
                  <div className="text-sm">剩余 {result.unknownCount} 项平均至少需要</div>
                  <div className="mt-3 text-5xl font-bold">{formatRequiredScore(result.requiredAverage)} 分</div>
                </div>
              ) : (
                <p className="mt-3 text-sm">请填写目标分并保留至少一个未知项目。</p>
              )}
              {result.status === 'impossible' ? (
                <p className="mt-4 text-sm">
                  即使剩余项目全部满分，也无法达到当前目标。最高可达到：{formatScore(result.maxReachableUniversityScore)} 分
                </p>
              ) : null}
              {result.status === 'already_achieved' ? <p className="mt-4 text-sm">当前已知成绩已经达到目标，剩余项目最低要求为 0 分。</p> : null}
            </div>

            {unknownComponents.length > 1 ? (
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[420px] text-sm">
                  <thead className="bg-slate-50 text-xs text-muted">
                    <tr>
                      <th className="px-4 py-3 text-left">未知项目名称</th>
                      <th className="px-4 py-3 text-left">权重</th>
                      <th className="px-4 py-3 text-left">假设分数</th>
                      <th className="px-4 py-3 text-left">当前反推结果</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unknownComponents.map((component) => {
                      const exact = result.exactRequiredComponent?.componentId === component.id
                      return (
                        <tr key={component.id} className="border-t border-line">
                          <td className="px-4 py-3 font-medium text-strong">{component.name}</td>
                          <td className="px-4 py-3">{formatNumber(component.weightPercent, 1)}%</td>
                          <td className="px-4 py-3">
                            <CommittedInput
                              aria-label={`${component.name} 假设分数`}
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              value={toInputNumber(lockedScores[component.id])}
                              onCommit={(value) =>
                                setLockedState((current) => {
                                  const currentScores = current.courseId === selectedCourse.id ? current.scores : {}
                                  return {
                                    courseId: selectedCourse.id,
                                    scores: {
                                      ...currentScores,
                                      [component.id]: parseOptionalNumber(value)
                                    }
                                  }
                                })
                              }
                            />
                          </td>
                          <td className="px-4 py-3">
                            {exact
                              ? `${formatRequiredScore(result.exactRequiredComponent?.requiredScore)} 分`
                              : lockedScores[component.id] !== undefined
                                ? '已锁定'
                                : result.requiredAverage !== undefined
                                  ? `${formatRequiredScore(result.requiredAverage)} 分`
                                  : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            <Button disabled={result.status === 'incomplete'} onClick={savePredictions}>
              保存为预测值
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>说明</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 text-sm leading-6 text-text md:grid-cols-3">
            <li>多个未知项默认显示平均最低要求。</li>
            <li>填写假设分数后，系统会重新反推剩余未知项。</li>
            <li>假设值不会保存，除非点击“保存为预测值”。</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-slate-50 px-4 py-3">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 truncate text-base font-semibold text-strong">{value}</div>
    </div>
  )
}
