import { liveQuery } from 'dexie'
import { useEffect, useMemo, useState } from 'react'
import { defaultGradingProfile } from '../config/gradingProfile'
import type { AssessmentComponent, Course, GradingProfile, Term } from '../types/domain'
import { db } from './database'
import { seedDatabaseIfNeeded } from './seed'

export interface GradePilotData {
  terms: Term[]
  courses: Course[]
  components: AssessmentComponent[]
  gradingProfiles: GradingProfile[]
}

const emptyData: GradePilotData = {
  terms: [],
  courses: [],
  components: [],
  gradingProfiles: []
}

export function useGradePilotData(): {
  data: GradePilotData
  isLoading: boolean
  error?: Error
  defaultProfile: GradingProfile
} {
  const [data, setData] = useState<GradePilotData>(emptyData)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | undefined>()

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    seedDatabaseIfNeeded()
      .then(() => {
        if (cancelled) {
          return
        }

        const subscription = liveQuery(async () => {
          const [terms, courses, components, gradingProfiles] = await Promise.all([
            db.terms.orderBy('sortOrder').toArray(),
            db.courses.toArray(),
            db.components.orderBy('order').toArray(),
            db.gradingProfiles.toArray()
          ])
          return { terms, courses, components, gradingProfiles }
        }).subscribe({
          next: (nextData) => {
            setData(nextData)
            setIsLoading(false)
          },
          error: (nextError: unknown) => {
            setError(nextError instanceof Error ? nextError : new Error('读取本地数据库失败'))
            setIsLoading(false)
          }
        })

        unsubscribe = () => subscription.unsubscribe()
      })
      .catch((nextError: unknown) => {
        setError(nextError instanceof Error ? nextError : new Error('初始化本地数据库失败'))
        setIsLoading(false)
      })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  const defaultProfile = useMemo(() => data.gradingProfiles[0] ?? defaultGradingProfile, [data.gradingProfiles])

  return { data, isLoading, error, defaultProfile }
}
