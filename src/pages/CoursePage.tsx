import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { componentStatusLabels } from '../config/ui'
import {
  DEFAULT_GRADING_PROFILE_ID,
  UTS_GRADING_PROFILE_ID,
  defaultGradingProfile,
  getProfileForCourse,
  isUtsCourse
} from '../config/gradingProfile'
import { useGradePilotData } from '../db/useGradePilotData'
import { createComponent, deleteComponent, upsertComponent } from '../db/repositories/componentRepository'
import { createCourse, upsertCourse } from '../db/repositories/courseRepository'
import { useAppStore } from '../stores/appStore'
import type { AssessmentComponent, Course } from '../types/domain'
import { cn } from '../utils/cn'
import { formatGpa, formatNumber, formatRequiredScore, formatScore, nowIso, parseOptionalNumber, toInputNumber } from '../utils/format'
import {
  getGpaFromUniversityScore,
  hasValidTotalWeight,
  inverseConvertUniversityToRaw,
  knownContribution,
  knownWeight,
  safeWeightedContribution,
  totalWeight,
  unknownWeight,
  validateAssessmentComponent
} from '../utils/gradeMath'
import { reverseSolve } from '../utils/reverseSolver'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { CommittedInput } from '../components/ui/CommittedInput'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { Select } from '../components/ui/Select'

interface CourseRowProps {
  component: AssessmentComponent
  onChange: (component: AssessmentComponent) => void
  onDelete: (component: AssessmentComponent) => void
}

function SortableComponentRow({ component, onChange, onDelete }: CourseRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: component.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }
  const contribution =
    component.scoreStatus !== 'unknown' && component.earnedPoints !== undefined
      ? safeWeightedContribution(component)
      : undefined
  const validationErrors = validateAssessmentComponent(component)
  const earnedPointsError = validationErrors.find((error) => error.field === 'earnedPoints')?.message
  const maxPointsError = validationErrors.find((error) => error.field === 'maxPoints')?.message

  return (
    <tr ref={setNodeRef} style={style} className={cn('border-b border-line last:border-0', isDragging && 'bg-primary-soft')}>
      <td className="w-10 px-4 py-3">
        <button
          className="cursor-grab rounded p-1 text-muted hover:bg-primary-soft hover:text-primary"
          aria-label={`拖动 ${component.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
      <td className="px-3 py-3">
        <CommittedInput
          aria-label="项目名称"
          value={component.name}
          maxLength={40}
          onCommit={(value) => onChange({ ...component, name: value.slice(0, 40) })}
        />
      </td>
      <td className="w-24 px-2 py-3">
        <CommittedInput
          aria-label="占比"
          type="number"
          min={0}
          max={100}
          step={0.1}
          className="w-20"
          value={toInputNumber(component.weightPercent)}
          onCommit={(value) =>
            onChange({ ...component, weightPercent: Math.min(Math.max(parseOptionalNumber(value) ?? component.weightPercent, 0), 100) })
          }
        />
      </td>
      <td className="w-28 px-2 py-3">
        <CommittedInput
          aria-label="当前得分"
          type="number"
          min={0}
          max={component.maxPoints}
          step={0.1}
          disabled={component.scoreStatus === 'unknown'}
          className="w-24"
          value={toInputNumber(component.earnedPoints)}
          error={earnedPointsError}
          onCommit={(value) =>
            onChange({
              ...component,
              earnedPoints: parseOptionalNumber(value)
            })
          }
        />
      </td>
      <td className="w-24 px-2 py-3">
        <CommittedInput
          aria-label="满分"
          type="number"
          min={0.1}
          step={0.1}
          className="w-20"
          value={toInputNumber(component.maxPoints)}
          error={maxPointsError}
          onCommit={(value) =>
            onChange({ ...component, maxPoints: parseOptionalNumber(value) ?? component.maxPoints })
          }
        />
      </td>
      <td className="w-32 px-2 py-3">
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
      <td className="w-28 px-3 py-3 text-right font-medium text-strong">{contribution === undefined ? '—' : formatNumber(contribution, 2)}</td>
      <td className="w-12 px-4 py-3 text-right">
        <Button variant="ghost" size="icon" aria-label={`删除 ${component.name}`} onClick={() => onDelete(component)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  )
}

function useSavedToast() {
  return () => {
    // Autosave status is shown in the header; field edits stay quiet.
  }
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

export function CoursePage() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const { data } = useGradePilotData()
  const selectedTermId = useAppStore((state) => state.selectedTermId)
  const [deleteTarget, setDeleteTarget] = useState<AssessmentComponent | undefined>()
  const [lockedState, setLockedState] = useState<{ courseId?: string; scores: Record<string, number | undefined> }>({
    scores: {}
  })
  const notifySaved = useSavedToast()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const courses = data.courses
  const termCourses = useMemo(() => {
    if (!selectedTermId) {
      return courses
    }
    return courses.filter((course) => course.termId === selectedTermId)
  }, [courses, selectedTermId])
  const selectedCourse =
    termCourses.find((course) => course.id === courseId) ??
    termCourses.find((course) => course.status === 'in_progress') ??
    termCourses[0]
  const components = useMemo(
    () => data.components.filter((component) => component.courseId === selectedCourse?.id).sort((a, b) => a.order - b.order),
    [data.components, selectedCourse?.id]
  )
  const lockedScores = lockedState.courseId === selectedCourse?.id ? lockedState.scores : {}
  const selectedProfile = selectedCourse ? getProfileForCourse(selectedCourse, data.gradingProfiles) : defaultGradingProfile
  const selectedIsUts = selectedCourse ? isUtsCourse(selectedCourse) : false
  const targetGpa =
    selectedCourse?.targetUniversityScore !== undefined
      ? getGpaFromUniversityScore(selectedCourse.targetUniversityScore, selectedProfile)
      : undefined
  const targetRaw =
    selectedCourse?.targetUniversityScore !== undefined && selectedIsUts
      ? inverseConvertUniversityToRaw(selectedCourse.targetUniversityScore, selectedProfile)
      : undefined
  const weight = totalWeight(components)
  const known = knownWeight(components)
  const contribution = knownContribution(components)
  const remaining = unknownWeight(components)
  const weightDiff = 100 - weight
  const unknownComponents = components.filter((component) => component.scoreStatus === 'unknown')
  const reverseResult = reverseSolve({
    targetUniversityScore: selectedCourse?.targetUniversityScore,
    components,
    profile: selectedProfile,
    lockedScores
  })

  useEffect(() => {
    if (selectedCourse && courseId !== selectedCourse.id) {
      navigate(`/courses/${selectedCourse.id}`, { replace: true })
    }
  }, [courseId, navigate, selectedCourse])

  async function saveCourse(course: Course) {
    try {
      await upsertCourse(course)
      notifySaved()
    } catch {
      toast.error('保存课程失败')
    }
  }

  async function handleCreateCourse() {
    const targetTermId = selectedTermId ?? data.terms[0]?.id
    if (!targetTermId) {
      toast.error('请先新建学期')
      return
    }

    try {
      const course = await createCourse(targetTermId)
      navigate(`/courses/${course.id}`)
      notifySaved()
    } catch {
      toast.error('创建课程失败')
    }
  }

  async function saveComponent(component: AssessmentComponent) {
    try {
      await upsertComponent({ ...component, updatedAt: nowIso() })
      notifySaved()
    } catch {
      toast.error('保存分数组成失败')
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
    notifySaved()
  }

  async function savePredictions() {
    if (!selectedCourse) {
      return
    }

    const updates: AssessmentComponent[] = []
    for (const component of unknownComponents) {
      let scorePercent = lockedScores[component.id]
      if (scorePercent === undefined && reverseResult.exactRequiredComponent?.componentId === component.id) {
        scorePercent = reverseResult.exactRequiredComponent.requiredScore
      }
      if (scorePercent === undefined && reverseResult.requiredAverage !== undefined && !reverseResult.exactRequiredComponent) {
        scorePercent = reverseResult.requiredAverage
      }
      if (scorePercent === undefined) {
        continue
      }

      const safeScore = Math.min(Math.max(scorePercent, 0), 100)
      updates.push({
        ...component,
        earnedPoints: (safeScore / 100) * component.maxPoints,
        scoreStatus: 'predicted',
        updatedAt: nowIso()
      })
    }

    await Promise.all(updates.map((component) => upsertComponent(component)))
    setLockedState({ courseId: selectedCourse.id, scores: {} })
    notifySaved()
    toast.success('已保存为预测值')
  }

  if (!selectedCourse) {
    return (
      <EmptyState title="当前学期还没有课程" description="新建课程后即可编辑课程信息、目标分和分数组成。">
        <Button onClick={handleCreateCourse}>
          <Plus className="h-4 w-4" />
          新建课程
        </Button>
      </EmptyState>
    )
  }

  return (
    <div key={selectedCourse.id} className="animate-fade-in space-y-6">
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
        <Card>
          <CardHeader>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
              <CardTitle className="shrink-0">课程信息</CardTitle>
              <Select
                aria-label="切换课程"
                value={selectedCourse.id}
                onChange={(event) => navigate(`/courses/${event.target.value}`)}
                className="w-full sm:w-72"
              >
                {termCourses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name} ({course.code})
                  </option>
                ))}
              </Select>
              <Select
                aria-label="课程类型"
                value={selectedIsUts ? 'uts' : 'shu'}
                onChange={(event) => {
                  const courseType = event.target.value === 'uts' ? 'uts' : 'shu'
                  void saveCourse({
                    ...selectedCourse,
                    courseType,
                    gradingProfileId: courseType === 'uts' ? UTS_GRADING_PROFILE_ID : DEFAULT_GRADING_PROFILE_ID
                  })
                }}
                className="w-full sm:w-32"
              >
                <option value="shu">上大课程</option>
                <option value="uts">UTS 课程</option>
              </Select>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCreateCourse}
              >
                <Plus className="h-4 w-4" />
                新建课程
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid min-w-0 gap-4 sm:grid-cols-2 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.75fr)_minmax(0,1.05fr)_minmax(90px,0.55fr)]">
            <CommittedInput
              label="课程名称"
              value={selectedCourse.name}
              maxLength={60}
              onCommit={(value) => saveCourse({ ...selectedCourse, name: value.slice(0, 60) })}
            />
            <CommittedInput
              label="课程代码"
              value={selectedCourse.code}
              maxLength={20}
              onCommit={(value) => saveCourse({ ...selectedCourse, code: value.slice(0, 20) })}
            />
            <Select
              label="所属学期"
              value={selectedCourse.termId}
              onChange={(event) => saveCourse({ ...selectedCourse, termId: event.target.value })}
            >
              {data.terms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
            </Select>
            <CommittedInput
              label="学分"
              type="number"
              min={0.1}
              max={30}
              step={0.5}
              value={toInputNumber(selectedCourse.credits)}
              onCommit={(value) =>
                saveCourse({
                  ...selectedCourse,
                  credits: Math.min(Math.max(parseOptionalNumber(value) ?? selectedCourse.credits, 0.1), 30)
                })
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>目标分设置</CardTitle>
          </CardHeader>
          <CardContent className={cn('grid min-w-0 gap-4 sm:grid-cols-2', selectedIsUts && '2xl:grid-cols-3')}>
            <CommittedInput
              label="目标课程总分"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={toInputNumber(selectedCourse.targetUniversityScore)}
              onCommit={(value) =>
                saveCourse({
                  ...selectedCourse,
                  targetUniversityScore: parseOptionalNumber(value)
                })
              }
            />
            <CommittedInput label="目标绩点" readOnly value={formatGpa(targetGpa)} onCommit={() => undefined} />
            {selectedIsUts ? <CommittedInput label="UTS 原始目标分" readOnly value={formatNumber(targetRaw, 1)} onCommit={() => undefined} /> : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>分数组成与反推</CardTitle>
            <Button
              variant="secondary"
              onClick={() => createComponent(selectedCourse.id, components.length + 1).then(() => notifySaved())}
            >
              <Plus className="h-4 w-4" />
              添加项目
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {components.length === 0 ? (
              <div className="p-5">
                <EmptyState title="还没有分数组成" description="添加作业、考试或展示项目后即可计算预测分。" />
              </div>
            ) : (
              <div className="max-w-full overflow-x-auto">
                <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                  <SortableContext items={components.map((component) => component.id)} strategy={verticalListSortingStrategy}>
                    <table className="w-full min-w-[860px] text-sm">
                      <thead className="border-b border-line bg-slate-50 text-xs font-semibold text-muted">
                        <tr>
                          <th className="px-4 py-3" />
                          <th className="px-3 py-3 text-left">项目名称</th>
                          <th className="px-3 py-3 text-left">占比</th>
                          <th className="px-3 py-3 text-left">当前得分</th>
                          <th className="px-3 py-3 text-left">满分</th>
                          <th className="px-3 py-3 text-left">状态</th>
                          <th className="px-3 py-3 text-right">加权贡献</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {components.map((component) => (
                          <SortableComponentRow
                            key={component.id}
                            component={component}
                            onChange={saveComponent}
                            onDelete={(nextTarget) => {
                              if (nextTarget.earnedPoints !== undefined) {
                                setDeleteTarget(nextTarget)
                              } else {
                                deleteComponent(nextTarget.id).then(() => notifySaved())
                              }
                            }}
                          />
                        ))}
                      </tbody>
                    </table>
                  </SortableContext>
                </DndContext>
              </div>
            )}

            <div
              className={cn(
                'm-5 grid min-w-0 gap-4 rounded-xl border p-4 text-sm sm:grid-cols-2 xl:grid-cols-4',
                hasValidTotalWeight(components)
                  ? 'border-blue-100 bg-primary-soft/60'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              )}
            >
              <div>
                <div className="text-muted">总占比</div>
                <div className="text-xl font-semibold text-strong">{formatNumber(weight, 1)}%</div>
              </div>
              <div>
                <div className="text-muted">已知占比</div>
                <div className="text-xl font-semibold text-strong">{formatNumber(known, 1)}%</div>
              </div>
              <div>
                <div className="text-muted">当前已知加权分</div>
                <div className="text-xl font-semibold text-strong">{formatNumber(contribution, 2)}</div>
              </div>
              <div>
                <div className="text-muted">剩余未知占比</div>
                <div className="text-xl font-semibold text-strong">{formatNumber(remaining, 1)}%</div>
              </div>
              {!hasValidTotalWeight(components) ? (
                <div className="md:col-span-4">权重合计需要为 100%，当前{weightDiff > 0 ? `还差 ${formatNumber(weightDiff, 1)}%` : `超出 ${formatNumber(Math.abs(weightDiff), 1)}%`}。</div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>目标反推结果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className={cn('rounded-2xl border p-5', statusClasses(reverseResult.status))}>
              <div className="text-base font-semibold">{scoreStatusText(reverseResult.status)}</div>
              {reverseResult.exactRequiredComponent ? (
                <div className="mt-4">
                  <div className="text-sm">
                    仅剩 1 项未知：
                    {components.find((component) => component.id === reverseResult.exactRequiredComponent?.componentId)?.name ?? '未知项目'}
                  </div>
                  <div className="mt-3 text-5xl font-bold">{formatRequiredScore(reverseResult.exactRequiredComponent.requiredScore)} 分</div>
                  <div className="mt-2 text-sm">最低要求，百分制</div>
                </div>
              ) : reverseResult.requiredAverage !== undefined ? (
                <div className="mt-4">
                  <div className="text-sm">剩余 {reverseResult.unknownCount} 项平均至少需要</div>
                  <div className="mt-3 text-5xl font-bold">{formatRequiredScore(reverseResult.requiredAverage)} 分</div>
                </div>
              ) : (
                <p className="mt-3 text-sm">请填写目标分并保留至少一个未知项目。</p>
              )}
              {reverseResult.status === 'impossible' ? (
                <p className="mt-4 text-sm">
                  即使剩余项目全部满分，也无法达到当前目标。最高可达到：{formatScore(reverseResult.maxReachableUniversityScore)} 分
                </p>
              ) : null}
              {reverseResult.status === 'already_achieved' ? <p className="mt-4 text-sm">当前已知成绩已经达到目标，剩余项目最低要求为 0 分。</p> : null}
            </div>

            {unknownComponents.length > 1 ? (
              <div className="max-w-full overflow-x-auto rounded-xl border border-line">
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
                      const exact = reverseResult.exactRequiredComponent?.componentId === component.id
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
                              ? `${formatRequiredScore(reverseResult.exactRequiredComponent?.requiredScore)} 分`
                              : lockedScores[component.id] !== undefined
                                ? '已锁定'
                                : reverseResult.requiredAverage !== undefined
                                  ? `${formatRequiredScore(reverseResult.requiredAverage)} 分`
                                  : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            <Button disabled={reverseResult.status === 'incomplete'} onClick={savePredictions}>
              保存为预测值
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>成绩规则提示</CardTitle>
        </CardHeader>
        <CardContent className="grid min-w-0 gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-line bg-slate-50 p-4">
            <div className="font-medium text-strong">上海大学课程总分</div>
            <p className="mt-3 text-sm leading-6 text-text">
              上大课程按原始百分制直接计算课程总分，并使用 A / A- / B+ / B / B- / C / D / F 对应绩点。UTS 课程会额外显示 HD / D / CR / P / F，并按 UTS 规则换算到上大课程总分。
            </p>
          </div>
          <ul className="space-y-3 text-sm leading-6 text-text">
            <li>权重必须合计 100%，否则 Dashboard 不计算该课程预测。</li>
            <li>预测值会用于 Dashboard 预测，但不是正式成绩。</li>
            <li>未知项会在本页参与目标反推。</li>
            <li>最终以学校正式成绩为准。</li>
          </ul>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteTarget !== undefined}
        title="删除分数组成"
        description={`确定删除“${deleteTarget?.name ?? ''}”吗？这个项目已有成绩，删除后无法参与计算。`}
        confirmLabel="删除"
        onClose={() => setDeleteTarget(undefined)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteComponent(deleteTarget.id).then(() => notifySaved())
          }
        }}
      />
    </div>
  )
}
