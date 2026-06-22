import Papa from 'papaparse'
import { z } from 'zod'
import { defaultGradingProfile, UTS_GRADING_PROFILE_ID } from '../../config/gradingProfile'
import { CSV_COLUMNS, type CsvImportError, type CsvImportMode, type CsvPreview, type CsvRow } from '../../types/csv'
import type { AssessmentComponent, Course, Term } from '../../types/domain'
import { nowIso } from '../../utils/format'
import { getGpaFromUniversityScore } from '../../utils/gradeMath'
import { db } from '../../db/database'
import { markWorkspaceDirty } from '../workspace/workspaceStore'

const SCHEMA_VERSION = '1'
const BOM = '\uFEFF'

interface CsvDataSet {
  terms: Term[]
  courses: Course[]
  components: AssessmentComponent[]
}

const csvRawRowSchema = z.object(
  CSV_COLUMNS.reduce(
    (shape, column) => ({
      ...shape,
      [column]: z.string()
    }),
    {} as Record<(typeof CSV_COLUMNS)[number], z.ZodString>
  )
)

const seasonSchema = z.enum(['spring', 'summer', 'autumn', 'winter'])
const courseStatusSchema = z.enum(['not_started', 'in_progress', 'completed'])
const componentStatusSchema = z.enum(['actual', 'predicted', 'unknown'])

function value(row: CsvRow, column: keyof CsvRow): string {
  return row[column].trim()
}

function required(row: CsvRow, column: keyof CsvRow, rowNumber: number, errors: CsvImportError[]): string {
  const fieldValue = value(row, column)
  if (!fieldValue) {
    errors.push({ rowNumber, message: `缺少必填列 ${String(column)}` })
  }
  return fieldValue
}

function parseNumber(
  row: CsvRow,
  column: keyof CsvRow,
  rowNumber: number,
  errors: CsvImportError[],
  options: { required?: boolean; min?: number; max?: number } = {}
): number | undefined {
  const fieldValue = value(row, column)
  if (!fieldValue) {
    if (options.required) {
      errors.push({ rowNumber, message: `${String(column)} 必须填写数字` })
    }
    return undefined
  }

  const parsed = Number(fieldValue)
  if (!Number.isFinite(parsed)) {
    errors.push({ rowNumber, message: `${String(column)} 不是合法数字` })
    return undefined
  }

  if (options.min !== undefined && parsed < options.min) {
    errors.push({ rowNumber, message: `${String(column)} 不能小于 ${options.min}` })
  }

  if (options.max !== undefined && parsed > options.max) {
    errors.push({ rowNumber, message: `${String(column)} 不能大于 ${options.max}` })
  }

  return parsed
}

function toCsvRow(term: Term, course: Course, component?: AssessmentComponent): CsvRow {
  return {
    schema_version: SCHEMA_VERSION,
    term_id: term.id,
    term_name: term.name,
    academic_year: term.academicYear,
    season: term.season,
    course_id: course.id,
    course_code: course.code,
    course_name: course.name,
    credits: String(course.credits),
    include_in_gpa: course.includeInGpa ? 'true' : 'false',
    course_status: course.status,
    target_university_score: course.targetUniversityScore?.toString() ?? '',
    official_raw_score: course.officialRawScore?.toString() ?? '',
    official_university_score: course.officialUniversityScore?.toString() ?? '',
    official_gpa: course.officialGpa?.toString() ?? '',
    grading_profile_id: course.gradingProfileId,
    component_id: component?.id ?? '',
    component_name: component?.name ?? '',
    component_weight_percent: component?.weightPercent.toString() ?? '',
    component_earned_points: component?.earnedPoints?.toString() ?? '',
    component_max_points: component?.maxPoints.toString() ?? '',
    component_score_status: component?.scoreStatus ?? '',
    component_order: component?.order.toString() ?? '',
    created_at: course.createdAt,
    updated_at: course.updatedAt
  }
}

export function buildCsvRows(terms: Term[], courses: Course[], components: AssessmentComponent[]): CsvRow[] {
  const termsById = new Map(terms.map((term) => [term.id, term]))
  const componentsByCourse = components.reduce((map, component) => {
    const list = map.get(component.courseId) ?? []
    list.push(component)
    map.set(component.courseId, list)
    return map
  }, new Map<string, AssessmentComponent[]>())

  return courses.flatMap((course) => {
    const term = termsById.get(course.termId)
    if (!term) {
      return []
    }

    const courseComponents = [...(componentsByCourse.get(course.id) ?? [])].sort((a, b) => a.order - b.order)
    if (courseComponents.length === 0) {
      return [toCsvRow(term, course)]
    }

    return courseComponents.map((component) => toCsvRow(term, course, component))
  })
}

export function exportCsvString(terms: Term[], courses: Course[], components: AssessmentComponent[]): string {
  const rows = buildCsvRows(terms, courses, components)
  return `${BOM}${Papa.unparse(rows, { columns: [...CSV_COLUMNS] })}`
}

function parseRows(csvText: string): { rows: CsvRow[]; errors: CsvImportError[] } {
  const parseResult = Papa.parse<Record<string, string>>(csvText.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: true
  })
  const errors: CsvImportError[] = parseResult.errors.map((error) => ({
    rowNumber: (error.row ?? 0) + 2,
    message: error.message
  }))

  const fields = parseResult.meta.fields ?? []
  for (const column of CSV_COLUMNS) {
    if (!fields.includes(column)) {
      errors.push({ rowNumber: 1, message: `缺少必填列 ${column}` })
    }
  }

  const rows: CsvRow[] = []
  parseResult.data.forEach((rawRow, index) => {
    const normalized = CSV_COLUMNS.reduce(
      (row, column) => ({ ...row, [column]: rawRow[column] ?? '' }),
      {} as CsvRow
    )
    const parsed = csvRawRowSchema.safeParse(normalized)
    if (!parsed.success) {
      errors.push({ rowNumber: index + 2, message: 'CSV 行结构无效' })
      return
    }
    rows.push(parsed.data)
  })

  if (rows.length === 0 && errors.length === 0) {
    errors.push({ rowNumber: 1, message: 'CSV 文件为空' })
  }

  return { rows, errors }
}

export function parseCsvData(csvText: string): { data: CsvDataSet; errors: CsvImportError[] } {
  const { rows, errors } = parseRows(csvText)
  const termMap = new Map<string, Term>()
  const courseMap = new Map<string, Course>()
  const componentMap = new Map<string, AssessmentComponent>()
  const componentIdsByCourse = new Map<string, Set<string>>()
  const now = nowIso()

  rows.forEach((row, index) => {
    const rowNumber = index + 2
    const termId = required(row, 'term_id', rowNumber, errors)
    const courseId = required(row, 'course_id', rowNumber, errors)
    const seasonValue = seasonSchema.safeParse(value(row, 'season'))
    const courseStatusValue = courseStatusSchema.safeParse(value(row, 'course_status'))
    const credits = parseNumber(row, 'credits', rowNumber, errors, { required: true, min: 0.01, max: 30 })
    const targetUniversityScore = parseNumber(row, 'target_university_score', rowNumber, errors, { min: 0, max: 100 })
    const officialRawScore = parseNumber(row, 'official_raw_score', rowNumber, errors, { min: 0, max: 100 })
    const officialUniversityScore = parseNumber(row, 'official_university_score', rowNumber, errors, {
      min: 0,
      max: 100
    })
    const officialGpa = parseNumber(row, 'official_gpa', rowNumber, errors, { min: 0, max: 4 })
    const gradingProfileId = required(row, 'grading_profile_id', rowNumber, errors)
    const isUtsProfile = gradingProfileId === UTS_GRADING_PROFILE_ID
    const normalizedOfficialScore = !isUtsProfile ? officialRawScore ?? officialUniversityScore : undefined
    const normalizedOfficialRawScore = isUtsProfile ? officialRawScore : normalizedOfficialScore
    const normalizedOfficialUniversityScore = isUtsProfile ? officialUniversityScore : normalizedOfficialScore
    const normalizedOfficialGpa =
      !isUtsProfile && normalizedOfficialScore !== undefined
        ? getGpaFromUniversityScore(normalizedOfficialScore, defaultGradingProfile)
        : officialGpa

    if (!seasonValue.success) {
      errors.push({ rowNumber, message: '无效 term season' })
    }
    if (!courseStatusValue.success) {
      errors.push({ rowNumber, message: '无效 course status' })
    }

    if (termId && seasonValue.success && !termMap.has(termId)) {
      termMap.set(termId, {
        id: termId,
        name: required(row, 'term_name', rowNumber, errors),
        academicYear: required(row, 'academic_year', rowNumber, errors),
        season: seasonValue.data,
        sortOrder: termMap.size + 1,
        isCurrent: false,
        createdAt: value(row, 'created_at') || now,
        updatedAt: value(row, 'updated_at') || now
      })
    }

    if (courseId && courseStatusValue.success && credits !== undefined && !courseMap.has(courseId)) {
      courseMap.set(courseId, {
        id: courseId,
        termId,
        code: required(row, 'course_code', rowNumber, errors),
        name: required(row, 'course_name', rowNumber, errors),
        credits,
        includeInGpa: value(row, 'include_in_gpa') !== 'false',
        status: courseStatusValue.data,
        targetUniversityScore,
        officialRawScore: normalizedOfficialRawScore,
        officialUniversityScore: normalizedOfficialUniversityScore,
        officialGpa: normalizedOfficialGpa,
        courseType: isUtsProfile ? 'uts' : 'shu',
        gradingProfileId,
        createdAt: value(row, 'created_at') || now,
        updatedAt: value(row, 'updated_at') || now
      })
    }

    const componentId = value(row, 'component_id')
    if (!componentId) {
      return
    }

    const componentStatusValue = componentStatusSchema.safeParse(value(row, 'component_score_status'))
    const weightPercent = parseNumber(row, 'component_weight_percent', rowNumber, errors, {
      required: true,
      min: 0,
      max: 100
    })
    const earnedPoints = parseNumber(row, 'component_earned_points', rowNumber, errors, { min: 0 })
    const maxPoints = parseNumber(row, 'component_max_points', rowNumber, errors, { required: true, min: 0.01 })
    const order = parseNumber(row, 'component_order', rowNumber, errors, { required: true, min: 0 })

    if (!componentStatusValue.success) {
      errors.push({ rowNumber, message: '无效 component status' })
      return
    }

    const idsForCourse = componentIdsByCourse.get(courseId) ?? new Set<string>()
    if (idsForCourse.has(componentId)) {
      errors.push({ rowNumber, message: `同一课程重复 component_id：${componentId}` })
      return
    }
    idsForCourse.add(componentId)
    componentIdsByCourse.set(courseId, idsForCourse)

    if (earnedPoints !== undefined && maxPoints !== undefined && earnedPoints > maxPoints) {
      errors.push({ rowNumber, message: 'component_earned_points 不能大于 component_max_points' })
    }

    if (weightPercent !== undefined && maxPoints !== undefined && order !== undefined) {
      componentMap.set(componentId, {
        id: componentId,
        courseId,
        name: required(row, 'component_name', rowNumber, errors),
        weightPercent,
        earnedPoints: componentStatusValue.data === 'unknown' ? undefined : earnedPoints,
        maxPoints,
        scoreStatus: componentStatusValue.data,
        order,
        createdAt: value(row, 'created_at') || now,
        updatedAt: value(row, 'updated_at') || now
      })
    }
  })

  return {
    data: {
      terms: [...termMap.values()],
      courses: [...courseMap.values()],
      components: [...componentMap.values()]
    },
    errors
  }
}

export async function previewCsvImport(csvText: string): Promise<CsvPreview> {
  const parsed = parseCsvData(csvText)
  const [existingTerms, existingCourses, existingComponents] = await Promise.all([
    db.terms.bulkGet(parsed.data.terms.map((term) => term.id)),
    db.courses.bulkGet(parsed.data.courses.map((course) => course.id)),
    db.components.bulkGet(parsed.data.components.map((component) => component.id))
  ])

  const conflicts = [...existingTerms, ...existingCourses, ...existingComponents].filter(Boolean).length
  return {
    terms: parsed.data.terms.length,
    courses: parsed.data.courses.length,
    components: parsed.data.components.length,
    errors: parsed.errors,
    conflicts
  }
}

export async function importCsvData(csvText: string, mode: CsvImportMode): Promise<CsvPreview> {
  const preview = await previewCsvImport(csvText)
  if (preview.errors.length > 0) {
    return preview
  }

  const parsed = parseCsvData(csvText)
  await db.transaction('rw', db.terms, db.courses, db.components, async () => {
    if (mode === 'overwrite') {
      await Promise.all([
        db.terms.bulkDelete(parsed.data.terms.map((term) => term.id)),
        db.courses.bulkDelete(parsed.data.courses.map((course) => course.id)),
        db.components.bulkDelete(parsed.data.components.map((component) => component.id))
      ])
    }

    await db.terms.bulkPut(parsed.data.terms)
    await db.courses.bulkPut(parsed.data.courses)
    await db.components.bulkPut(parsed.data.components)
  })

  markWorkspaceDirty()
  return preview
}

export function csvFileName(date = new Date()): string {
  const pad = (valueToPad: number) => String(valueToPad).padStart(2, '0')
  return `gradepilot-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(
    date.getHours()
  )}${pad(date.getMinutes())}.csv`
}
