import { describe, expect, it } from 'vitest'
import { defaultGradingProfile, utsGradingProfile } from '../config/gradingProfile'
import type { Course } from '../types/domain'
import {
  calculateCoursePrediction,
  convertRawToUniversity,
  getGpaFromUniversityScore,
  getGradeLabel,
  inverseConvertUniversityToRaw,
  safeWeightedContribution,
  validateAssessmentComponent
} from '../utils/gradeMath'

describe('gradeMath', () => {
  it('uses identity conversion for Shanghai University course scores', () => {
    expect(convertRawToUniversity(87.5, defaultGradingProfile)).toBe(87.5)
  })

  it('uses target course score directly as raw target', () => {
    expect(inverseConvertUniversityToRaw(90, defaultGradingProfile)).toBe(90)
  })

  it('clamps raw conversion boundaries', () => {
    expect(convertRawToUniversity(200, defaultGradingProfile)).toBe(100)
    expect(inverseConvertUniversityToRaw(-20, defaultGradingProfile)).toBe(0)
  })

  it('respects grade label boundaries', () => {
    expect(getGradeLabel(59.999, defaultGradingProfile)).toBe('F')
    expect(getGradeLabel(60, defaultGradingProfile)).toBe('D')
    expect(getGradeLabel(65, defaultGradingProfile)).toBe('C')
    expect(getGradeLabel(70, defaultGradingProfile)).toBe('B-')
    expect(getGradeLabel(75, defaultGradingProfile)).toBe('B')
    expect(getGradeLabel(80, defaultGradingProfile)).toBe('B+')
    expect(getGradeLabel(85, defaultGradingProfile)).toBe('A-')
    expect(getGradeLabel(90, defaultGradingProfile)).toBe('A')
  })

  it('respects GPA band boundaries', () => {
    expect(getGpaFromUniversityScore(59.999, defaultGradingProfile)).toBe(0)
    expect(getGpaFromUniversityScore(60, defaultGradingProfile)).toBe(1.5)
    expect(getGpaFromUniversityScore(65, defaultGradingProfile)).toBe(2.5)
    expect(getGpaFromUniversityScore(75, defaultGradingProfile)).toBe(3)
    expect(getGpaFromUniversityScore(85, defaultGradingProfile)).toBe(3.7)
    expect(getGpaFromUniversityScore(89.999, defaultGradingProfile)).toBe(3.7)
    expect(getGpaFromUniversityScore(90, defaultGradingProfile)).toBe(4)
  })

  it('assigns Shanghai University letter labels instead of UTS labels', () => {
    const course: Course = {
      id: 'course',
      termId: 'term',
      code: 'SHU',
      name: '上大课程',
      credits: 4,
      includeInGpa: true,
      status: 'in_progress',
      courseType: 'shu',
      gradingProfileId: defaultGradingProfile.id,
      createdAt: '',
      updatedAt: ''
    }
    const prediction = calculateCoursePrediction(
      [
        {
          id: 'component',
          courseId: 'course',
          name: '总评',
          weightPercent: 100,
          earnedPoints: 95,
          maxPoints: 100,
          scoreStatus: 'actual',
          order: 1,
          createdAt: '',
          updatedAt: ''
        }
      ],
      defaultGradingProfile,
      course
    )

    expect(prediction?.gradeLabel).toBe('A')
  })

  it('keeps HD labels for UTS courses only', () => {
    expect(getGradeLabel(84.999, utsGradingProfile)).toBe('D')
    expect(getGradeLabel(85, utsGradingProfile)).toBe('HD')
  })

  it('treats scores above max as editable invalid data instead of throwing', () => {
    const component = {
      id: 'component',
      courseId: 'course',
      name: '期末',
      weightPercent: 100,
      earnedPoints: 120,
      maxPoints: 100,
      scoreStatus: 'actual' as const,
      order: 1,
      createdAt: '',
      updatedAt: ''
    }

    expect(validateAssessmentComponent(component)).toContainEqual({
      field: 'earnedPoints',
      message: '已得分不能大于满分'
    })
    expect(safeWeightedContribution(component)).toBeUndefined()
    expect(calculateCoursePrediction([component], defaultGradingProfile)).toBeUndefined()
  })

  it('recovers calculations after invalid max score is corrected', () => {
    const component = {
      id: 'component',
      courseId: 'course',
      name: '期末',
      weightPercent: 100,
      earnedPoints: 120,
      maxPoints: 120,
      scoreStatus: 'actual' as const,
      order: 1,
      createdAt: '',
      updatedAt: ''
    }

    expect(validateAssessmentComponent(component)).toHaveLength(0)
    expect(calculateCoursePrediction([component], defaultGradingProfile)?.rawScore).toBe(100)
  })
})
