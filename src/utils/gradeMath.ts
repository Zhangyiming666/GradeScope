import { isUtsCourse } from '../config/gradingProfile'
import type { AssessmentComponent, Course, CoursePrediction, GradingProfile } from '../types/domain'

export const WEIGHT_TOLERANCE = 0.01

export interface ComponentValidationError {
  field: 'earnedPoints' | 'maxPoints'
  message: string
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function normalizePercent(earnedPoints: number, maxPoints: number): number {
  if (!isFiniteNumber(maxPoints) || maxPoints <= 0) {
    throw new Error('满分必须大于 0')
  }

  if (!isFiniteNumber(earnedPoints) || earnedPoints < 0 || earnedPoints > maxPoints) {
    throw new Error('当前得分必须在 0 到满分之间')
  }

  return (earnedPoints / maxPoints) * 100
}

export function validateAssessmentComponent(component: AssessmentComponent): ComponentValidationError[] {
  const errors: ComponentValidationError[] = []

  if (!isFiniteNumber(component.maxPoints) || component.maxPoints <= 0) {
    errors.push({ field: 'maxPoints', message: '满分必须大于 0' })
  }

  if (component.scoreStatus !== 'unknown') {
    if (component.earnedPoints === undefined || !isFiniteNumber(component.earnedPoints)) {
      errors.push({ field: 'earnedPoints', message: '请填写已得分' })
    } else if (component.earnedPoints < 0) {
      errors.push({ field: 'earnedPoints', message: '已得分不能小于 0' })
    } else if (component.maxPoints > 0 && component.earnedPoints > component.maxPoints) {
      errors.push({ field: 'earnedPoints', message: '已得分不能大于满分' })
    }
  }

  return errors
}

export function safeWeightedContribution(component: AssessmentComponent): number | undefined {
  if (component.scoreStatus === 'unknown' || component.earnedPoints === undefined) {
    return 0
  }

  if (validateAssessmentComponent(component).length > 0) {
    return undefined
  }

  return (normalizePercent(component.earnedPoints, component.maxPoints) * component.weightPercent) / 100
}

export function weightedContribution(component: AssessmentComponent): number {
  return safeWeightedContribution(component) ?? 0
}

export function convertRawToUniversity(rawScore: number, profile: GradingProfile): number {
  const { multiplier, offset, min, max } = profile.linearConversion
  return clamp(rawScore * multiplier + offset, min, max)
}

export function inverseConvertUniversityToRaw(universityScore: number, profile: GradingProfile): number {
  const { multiplier, offset, min, max } = profile.linearConversion
  return clamp((universityScore - offset) / multiplier, min, max)
}

export function getGradeLabel(rawScore: number, profile: GradingProfile): CoursePrediction['gradeLabel'] {
  const band = profile.gradeBands.find((item) => rawScore >= item.min && rawScore <= item.max)
  return band?.label ?? 'F'
}

export function getGpaFromUniversityScore(universityScore: number, profile: GradingProfile): number {
  const band = profile.gpaBands.find((item) => universityScore >= item.min && universityScore <= item.max)
  return band?.gpa ?? 0
}

export function totalWeight(components: AssessmentComponent[]): number {
  return components.reduce((sum, component) => sum + component.weightPercent, 0)
}

export function knownWeight(components: AssessmentComponent[]): number {
  return components
    .filter((component) => component.scoreStatus !== 'unknown' && component.earnedPoints !== undefined)
    .reduce((sum, component) => sum + component.weightPercent, 0)
}

export function unknownWeight(components: AssessmentComponent[]): number {
  return components
    .filter((component) => component.scoreStatus === 'unknown')
    .reduce((sum, component) => sum + component.weightPercent, 0)
}

export function knownContribution(components: AssessmentComponent[]): number {
  return components.reduce((sum, component) => sum + (safeWeightedContribution(component) ?? 0), 0)
}

export function hasInvalidComponents(components: AssessmentComponent[]): boolean {
  return components.some((component) => validateAssessmentComponent(component).length > 0)
}

export function hasValidTotalWeight(components: AssessmentComponent[]): boolean {
  return Math.abs(totalWeight(components) - 100) <= WEIGHT_TOLERANCE
}

export function calculateRawScore(components: AssessmentComponent[]): number | undefined {
  if (components.length === 0 || !hasValidTotalWeight(components)) {
    return undefined
  }

  if (hasInvalidComponents(components)) {
    return undefined
  }

  const hasUnknown = components.some((component) => component.scoreStatus === 'unknown')
  if (hasUnknown) {
    return undefined
  }

  const hasMissingScore = components.some((component) => component.earnedPoints === undefined)
  if (hasMissingScore) {
    return undefined
  }

  const score = components.reduce((sum, component) => {
    const contribution = safeWeightedContribution(component)
    return contribution === undefined ? sum : sum + contribution
  }, 0)

  return score
}

export function calculateCoursePrediction(
  components: AssessmentComponent[],
  profile: GradingProfile,
  course?: Course
): CoursePrediction | undefined {
  const rawScore = calculateRawScore(components)
  if (rawScore === undefined) {
    return undefined
  }

  const universityScore = convertRawToUniversity(rawScore, profile)
  const gradeScore = course && isUtsCourse(course) ? rawScore : universityScore
  return {
    rawScore,
    universityScore,
    gpa: getGpaFromUniversityScore(universityScore, profile),
    gradeLabel: getGradeLabel(gradeScore, profile)
  }
}

export function maxReachableRawScore(components: AssessmentComponent[]): number {
  const known = knownContribution(components)
  const remaining = components
    .filter((component) => component.scoreStatus === 'unknown')
    .reduce((sum, component) => sum + component.weightPercent, 0)
  return known + remaining
}
