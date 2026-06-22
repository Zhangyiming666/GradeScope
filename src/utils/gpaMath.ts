import type { AssessmentComponent, Course, CoursePrediction, GradingProfile, Term } from '../types/domain'
import { calculateCoursePrediction } from './gradeMath'
import { getProfileForCourse } from '../config/gradingProfile'

export interface WeightedGpaResult {
  gpa?: number
  averageScore?: number
  averageScoreCredits: number
  usedCredits: number
  totalCredits: number
  usedCourses: number
  totalCourses: number
}

export interface CumulativeGpaResult {
  gpa?: number
  averageScore?: number
  averageScoreCredits: number
  credits: number
  courses: number
}

export interface TrendPoint {
  termId: string
  termName: string
  cumulativeCredits: number
  cumulativeGpa: number
  cumulativeAverageScore?: number
  isProjected: boolean
}

export function groupComponentsByCourse(components: AssessmentComponent[]): Map<string, AssessmentComponent[]> {
  return components.reduce((map, component) => {
    const list = map.get(component.courseId) ?? []
    list.push(component)
    map.set(component.courseId, list)
    return map
  }, new Map<string, AssessmentComponent[]>())
}

export function getCoursePrediction(
  course: Course,
  components: AssessmentComponent[],
  profiles: GradingProfile[]
): CoursePrediction | undefined {
  const profile = getProfileForCourse(course, profiles)
  if (course.officialRawScore !== undefined && course.officialUniversityScore !== undefined && course.officialGpa !== undefined) {
    return {
      rawScore: course.officialRawScore,
      universityScore: course.officialUniversityScore,
      gpa: course.officialGpa,
      gradeLabel: calculateCoursePrediction(components, profile, course)?.gradeLabel
    }
  }

  return calculateCoursePrediction(components, profile, course)
}

export function calculateSemesterPredictedGpa(
  courses: Course[],
  componentsByCourse: Map<string, AssessmentComponent[]>,
  profiles: GradingProfile[]
): WeightedGpaResult {
  const included = courses.filter((course) => course.includeInGpa)
  const totals = included.reduce(
    (acc, course) => {
      const prediction = getCoursePrediction(
        course,
        componentsByCourse.get(course.id) ?? [],
        profiles
      )
      if (prediction) {
        acc.qualityPoints += prediction.gpa * course.credits
        acc.scorePoints += prediction.universityScore * course.credits
        acc.usedCredits += course.credits
        acc.usedCourses += 1
      }
      acc.totalCredits += course.credits
      return acc
    },
    { qualityPoints: 0, scorePoints: 0, usedCredits: 0, totalCredits: 0, usedCourses: 0 }
  )

  return {
    gpa: totals.usedCredits > 0 ? totals.qualityPoints / totals.usedCredits : undefined,
    averageScore: totals.usedCredits > 0 ? totals.scorePoints / totals.usedCredits : undefined,
    averageScoreCredits: totals.usedCredits,
    usedCredits: totals.usedCredits,
    totalCredits: totals.totalCredits,
    usedCourses: totals.usedCourses,
    totalCourses: included.length
  }
}

export function calculateHistoricalCumulativeGpa(courses: Course[]): CumulativeGpaResult {
  const included = courses.filter(
    (course) =>
      course.includeInGpa &&
      course.status === 'completed' &&
      course.officialGpa !== undefined
  )
  const qualityPoints = included.reduce((sum, course) => sum + (course.officialGpa ?? 0) * course.credits, 0)
  const scoreIncluded = included.filter((course) => course.officialUniversityScore !== undefined)
  const scorePoints = scoreIncluded.reduce((sum, course) => sum + (course.officialUniversityScore ?? 0) * course.credits, 0)
  const credits = included.reduce((sum, course) => sum + course.credits, 0)
  const scoreCredits = scoreIncluded.reduce((sum, course) => sum + course.credits, 0)

  return {
    gpa: credits > 0 ? qualityPoints / credits : undefined,
    averageScore: scoreCredits > 0 ? scorePoints / scoreCredits : undefined,
    averageScoreCredits: scoreCredits,
    credits,
    courses: included.length
  }
}

export function calculateProjectedCumulativeGpa(
  historicalCourses: Course[],
  currentCourses: Course[],
  componentsByCourse: Map<string, AssessmentComponent[]>,
  profiles: GradingProfile[]
): CumulativeGpaResult {
  const historical = calculateHistoricalCumulativeGpa(historicalCourses)
  const current = calculateSemesterPredictedGpa(currentCourses, componentsByCourse, profiles)
  const historicalQualityPoints = (historical.gpa ?? 0) * historical.credits
  const historicalScorePoints = (historical.averageScore ?? 0) * historical.averageScoreCredits
  const currentQualityPoints = (current.gpa ?? 0) * current.usedCredits
  const currentScorePoints = (current.averageScore ?? 0) * current.averageScoreCredits
  const credits = historical.credits + current.usedCredits
  const scoreCredits = historical.averageScoreCredits + current.averageScoreCredits

  return {
    gpa: credits > 0 ? (historicalQualityPoints + currentQualityPoints) / credits : undefined,
    averageScore: scoreCredits > 0 ? (historicalScorePoints + currentScorePoints) / scoreCredits : undefined,
    averageScoreCredits: scoreCredits,
    credits,
    courses: historical.courses + current.usedCourses
  }
}

export function buildGpaTrend(
  terms: Term[],
  courses: Course[],
  currentTermId: string,
  componentsByCourse: Map<string, AssessmentComponent[]>,
  profiles: GradingProfile[]
): TrendPoint[] {
  const sortedTerms = [...terms].sort((a, b) => a.sortOrder - b.sortOrder)
  let qualityPoints = 0
  let scorePoints = 0
  let credits = 0
  let scoreCredits = 0
  const points: TrendPoint[] = []

  for (const term of sortedTerms) {
    const termCourses = courses.filter((course) => course.termId === term.id && course.includeInGpa)
    const isCurrent = term.id === currentTermId

    for (const course of termCourses) {
      if (isCurrent) {
        const prediction = getCoursePrediction(
          course,
          componentsByCourse.get(course.id) ?? [],
          profiles
        )
        if (prediction) {
          qualityPoints += prediction.gpa * course.credits
          scorePoints += prediction.universityScore * course.credits
          credits += course.credits
          scoreCredits += course.credits
        }
      } else if (course.status === 'completed' && course.officialGpa !== undefined && course.officialUniversityScore !== undefined) {
        qualityPoints += course.officialGpa * course.credits
        scorePoints += course.officialUniversityScore * course.credits
        credits += course.credits
        scoreCredits += course.credits
      } else if (course.status === 'completed' && course.officialGpa !== undefined) {
        qualityPoints += course.officialGpa * course.credits
        credits += course.credits
      }
    }

    if (credits > 0) {
      points.push({
        termId: term.id,
        termName: term.name,
        cumulativeCredits: credits,
        cumulativeGpa: qualityPoints / credits,
        cumulativeAverageScore: scoreCredits > 0 ? scorePoints / scoreCredits : undefined,
        isProjected: isCurrent
      })
    }
  }

  return points
}
