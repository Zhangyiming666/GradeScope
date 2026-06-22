export type TermSeason = 'spring' | 'summer' | 'autumn' | 'winter'

export interface Term {
  id: string
  name: string
  academicYear: string
  season: TermSeason
  startDate?: string
  endDate?: string
  sortOrder: number
  isCurrent: boolean
  createdAt: string
  updatedAt: string
}

export type CourseStatus = 'not_started' | 'in_progress' | 'completed'
export type CourseType = 'shu' | 'uts'

export interface Course {
  id: string
  termId: string
  code: string
  name: string
  credits: number
  includeInGpa: boolean
  status: CourseStatus
  targetUniversityScore?: number
  officialRawScore?: number
  officialUniversityScore?: number
  officialGpa?: number
  courseType?: CourseType
  gradingProfileId: string
  createdAt: string
  updatedAt: string
}

export type ComponentScoreStatus = 'actual' | 'predicted' | 'unknown'
export type GradeLabel = 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C' | 'D' | 'F' | 'HD' | 'CR' | 'P'

export interface AssessmentComponent {
  id: string
  courseId: string
  name: string
  weightPercent: number
  earnedPoints?: number
  maxPoints: number
  scoreStatus: ComponentScoreStatus
  order: number
  createdAt: string
  updatedAt: string
}

export interface GradingProfile {
  id: string
  name: string
  linearConversion: {
    multiplier: number
    offset: number
    min: number
    max: number
  }
  gradeBands: Array<{
    min: number
    max: number
    label: GradeLabel
  }>
  gpaBands: Array<{
    min: number
    max: number
    gpa: number
  }>
}

export interface AppSetting {
  key: string
  value: string
}

export interface CourseWithComponents {
  course: Course
  components: AssessmentComponent[]
}

export interface CoursePrediction {
  rawScore: number
  universityScore: number
  gpa: number
  gradeLabel?: GradeLabel
}
