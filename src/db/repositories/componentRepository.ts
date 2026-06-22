import type { AssessmentComponent } from '../../types/domain'
import { markWorkspaceDirty } from '../../features/workspace/workspaceStore'
import { nowIso } from '../../utils/format'
import { createId } from '../../utils/id'
import { db } from '../database'

async function syncCourseStatus(courseId: string): Promise<void> {
  const components = await db.components.where('courseId').equals(courseId).toArray()
  const nextStatus =
    components.length > 0 &&
    components.every((component) => component.scoreStatus === 'actual' && component.earnedPoints !== undefined)
      ? 'completed'
      : 'in_progress'
  const course = await db.courses.get(courseId)

  if (course && course.status !== nextStatus) {
    await db.courses.update(courseId, {
      status: nextStatus,
      updatedAt: nowIso()
    })
  }
}

export async function upsertComponent(component: AssessmentComponent): Promise<void> {
  await db.components.put({
    ...component,
    updatedAt: nowIso()
  })
  await syncCourseStatus(component.courseId)
  markWorkspaceDirty()
}

export async function bulkUpsertComponents(components: AssessmentComponent[]): Promise<void> {
  const updatedAt = nowIso()
  await db.components.bulkPut(components.map((component) => ({ ...component, updatedAt })))
  await Promise.all([...new Set(components.map((component) => component.courseId))].map((courseId) => syncCourseStatus(courseId)))
  markWorkspaceDirty()
}

export async function createComponent(courseId: string, order: number): Promise<AssessmentComponent> {
  const now = nowIso()
  const component: AssessmentComponent = {
    id: createId('cmp'),
    courseId,
    name: '新项目',
    weightPercent: 0,
    maxPoints: 100,
    scoreStatus: 'unknown',
    order,
    createdAt: now,
    updatedAt: now
  }
  await db.components.add(component)
  await syncCourseStatus(courseId)
  markWorkspaceDirty()
  return component
}

export async function deleteComponent(componentId: string): Promise<void> {
  const component = await db.components.get(componentId)
  await db.components.delete(componentId)
  if (component) {
    await syncCourseStatus(component.courseId)
  }
  markWorkspaceDirty()
}
