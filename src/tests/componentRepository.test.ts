import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_GRADING_PROFILE_ID } from '../config/gradingProfile'
import { db } from '../db/database'
import { createComponent, upsertComponent } from '../db/repositories/componentRepository'
import type { Course } from '../types/domain'

async function resetDatabase() {
  await Promise.all([
    db.terms.clear(),
    db.courses.clear(),
    db.components.clear(),
    db.gradingProfiles.clear(),
    db.appSettings.clear(),
    db.workspaceFiles.clear()
  ])
}

function course(): Course {
  return {
    id: 'course-status',
    termId: 'term-status',
    code: 'STATUS',
    name: '状态测试',
    credits: 3,
    includeInGpa: true,
    status: 'in_progress',
    courseType: 'shu',
    gradingProfileId: DEFAULT_GRADING_PROFILE_ID,
    createdAt: '',
    updatedAt: ''
  }
}

describe('componentRepository', () => {
  beforeEach(async () => {
    await resetDatabase()
    await db.terms.add({
      id: 'term-status',
      name: '测试学期',
      academicYear: '2026',
      season: 'spring',
      sortOrder: 1,
      isCurrent: true,
      createdAt: '',
      updatedAt: ''
    })
    await db.courses.add(course())
  })

  it('sets course completed only when every component is published with a score', async () => {
    const first = await createComponent('course-status', 1)
    const second = await createComponent('course-status', 2)

    await upsertComponent({ ...first, scoreStatus: 'actual', earnedPoints: 90 })
    expect((await db.courses.get('course-status'))?.status).toBe('in_progress')

    await upsertComponent({ ...second, scoreStatus: 'actual', earnedPoints: 95 })
    expect((await db.courses.get('course-status'))?.status).toBe('completed')

    await upsertComponent({ ...second, scoreStatus: 'unknown', earnedPoints: undefined })
    expect((await db.courses.get('course-status'))?.status).toBe('in_progress')
  })
})
