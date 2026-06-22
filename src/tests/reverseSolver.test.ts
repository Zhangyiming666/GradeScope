import { describe, expect, it } from 'vitest'
import { defaultGradingProfile } from '../config/gradingProfile'
import type { AssessmentComponent } from '../types/domain'
import { reverseSolve } from '../utils/reverseSolver'

function component(
  id: string,
  weightPercent: number,
  earnedPoints: number | undefined,
  scoreStatus: AssessmentComponent['scoreStatus']
): AssessmentComponent {
  return {
    id,
    courseId: 'course',
    name: id,
    weightPercent,
    earnedPoints,
    maxPoints: 100,
    scoreStatus,
    order: 1,
    createdAt: '',
    updatedAt: ''
  }
}

describe('reverseSolver', () => {
  it('solves the seed accounting case with one unknown item', () => {
    const result = reverseSolve({
      targetUniversityScore: 90,
      profile: defaultGradingProfile,
      components: [
        component('homework', 20, 92, 'actual'),
        component('presentation', 10, 85, 'actual'),
        component('participation', 5, 90, 'actual'),
        component('midterm', 25, 88, 'actual'),
        component('final', 40, undefined, 'unknown')
      ]
    })

    expect(result.status).toBe('feasible')
    expect(result.exactRequiredComponent?.componentId).toBe('final')
    expect(result.exactRequiredComponent?.requiredScore).toBeCloseTo(91.5)
  })

  it('uses target course score directly for Shanghai University courses', () => {
    const result = reverseSolve({
      targetUniversityScore: 90,
      profile: defaultGradingProfile,
      components: [component('regular', 40, 100, 'actual'), component('final', 60, undefined, 'unknown')]
    })

    expect(result.status).toBe('feasible')
    expect(result.requiredUnknownContribution).toBeCloseTo(50)
    expect(result.exactRequiredComponent?.requiredScore).toBeCloseTo(83.333333)
  })

  it('marks a single unknown item above 100 as impossible', () => {
    const result = reverseSolve({
      targetUniversityScore: 100,
      profile: defaultGradingProfile,
      components: [component('known', 50, 40, 'actual'), component('final', 50, undefined, 'unknown')]
    })

    expect(result.status).toBe('impossible')
    expect(result.exactRequiredComponent?.requiredScore).toBeGreaterThan(100)
  })

  it('marks already achieved targets', () => {
    const result = reverseSolve({
      targetUniversityScore: 60,
      profile: defaultGradingProfile,
      components: [component('known', 80, 90, 'actual'), component('final', 20, undefined, 'unknown')]
    })

    expect(result.status).toBe('already_achieved')
  })

  it('returns an average for two unknown items', () => {
    const result = reverseSolve({
      targetUniversityScore: 84,
      profile: defaultGradingProfile,
      components: [component('known', 40, 80, 'actual'), component('a', 30, undefined, 'unknown'), component('b', 30, undefined, 'unknown')]
    })

    expect(result.status).toBe('feasible')
    expect(result.exactRequiredComponent).toBeUndefined()
    expect(result.requiredAverage).toBeCloseTo(86.666666)
  })

  it('locks one unknown and solves the remaining one', () => {
    const result = reverseSolve({
      targetUniversityScore: 92,
      profile: defaultGradingProfile,
      lockedScores: { a: 80 },
      components: [component('known', 40, 90, 'actual'), component('a', 30, undefined, 'unknown'), component('b', 30, undefined, 'unknown')]
    })

    expect(result.exactRequiredComponent?.componentId).toBe('b')
    expect(result.exactRequiredComponent?.requiredScore).toBeCloseTo(106.666666)
  })

  it('returns incomplete when unknown weight is zero', () => {
    const result = reverseSolve({
      targetUniversityScore: 90,
      profile: defaultGradingProfile,
      components: [component('known', 100, 80, 'actual')]
    })

    expect(result.status).toBe('incomplete')
  })

  it('returns incomplete when target is missing', () => {
    const result = reverseSolve({
      profile: defaultGradingProfile,
      components: [component('final', 100, undefined, 'unknown')]
    })

    expect(result.status).toBe('incomplete')
  })
})
