import { describe, expect, it } from 'vitest'
import { defaultGradingProfile, DEFAULT_GRADING_PROFILE_ID } from '../config/gradingProfile'
import type { AssessmentComponent, Course } from '../types/domain'
import {
  calculateHistoricalCumulativeGpa,
  calculateProjectedCumulativeGpa,
  calculateSemesterPredictedGpa,
  groupComponentsByCourse
} from '../utils/gpaMath'

function course(id: string, credits: number, includeInGpa = true, officialGpa?: number): Course {
  return {
    id,
    termId: officialGpa === undefined ? 'current' : 'history',
    code: id,
    name: id,
    credits,
    includeInGpa,
    status: officialGpa === undefined ? 'in_progress' : 'completed',
    officialGpa,
    gradingProfileId: DEFAULT_GRADING_PROFILE_ID,
    createdAt: '',
    updatedAt: ''
  }
}

function component(courseId: string, score: number | undefined, status: AssessmentComponent['scoreStatus'] = 'predicted'): AssessmentComponent {
  return {
    id: `${courseId}-${status}`,
    courseId,
    name: 'final',
    weightPercent: 100,
    earnedPoints: score,
    maxPoints: 100,
    scoreStatus: status,
    order: 1,
    createdAt: '',
    updatedAt: ''
  }
}

describe('gpaMath', () => {
  it('calculates credit-weighted semester GPA', () => {
    const courses = [course('a', 4), course('b', 2)]
    const map = groupComponentsByCourse([component('a', 90), component('b', 75)])
    const result = calculateSemesterPredictedGpa(courses, map, [defaultGradingProfile])

    expect(result.gpa).toBeCloseTo((4 * 4 + 2 * 3) / 6)
  })

  it('excludes includeInGpa=false courses', () => {
    const courses = [course('a', 4), course('b', 4, false)]
    const map = groupComponentsByCourse([component('a', 90), component('b', 40)])
    const result = calculateSemesterPredictedGpa(courses, map, [defaultGradingProfile])

    expect(result.usedCourses).toBe(1)
    expect(result.gpa).toBe(4)
  })

  it('excludes courses without complete predictions', () => {
    const courses = [course('a', 4), course('b', 4)]
    const map = groupComponentsByCourse([component('a', 90), component('b', undefined, 'unknown')])
    const result = calculateSemesterPredictedGpa(courses, map, [defaultGradingProfile])

    expect(result.usedCourses).toBe(1)
    expect(result.totalCourses).toBe(2)
  })

  it('calculates historical cumulative GPA', () => {
    const result = calculateHistoricalCumulativeGpa([course('a', 4, true, 4), course('b', 2, true, 3)])

    expect(result.gpa).toBeCloseTo((4 * 4 + 2 * 3) / 6)
  })

  it('calculates projected cumulative GPA', () => {
    const history = [course('h', 4, true, 3)]
    const current = [course('a', 4)]
    const map = groupComponentsByCourse([component('a', 90)])
    const result = calculateProjectedCumulativeGpa(history, current, map, [defaultGradingProfile])

    expect(result.gpa).toBeCloseTo((4 * 3 + 4 * 4) / 8)
  })
})
