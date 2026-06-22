import { ArrowRight, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GpaTrendChart } from '../components/charts/GpaTrendChart'
import { Badge } from '../components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { gradeBadgeClasses } from '../config/ui'
import { useGradePilotData } from '../db/useGradePilotData'
import { useAppStore } from '../stores/appStore'
import { cn } from '../utils/cn'
import { formatCredits, formatGpa, formatScore } from '../utils/format'
import {
  buildGpaTrend,
  calculateHistoricalCumulativeGpa,
  calculateProjectedCumulativeGpa,
  calculateSemesterPredictedGpa,
  getCoursePrediction,
  groupComponentsByCourse
} from '../utils/gpaMath'

export function DashboardPage() {
  const navigate = useNavigate()
  const [trendMetric, setTrendMetric] = useState<'gpa' | 'average'>('gpa')
  const { data } = useGradePilotData()
  const selectedTermId = useAppStore((state) => state.selectedTermId)
  const term = data.terms.find((item) => item.id === selectedTermId) ?? data.terms.find((item) => item.isCurrent)
  const termById = new Map(data.terms.map((item) => [item.id, item]))
  const termCourses = data.courses.filter((course) => course.termId === term?.id)
  const selectedTermOrder = term?.sortOrder ?? Number.POSITIVE_INFINITY
  const historicalCourses = data.courses.filter((course) => {
    const courseTerm = termById.get(course.termId)
    return (courseTerm?.sortOrder ?? Number.POSITIVE_INFINITY) < selectedTermOrder
  })
  const componentsByCourse = groupComponentsByCourse(data.components)
  const historicalGpa = calculateHistoricalCumulativeGpa(historicalCourses)
  const projected = term
    ? calculateProjectedCumulativeGpa(historicalCourses, termCourses, componentsByCourse, data.gradingProfiles)
    : undefined
  const semesterGpa = calculateSemesterPredictedGpa(termCourses, componentsByCourse, data.gradingProfiles)
  const trend = term ? buildGpaTrend(data.terms, data.courses, term.id, componentsByCourse, data.gradingProfiles) : []
  const delta = semesterGpa.gpa !== undefined && historicalGpa.gpa !== undefined ? semesterGpa.gpa - historicalGpa.gpa : undefined

  return (
    <div key={term?.id ?? 'none'} className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-strong">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">查看 GPA / 均分趋势、所选学期预测和课程目标进度。</p>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,8fr)_minmax(280px,3fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{trendMetric === 'gpa' ? 'GPA 趋势' : '均分趋势'}</CardTitle>
            <div className="relative flex rounded-lg border border-line bg-slate-50 p-1">
              <span
                className={cn(
                  'absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-md bg-primary shadow-sm transition-transform duration-300 ease-smooth',
                  trendMetric === 'average' && 'translate-x-full'
                )}
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => setTrendMetric('gpa')}
                className={cn(
                  'relative z-10 flex-1 rounded-md px-4 py-1 text-sm font-medium transition-colors duration-200',
                  trendMetric === 'gpa' ? 'text-white' : 'text-text hover:text-primary'
                )}
              >
                GPA
              </button>
              <button
                type="button"
                onClick={() => setTrendMetric('average')}
                className={cn(
                  'relative z-10 flex-1 rounded-md px-4 py-1 text-sm font-medium transition-colors duration-200',
                  trendMetric === 'average' ? 'text-white' : 'text-text hover:text-primary'
                )}
              >
                均分
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {trend.length > 0 ? (
              <div key={trendMetric} className="animate-fade-in">
                <GpaTrendChart points={trend} metric={trendMetric} />
              </div>
            ) : (
              <EmptyState title="暂无成绩趋势数据" />
            )}
          </CardContent>
        </Card>

        <div className="grid min-w-0 gap-5">
          <Card>
            <CardContent>
              <div className="flex min-w-0 items-center gap-3 text-sm font-medium text-text">
                <span className="rounded-lg bg-primary-soft p-2 text-primary">
                  <TrendingUp className="h-5 w-5" aria-hidden="true" />
                </span>
                本学期预测 GPA
              </div>
              <div className="mt-5 flex min-w-0 flex-wrap items-end gap-3">
                <div className="text-5xl font-bold text-strong">{formatGpa(semesterGpa.gpa)}</div>
                {delta !== undefined ? (
                  <Badge tone={delta >= 0 ? 'green' : 'red'}>{delta >= 0 ? '+' : ''}{formatGpa(delta)}</Badge>
                ) : null}
              </div>
              <p className="mt-3 text-sm text-text">本学期均分：{formatScore(semesterGpa.averageScore)}</p>
              <p className="mt-4 text-sm text-muted">
                基于 {semesterGpa.usedCourses} / {semesterGpa.totalCourses} 门可预测课程
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="text-sm font-medium text-text">当前累计 GPA</div>
              <div className="mt-5 text-5xl font-bold text-strong">{formatGpa(projected?.gpa ?? historicalGpa.gpa)}</div>
              <p className="mt-3 text-sm text-text">累计均分：{formatScore(projected?.averageScore ?? historicalGpa.averageScore)}</p>
              <p className="mt-4 text-sm text-muted">已覆盖 {formatCredits(projected?.credits ?? historicalGpa.credits)} 学分</p>
              <p className="mt-2 text-xs text-muted">
                所选学期前：{formatGpa(historicalGpa.gpa)} / {formatScore(historicalGpa.averageScore)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>本学期课程</CardTitle>
          <span className="text-sm text-muted">{term?.name ?? '未选择学期'}</span>
        </CardHeader>
        <CardContent className="p-0">
          {termCourses.length === 0 ? (
            <div className="p-5">
              <EmptyState title="当前学期没有课程" description="创建课程或导入 CSV 后会显示在这里。" />
            </div>
          ) : (
            <div className="max-w-full overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-line bg-slate-50 text-xs font-semibold text-muted">
                  <tr>
                    <th className="px-5 py-3">课程</th>
                    <th className="px-5 py-3">学分</th>
                    <th className="px-5 py-3">预测分</th>
                    <th className="px-5 py-3">课程总分</th>
                    <th className="px-5 py-3">绩点</th>
                    <th className="px-5 py-3">目标分</th>
                    <th className="px-5 py-3" aria-label="跳转" />
                  </tr>
                </thead>
                <tbody>
                  {termCourses.map((course) => {
                    const prediction = getCoursePrediction(
                      course,
                      componentsByCourse.get(course.id) ?? [],
                      data.gradingProfiles
                    )
                    const showGradeLabel = Boolean(prediction?.gradeLabel)
                    return (
                      <tr
                        key={course.id}
                        className="cursor-pointer border-b border-line last:border-0 hover:bg-primary-soft/40"
                        onClick={() => navigate(`/courses/${course.id}`)}
                      >
                        <td className="px-5 py-4">
                          <div className="font-medium text-strong">{course.name}</div>
                          <div className="text-xs text-muted">{course.code}</div>
                        </td>
                        <td className="px-5 py-4">{formatCredits(course.credits)}</td>
                        <td className="px-5 py-4" title={prediction ? undefined : '仍有未录入或未预测的分数组成'}>
                          {prediction ? (
                            <span
                              className={cn(
                                'inline-flex rounded-md border px-2 py-1 text-xs font-semibold',
                                showGradeLabel ? gradeBadgeClasses[prediction.gradeLabel!] : 'border-slate-200 bg-slate-50 text-slate-700'
                              )}
                            >
                              {formatScore(prediction.rawScore)}
                              {showGradeLabel ? ` (${prediction.gradeLabel})` : ''}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-5 py-4">{formatScore(prediction?.universityScore)}</td>
                        <td className="px-5 py-4">{formatGpa(prediction?.gpa)}</td>
                        <td className="px-5 py-4">{formatScore(course.targetUniversityScore)}</td>
                        <td className="px-5 py-4 text-right text-muted">
                          <ArrowRight className="ml-auto h-4 w-4" aria-hidden="true" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
