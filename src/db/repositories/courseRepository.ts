import { DEFAULT_GRADING_PROFILE_ID } from '../../config/gradingProfile'
import { markWorkspaceDirty } from '../../features/workspace/workspaceStore'
import type { Course } from '../../types/domain'
import { nowIso } from '../../utils/format'
import { createId } from '../../utils/id'
import { db } from '../database'

export async function upsertCourse(course: Course): Promise<void> {
  await db.courses.put({
    ...course,
    updatedAt: nowIso()
  })
  markWorkspaceDirty()
}

export async function createCourse(termId: string): Promise<Course> {
  const now = nowIso()
  const course: Course = {
    id: createId('course'),
    termId,
    code: 'NEW',
    name: '新课程',
    credits: 3,
    includeInGpa: true,
    status: 'in_progress',
    courseType: 'shu',
    gradingProfileId: DEFAULT_GRADING_PROFILE_ID,
    createdAt: now,
    updatedAt: now
  }
  await db.courses.add(course)
  markWorkspaceDirty()
  return course
}

export async function deleteCourse(courseId: string): Promise<void> {
  await db.transaction('rw', db.courses, db.components, async () => {
    await db.components.where('courseId').equals(courseId).delete()
    await db.courses.delete(courseId)
  })
  markWorkspaceDirty()
}

export async function duplicateCourse(courseId: string): Promise<Course | undefined> {
  const source = await db.courses.get(courseId)
  if (!source) {
    return undefined
  }

  const components = await db.components.where('courseId').equals(courseId).toArray()
  const now = nowIso()
  const copiedCourse: Course = {
    ...source,
    id: createId('course'),
    code: `${source.code}-COPY`.slice(0, 20),
    name: `${source.name} 副本`.slice(0, 60),
    createdAt: now,
    updatedAt: now
  }

  await db.transaction('rw', db.courses, db.components, async () => {
    await db.courses.add(copiedCourse)
    await db.components.bulkAdd(
      components.map((component) => ({
        ...component,
        id: createId('cmp'),
        courseId: copiedCourse.id,
        createdAt: now,
        updatedAt: now
      }))
    )
  })

  markWorkspaceDirty()
  return copiedCourse
}
