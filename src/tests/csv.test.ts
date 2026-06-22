import { describe, expect, it } from 'vitest'
import { DEFAULT_GRADING_PROFILE_ID } from '../config/gradingProfile'
import { CSV_COLUMNS } from '../types/csv'
import type { AssessmentComponent, Course, Term } from '../types/domain'
import { exportCsvString, parseCsvData } from '../features/importExport/csv'

const term: Term = {
  id: 'term',
  name: '中文学期',
  academicYear: '2024-2025',
  season: 'spring',
  sortOrder: 1,
  isCurrent: true,
  createdAt: '',
  updatedAt: ''
}

const course: Course = {
  id: 'course',
  termId: 'term',
  code: 'ACCT1001',
  name: '会计学',
  credits: 4,
  includeInGpa: true,
  status: 'in_progress',
  targetUniversityScore: 90,
  gradingProfileId: DEFAULT_GRADING_PROFILE_ID,
  createdAt: '',
  updatedAt: ''
}

const component: AssessmentComponent = {
  id: 'component',
  courseId: 'course',
  name: '期末考试',
  weightPercent: 40,
  earnedPoints: undefined,
  maxPoints: 100,
  scoreStatus: 'unknown',
  order: 1,
  createdAt: '',
  updatedAt: ''
}

describe('CSV import/export', () => {
  it('exports and imports equivalent data', () => {
    const csv = exportCsvString([term], [course], [component])
    const parsed = parseCsvData(csv)

    expect(parsed.errors).toHaveLength(0)
    expect(parsed.data.terms[0].name).toBe('中文学期')
    expect(parsed.data.courses[0].name).toBe('会计学')
    expect(parsed.data.components[0].name).toBe('期末考试')
  })

  it('exports UTF-8 BOM for Chinese fields', () => {
    const csv = exportCsvString([term], [course], [component])

    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('会计学')
  })

  it('returns row numbers for bad rows', () => {
    const header = CSV_COLUMNS.join(',')
    const row = [
      '1',
      'term',
      '学期',
      '2024',
      'spring',
      'course',
      'CODE',
      '课程',
      '4',
      'true',
      'in_progress',
      '',
      '',
      '',
      '',
      DEFAULT_GRADING_PROFILE_ID,
      'cmp',
      '项目',
      '120',
      '30',
      '20',
      'actual',
      '1',
      '',
      ''
    ].join(',')
    const parsed = parseCsvData(`${header}\n${row}`)

    expect(parsed.errors.some((error) => error.rowNumber === 2)).toBe(true)
  })

  it('normalizes imported Shanghai University official scores to the current GPA table', () => {
    const header = CSV_COLUMNS.join(',')
    const row = [
      '1',
      'term',
      '学期',
      '2024',
      'spring',
      'course',
      'CODE',
      '课程',
      '4',
      'true',
      'completed',
      '',
      '78',
      '82.4',
      '3.3',
      DEFAULT_GRADING_PROFILE_ID,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    ].join(',')
    const parsed = parseCsvData(`${header}\n${row}`)

    expect(parsed.errors).toHaveLength(0)
    expect(parsed.data.courses[0].officialRawScore).toBe(78)
    expect(parsed.data.courses[0].officialUniversityScore).toBe(78)
    expect(parsed.data.courses[0].officialGpa).toBe(3)
  })
})
