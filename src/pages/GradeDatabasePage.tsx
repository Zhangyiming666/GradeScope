import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable
} from '@tanstack/react-table'
import { Copy, Download, ExternalLink, FileUp, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import { statusLabels } from '../config/ui'
import { getProfileForCourse } from '../config/gradingProfile'
import { useGradePilotData } from '../db/useGradePilotData'
import { createCourse, deleteCourse, duplicateCourse } from '../db/repositories/courseRepository'
import { csvFileName, exportCsvString, importCsvData, previewCsvImport } from '../features/importExport/csv'
import { useAppStore } from '../stores/appStore'
import type { Course, CourseStatus } from '../types/domain'
import type { CsvPreview } from '../types/csv'
import { formatCredits, formatGpa, formatScore } from '../utils/format'
import { calculateCoursePrediction } from '../utils/gradeMath'
import { groupComponentsByCourse } from '../utils/gpaMath'

interface DatabaseRow {
  id: string
  termName: string
  termSortOrder: number
  courseName: string
  courseCode: string
  credits: number
  universityScore?: number
  gpa?: number
  targetScore?: number
  componentCount: number
  status: CourseStatus
  source: Course
}

export function GradeDatabasePage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const selectedTermId = useAppStore((state) => state.selectedTermId)
  const { data } = useGradePilotData()
  const [search, setSearch] = useState('')
  const [termFilter, setTermFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'termName', desc: true }])
  const [deleteTarget, setDeleteTarget] = useState<Course | undefined>()
  const [preview, setPreview] = useState<CsvPreview | undefined>()
  const [pendingCsv, setPendingCsv] = useState<string | undefined>()
  const termById = useMemo(() => new Map(data.terms.map((term) => [term.id, term])), [data.terms])
  const componentsByCourse = useMemo(() => groupComponentsByCourse(data.components), [data.components])

  const rows = useMemo<DatabaseRow[]>(() => {
    return data.courses.map((course) => {
      const term = termById.get(course.termId)
      const components = componentsByCourse.get(course.id) ?? []
      const prediction = calculateCoursePrediction(components, getProfileForCourse(course, data.gradingProfiles), course)
      const official = course.status === 'completed' && course.officialGpa !== undefined
      return {
        id: course.id,
        termName: term?.name ?? '未知学期',
        termSortOrder: term?.sortOrder ?? 0,
        courseName: course.name,
        courseCode: course.code,
        credits: course.credits,
        universityScore: official ? course.officialUniversityScore : prediction?.universityScore,
        gpa: official ? course.officialGpa : prediction?.gpa,
        targetScore: course.targetUniversityScore,
        componentCount: components.length,
        status: course.status,
        source: course
      }
    })
  }, [componentsByCourse, data.courses, data.gradingProfiles, termById])

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        row.courseName.toLowerCase().includes(normalizedSearch) ||
        row.courseCode.toLowerCase().includes(normalizedSearch) ||
        row.termName.toLowerCase().includes(normalizedSearch)
      const matchesTerm = termFilter === 'all' || row.source.termId === termFilter
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter
      return matchesSearch && matchesTerm && matchesStatus
    })
  }, [rows, search, statusFilter, termFilter])

  const columns = useMemo<ColumnDef<DatabaseRow>[]>(
    () => [
      { accessorKey: 'termName', header: '学期', sortingFn: (a, b) => a.original.termSortOrder - b.original.termSortOrder },
      { accessorKey: 'courseName', header: '课程名称' },
      { accessorKey: 'courseCode', header: '课程代码' },
      { accessorKey: 'credits', header: '学分', cell: ({ row }) => formatCredits(row.original.credits) },
      { accessorKey: 'universityScore', header: '课程总分', cell: ({ row }) => formatScore(row.original.universityScore) },
      { accessorKey: 'gpa', header: '绩点', cell: ({ row }) => formatGpa(row.original.gpa) },
      { accessorKey: 'targetScore', header: '目标分', cell: ({ row }) => formatScore(row.original.targetScore) },
      { accessorKey: 'componentCount', header: '分数组成项数' },
      {
        accessorKey: 'status',
        header: '状态',
        cell: ({ row }) => (
          <Badge tone={row.original.status === 'completed' ? 'green' : row.original.status === 'in_progress' ? 'blue' : 'slate'}>
            {statusLabels[row.original.status]}
          </Badge>
        )
      },
      {
        id: 'actions',
        header: '操作菜单',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="打开课程" onClick={() => navigate(`/courses/${row.original.id}`)}>
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="复制课程"
              onClick={() =>
                duplicateCourse(row.original.id)
                  .then((course) => {
                    if (course) toast.success('已复制课程')
                  })
                  .catch(() => toast.error('复制课程失败'))
              }
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="删除课程" onClick={() => setDeleteTarget(row.original.source)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      }
    ],
    [navigate]
  )

  // TanStack Table intentionally returns function-heavy instances that React Compiler cannot memoize.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10
      }
    }
  })

  const completedCourses = data.courses.filter((course) => course.status === 'completed').length
  const currentCourses = data.courses.filter((course) => course.status === 'in_progress').length
  const totalCredits = data.courses.reduce((sum, course) => sum + course.credits, 0)

  function handleExport() {
    const csv = exportCsvString(data.terms, data.courses, data.components)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = csvFileName()
    link.click()
    URL.revokeObjectURL(url)
    toast.success('CSV 已导出')
  }

  async function handleImportFile(file: File | undefined) {
    if (!file) {
      return
    }
    const text = await file.text()
    const nextPreview = await previewCsvImport(text)
    setPendingCsv(text)
    setPreview(nextPreview)
  }

  async function handleImport(mode: 'merge' | 'overwrite') {
    if (!pendingCsv) {
      return
    }
    const result = await importCsvData(pendingCsv, mode)
    if (result.errors.length > 0) {
      setPreview(result)
      toast.error('CSV 存在校验错误')
      return
    }
    setPreview(undefined)
    setPendingCsv(undefined)
    toast.success('CSV 已导入')
  }

  async function handleCreateCourse() {
    const termId = selectedTermId ?? data.terms.find((term) => term.isCurrent)?.id ?? data.terms[0]?.id
    if (!termId) {
      toast.error('没有可用学期')
      return
    }
    const course = await createCourse(termId)
    navigate(`/courses/${course.id}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-[1_1_280px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            aria-label="搜索课程"
            className="pl-9"
            placeholder="搜索课程名称、课程代码或学期..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select aria-label="学期筛选" value={termFilter} onChange={(event) => setTermFilter(event.target.value)} className="w-full sm:w-44">
          <option value="all">全部学期</option>
          {data.terms.map((term) => (
            <option key={term.id} value={term.id}>
              {term.name}
            </option>
          ))}
        </Select>
        <Select aria-label="状态筛选" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full sm:w-40">
          <option value="all">全部状态</option>
          <option value="not_started">未开始</option>
          <option value="in_progress">进行中</option>
          <option value="completed">已完成</option>
        </Select>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => handleImportFile(event.target.files?.[0])}
        />
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
          <FileUp className="h-4 w-4" />
          导入 CSV
        </Button>
        <Button onClick={handleExport}>
          <Download className="h-4 w-4" />
          导出 CSV
        </Button>
      </div>

      <Card>
        <CardContent className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="总课程数" value={`${data.courses.length} 门`} />
          <Metric label="已完成课程" value={`${completedCourses} 门`} />
          <Metric label="当前课程" value={`${currentCourses} 门`} />
          <Metric label="累计学分" value={`${formatCredits(totalCredits)} 学分`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>成绩数据库</CardTitle>
          <Button variant="secondary" onClick={handleCreateCourse}>
            <Plus className="h-4 w-4" />
            创建课程
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {data.courses.length === 0 ? (
            <div className="p-5">
              <EmptyState title="还没有课程记录" description="创建第一门课程或导入 CSV">
                <Button onClick={handleCreateCourse}>创建课程</Button>
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  导入 CSV
                </Button>
              </EmptyState>
            </div>
          ) : (
            <>
              <div className="max-w-full overflow-x-auto">
                <table className="w-full min-w-[1120px] text-left text-sm">
                  <thead className="border-b border-line bg-slate-50 text-xs font-semibold text-muted">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            className="cursor-pointer px-5 py-3 select-none"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="border-b border-line last:border-0 hover:bg-primary-soft/40">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-5 py-3">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 text-sm text-muted">
                <span>共 {filteredRows.length} 条记录</span>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
                    上一页
                  </Button>
                  <span>
                    第 {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1} 页
                  </span>
                  <Button variant="secondary" size="sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
                    下一页
                  </Button>
                  <Select
                    aria-label="每页条数"
                    value={String(table.getState().pagination.pageSize)}
                    onChange={(event) => table.setPageSize(Number(event.target.value))}
                    className="w-28"
                  >
                    <option value="10">10 条/页</option>
                    <option value="20">20 条/页</option>
                    <option value="50">50 条/页</option>
                  </Select>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteTarget !== undefined}
        title="删除课程"
        description={`确定删除“${deleteTarget?.name ?? ''}”吗？相关分数组成也会一起删除。`}
        confirmLabel="删除"
        onClose={() => setDeleteTarget(undefined)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteCourse(deleteTarget.id)
              .then(() => toast.success('已删除课程'))
              .catch(() => toast.error('删除课程失败'))
          }
        }}
      />

      <Modal open={preview !== undefined} title="CSV 导入预览" onClose={() => setPreview(undefined)}>
        {preview ? (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-4">
              <Metric label="学期数" value={String(preview.terms)} />
              <Metric label="课程数" value={String(preview.courses)} />
              <Metric label="分数组成数" value={String(preview.components)} />
              <Metric label="冲突数" value={String(preview.conflicts)} />
            </div>
            {preview.errors.length > 0 ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <div className="font-semibold">发现 {preview.errors.length} 个错误</div>
                <ul className="mt-2 max-h-48 list-disc overflow-auto pl-5">
                  {preview.errors.map((error, index) => (
                    <li key={`${error.rowNumber}-${index}`}>
                      第 {error.rowNumber} 行：{error.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setPreview(undefined)}>
                取消
              </Button>
              <Button variant="secondary" disabled={preview.errors.length > 0} onClick={() => handleImport('merge')}>
                合并
              </Button>
              <Button disabled={preview.errors.length > 0} onClick={() => handleImport('overwrite')}>
                覆盖同 ID 记录
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-white p-4">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-2 truncate text-2xl font-semibold text-strong">{value}</div>
    </div>
  )
}
