import { DEFAULT_GRADING_PROFILE_ID, defaultGradingProfile, gradingProfiles } from '../config/gradingProfile'
import { markWorkspaceDirty } from '../features/workspace/workspaceStore'
import type { AssessmentComponent, Course, Term } from '../types/domain'
import { nowIso } from '../utils/format'
import { getGpaFromUniversityScore } from '../utils/gradeMath'
import { db } from './database'

const createdAt = '2026-06-21T00:00:00.000Z'
const gradeRulesVersion = 'shu-subject-results-table-2026-06-21'

function stamp<T extends object>(value: T): T & { createdAt: string; updatedAt: string } {
  return {
    ...value,
    createdAt,
    updatedAt: createdAt
  }
}

export const seedTerms: Term[] = [
  stamp({
    id: 'term-y1-autumn',
    name: '大一上',
    academicYear: '2022-2023',
    season: 'autumn',
    sortOrder: 1,
    isCurrent: false
  }),
  stamp({
    id: 'term-y1-spring',
    name: '大一下',
    academicYear: '2022-2023',
    season: 'spring',
    sortOrder: 2,
    isCurrent: false
  }),
  stamp({
    id: 'term-y2-autumn',
    name: '大二上',
    academicYear: '2023-2024',
    season: 'autumn',
    sortOrder: 3,
    isCurrent: false
  }),
  stamp({
    id: 'term-y2-spring',
    name: '大二下',
    academicYear: '2023-2024',
    season: 'spring',
    sortOrder: 4,
    isCurrent: false
  }),
  stamp({
    id: 'term-y3-autumn',
    name: '大三上',
    academicYear: '2024-2025',
    season: 'autumn',
    sortOrder: 5,
    isCurrent: false
  }),
  stamp({
    id: 'term-y3-winter',
    name: '大三冬',
    academicYear: '2024-2025',
    season: 'winter',
    sortOrder: 6,
    isCurrent: false
  }),
  stamp({
    id: 'term-current',
    name: '2024-2025 春季学期',
    academicYear: '2024-2025',
    season: 'spring',
    sortOrder: 7,
    isCurrent: true
  })
]

const historicalCourses: Course[] = [
  ['FIN201', '金融学', 'term-y1-autumn', 4, 93],
  ['MKT202', '市场营销', 'term-y1-autumn', 3, 88],
  ['MGMT101', '管理学原理', 'term-y1-autumn', 3, 84],
  ['ECON101', '微观经济学', 'term-y1-spring', 4, 86],
  ['ECON102', '宏观经济学', 'term-y1-spring', 4, 89],
  ['MATH115', '线性代数', 'term-y1-spring', 4, 84],
  ['STAT110', '概率论', 'term-y2-autumn', 4, 90],
  ['BUS202', '商业沟通', 'term-y2-autumn', 3, 82],
  ['ACC210', '管理会计', 'term-y2-autumn', 4, 78],
  ['FIN302', '公司金融', 'term-y2-spring', 4, 91],
  ['OM220', '运营管理', 'term-y2-spring', 3, 85],
  ['LAW200', '商法导论', 'term-y2-spring', 2, 80],
  ['DATA301', '数据分析导论', 'term-y3-autumn', 3, 92],
  ['HRM301', '组织行为学', 'term-y3-autumn', 3, 87],
  ['ETH201', '商业伦理', 'term-y3-autumn', 2, 83],
  ['RES310', '研究方法', 'term-y3-winter', 3, 88],
  ['IB300', '国际商务', 'term-y3-winter', 3, 81]
].map(([code, name, termId, credits, officialRawScore]) =>
  stamp({
    id: `course-${code}`,
    termId: String(termId),
    code: String(code),
    name: String(name),
    credits: Number(credits),
    includeInGpa: true,
    status: 'completed',
    officialRawScore: Number(officialRawScore),
    officialUniversityScore: Number(officialRawScore),
    officialGpa: getGpaFromUniversityScore(Number(officialRawScore), defaultGradingProfile),
    courseType: 'shu',
    gradingProfileId: DEFAULT_GRADING_PROFILE_ID
  })
)

const currentCourses: Course[] = [
  stamp({
    id: 'course-acct1001',
    termId: 'term-current',
    code: 'ACCT1001',
    name: '会计学',
    credits: 4,
    includeInGpa: true,
    status: 'in_progress',
    targetUniversityScore: 90,
    courseType: 'shu',
    gradingProfileId: DEFAULT_GRADING_PROFILE_ID
  }),
  stamp({
    id: 'course-econ201',
    termId: 'term-current',
    code: 'ECON201',
    name: '经济学',
    credits: 4,
    includeInGpa: true,
    status: 'in_progress',
    targetUniversityScore: 85,
    courseType: 'shu',
    gradingProfileId: DEFAULT_GRADING_PROFILE_ID
  }),
  stamp({
    id: 'course-stat210',
    termId: 'term-current',
    code: 'STAT210',
    name: '商务统计',
    credits: 4,
    includeInGpa: true,
    status: 'in_progress',
    targetUniversityScore: 90,
    courseType: 'shu',
    gradingProfileId: DEFAULT_GRADING_PROFILE_ID
  }),
  stamp({
    id: 'course-mgmt301',
    termId: 'term-current',
    code: 'MGMT301',
    name: '人员与组织管理',
    credits: 3,
    includeInGpa: true,
    status: 'in_progress',
    targetUniversityScore: 87,
    courseType: 'shu',
    gradingProfileId: DEFAULT_GRADING_PROFILE_ID
  }),
  stamp({
    id: 'course-writ100',
    termId: 'term-current',
    code: 'WRIT100',
    name: '学术写作',
    credits: 2,
    includeInGpa: true,
    status: 'in_progress',
    targetUniversityScore: 70,
    courseType: 'shu',
    gradingProfileId: DEFAULT_GRADING_PROFILE_ID
  })
]

function component(
  id: string,
  courseId: string,
  name: string,
  weightPercent: number,
  earnedPoints: number | undefined,
  maxPoints: number,
  scoreStatus: AssessmentComponent['scoreStatus'],
  order: number
): AssessmentComponent {
  return stamp({
    id,
    courseId,
    name,
    weightPercent,
    earnedPoints,
    maxPoints,
    scoreStatus,
    order
  })
}

export const seedComponents: AssessmentComponent[] = [
  component('cmp-acct-homework', 'course-acct1001', '平时作业', 20, 92, 100, 'actual', 1),
  component('cmp-acct-presentation', 'course-acct1001', '小组展示', 10, 85, 100, 'actual', 2),
  component('cmp-acct-participation', 'course-acct1001', '课堂参与', 5, 90, 100, 'actual', 3),
  component('cmp-acct-midterm', 'course-acct1001', '期中考试', 25, 88, 100, 'actual', 4),
  component('cmp-acct-final', 'course-acct1001', '期末考试', 40, undefined, 100, 'unknown', 5),
  component('cmp-econ-essay', 'course-econ201', '案例论文', 30, 82, 100, 'actual', 1),
  component('cmp-econ-quiz', 'course-econ201', '课堂测验', 20, 76, 100, 'actual', 2),
  component('cmp-econ-final', 'course-econ201', '期末考试', 50, 80, 100, 'predicted', 3),
  component('cmp-stat-homework', 'course-stat210', '作业', 20, 95, 100, 'actual', 1),
  component('cmp-stat-project', 'course-stat210', '数据项目', 30, 90, 100, 'predicted', 2),
  component('cmp-stat-final', 'course-stat210', '期末考试', 50, 88, 100, 'predicted', 3),
  component('cmp-mgmt-report', 'course-mgmt301', '小组报告', 35, 84, 100, 'actual', 1),
  component('cmp-mgmt-participation', 'course-mgmt301', '课堂参与', 15, 90, 100, 'actual', 2),
  component('cmp-mgmt-final', 'course-mgmt301', '期末反思', 50, undefined, 100, 'unknown', 3),
  component('cmp-writ-draft', 'course-writ100', '初稿', 30, 70, 100, 'actual', 1),
  component('cmp-writ-presentation', 'course-writ100', '展示', 20, undefined, 100, 'unknown', 2),
  component('cmp-writ-final', 'course-writ100', '终稿', 50, undefined, 100, 'unknown', 3)
]

async function migrateShanghaiGradeRules(): Promise<void> {
  const currentVersion = await db.appSettings.get('gradeRulesVersion')
  if (currentVersion?.value === gradeRulesVersion) {
    return
  }

  const courses = await db.courses.where('gradingProfileId').equals(DEFAULT_GRADING_PROFILE_ID).toArray()
  const migratedCourses: Course[] = []
  courses.forEach((course) => {
    const officialScore = course.officialRawScore ?? course.officialUniversityScore
    if (officialScore === undefined || course.courseType === 'uts') {
      return
    }

    migratedCourses.push({
      ...course,
      officialRawScore: officialScore,
      officialUniversityScore: officialScore,
      officialGpa: getGpaFromUniversityScore(officialScore, defaultGradingProfile),
      updatedAt: nowIso()
    })
  })

  await db.transaction('rw', db.courses, db.appSettings, async () => {
    if (migratedCourses.length > 0) {
      await db.courses.bulkPut(migratedCourses)
    }
    await db.appSettings.put({ key: 'gradeRulesVersion', value: gradeRulesVersion })
  })
  markWorkspaceDirty()
}

export async function seedDatabaseIfNeeded(): Promise<void> {
  await db.gradingProfiles.bulkPut(gradingProfiles)
  await migrateShanghaiGradeRules()

  const alreadySeeded = await db.appSettings.get('seedVersion')
  if (alreadySeeded) {
    return
  }

  await db.transaction('rw', db.terms, db.courses, db.components, db.gradingProfiles, db.appSettings, async () => {
    await db.terms.bulkPut(seedTerms)
    await db.courses.bulkPut([...historicalCourses, ...currentCourses])
    await db.components.bulkPut(seedComponents)
    await db.appSettings.put({ key: 'seedVersion', value: 'mvp-1.0' })
  })
}

export async function clearDemoData(): Promise<void> {
  await db.transaction('rw', db.terms, db.courses, db.components, db.gradingProfiles, db.appSettings, async () => {
    await db.terms.clear()
    await db.courses.clear()
    await db.components.clear()
    await db.gradingProfiles.clear()
    await db.appSettings.put({ key: 'clearedAt', value: nowIso() })
  })
}
