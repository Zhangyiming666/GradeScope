import type { AssessmentComponent, GradingProfile } from '../types/domain'
import {
  convertRawToUniversity,
  hasInvalidComponents,
  inverseConvertUniversityToRaw,
  knownContribution,
  maxReachableRawScore,
  weightedContribution
} from './gradeMath'

export interface ReverseSolveResult {
  targetRawScore: number
  knownContribution: number
  unknownWeightPercent: number
  requiredUnknownContribution: number
  unknownCount: number
  requiredAverage?: number
  exactRequiredComponent?: {
    componentId: string
    requiredScore: number
  }
  maxReachableUniversityScore?: number
  status: 'already_achieved' | 'feasible' | 'impossible' | 'incomplete'
}

export interface ReverseSolveInput {
  targetUniversityScore?: number
  components: AssessmentComponent[]
  profile: GradingProfile
  lockedScores?: Record<string, number | undefined>
}

function contributionFromLocked(component: AssessmentComponent, lockedPercent: number): number {
  return (lockedPercent * component.weightPercent) / 100
}

export function reverseSolve(input: ReverseSolveInput): ReverseSolveResult {
  const target = input.targetUniversityScore
  const actualKnownContribution = knownContribution(input.components)

  if (target === undefined || Number.isNaN(target) || hasInvalidComponents(input.components)) {
    return {
      targetRawScore: 0,
      knownContribution: actualKnownContribution,
      unknownWeightPercent: 0,
      requiredUnknownContribution: 0,
      unknownCount: 0,
      status: 'incomplete'
    }
  }

  const targetRawScore = inverseConvertUniversityToRaw(target, input.profile)
  const unknownComponents = input.components.filter((component) => component.scoreStatus === 'unknown')
  const lockedScores = input.lockedScores ?? {}
  const remainingUnknownComponents = unknownComponents.filter((component) => lockedScores[component.id] === undefined)
  const lockedContribution = unknownComponents.reduce((sum, component) => {
    const locked = lockedScores[component.id]
    if (locked === undefined || Number.isNaN(locked)) {
      return sum
    }
    return sum + contributionFromLocked(component, locked)
  }, 0)
  const combinedKnownContribution = input.components.reduce((sum, component) => {
    if (component.scoreStatus === 'unknown') {
      const locked = lockedScores[component.id]
      return locked === undefined || Number.isNaN(locked) ? sum : sum + contributionFromLocked(component, locked)
    }
    return sum + weightedContribution(component)
  }, 0)

  const unknownWeightPercent = remainingUnknownComponents.reduce(
    (sum, component) => sum + component.weightPercent,
    0
  )
  const requiredUnknownContribution = targetRawScore - combinedKnownContribution
  const baseResult = {
    targetRawScore,
    knownContribution: actualKnownContribution + lockedContribution,
    unknownWeightPercent,
    requiredUnknownContribution,
    unknownCount: remainingUnknownComponents.length,
    maxReachableUniversityScore: convertRawToUniversity(maxReachableRawScore(input.components), input.profile)
  }

  if (requiredUnknownContribution <= 0) {
    return {
      ...baseResult,
      requiredAverage: 0,
      status: 'already_achieved'
    }
  }

  if (unknownWeightPercent <= 0 || remainingUnknownComponents.length === 0) {
    return {
      ...baseResult,
      status: 'incomplete'
    }
  }

  const requiredScore = requiredUnknownContribution / (unknownWeightPercent / 100)
  const status = requiredScore > 100 ? 'impossible' : 'feasible'

  if (remainingUnknownComponents.length === 1) {
    return {
      ...baseResult,
      exactRequiredComponent: {
        componentId: remainingUnknownComponents[0].id,
        requiredScore
      },
      status
    }
  }

  return {
    ...baseResult,
    requiredAverage: requiredScore,
    status
  }
}
