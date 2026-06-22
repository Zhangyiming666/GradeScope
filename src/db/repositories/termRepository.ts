import { markWorkspaceDirty } from '../../features/workspace/workspaceStore'
import type { Term } from '../../types/domain'
import { nowIso } from '../../utils/format'
import { createId } from '../../utils/id'
import { db } from '../database'

export async function getTerms(): Promise<Term[]> {
  return db.terms.orderBy('sortOrder').toArray()
}

export async function getCurrentTerm(): Promise<Term | undefined> {
  return db.terms.where('isCurrent').equals(1).first()
}

function sortTerms(terms: Term[]): Term[] {
  return [...terms].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

async function writeTermOrder(terms: Term[]): Promise<void> {
  const updatedAt = nowIso()
  await Promise.all(
    terms.map((term, index) =>
      db.terms.update(term.id, {
        sortOrder: index + 1,
        updatedAt
      })
    )
  )
}

export async function setCurrentTerm(termId: string): Promise<void> {
  const terms = await db.terms.toArray()
  const updatedAt = nowIso()
  await db.transaction('rw', db.terms, async () => {
    await Promise.all(
      terms.map((term) =>
        db.terms.update(term.id, {
          isCurrent: term.id === termId,
          updatedAt
        })
      )
    )
  })
  markWorkspaceDirty()
}

export async function createCustomTerm(name = '新学期', afterTermId?: string): Promise<Term> {
  const terms = sortTerms(await db.terms.toArray())
  const now = nowIso()
  const term: Term = {
    id: createId('term'),
    name,
    academicYear: String(new Date().getFullYear()),
    season: 'spring',
    sortOrder: terms.length + 1,
    isCurrent: false,
    createdAt: now,
    updatedAt: now
  }
  const afterIndex = afterTermId ? terms.findIndex((item) => item.id === afterTermId) : -1
  const nextTerms = [...terms]
  nextTerms.splice(afterIndex >= 0 ? afterIndex + 1 : nextTerms.length, 0, term)
  await db.transaction('rw', db.terms, async () => {
    await db.terms.add(term)
    await writeTermOrder(nextTerms)
  })
  markWorkspaceDirty()
  return term
}

export async function moveTerm(termId: string, direction: 'up' | 'down'): Promise<void> {
  const terms = sortTerms(await db.terms.toArray())
  const index = terms.findIndex((term) => term.id === termId)
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || targetIndex < 0 || targetIndex >= terms.length) {
    return
  }

  const reordered = [...terms]
  const [moved] = reordered.splice(index, 1)
  reordered.splice(targetIndex, 0, moved)
  await writeTermOrder(reordered)
  markWorkspaceDirty()
}

export async function updateTermName(termId: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) {
    return
  }

  await db.terms.update(termId, {
    name: trimmed,
    updatedAt: nowIso()
  })
  markWorkspaceDirty()
}

async function ensureUncategorizedTerm(excludedTermId: string): Promise<Term> {
  const terms = await db.terms.toArray()
  const existing = terms.find((term) => term.id !== excludedTermId && term.name === '未归类')
  if (existing) {
    return existing
  }

  const now = nowIso()
  const term: Term = {
    id: createId('term'),
    name: '未归类',
    academicYear: '未归类',
    season: 'spring',
    sortOrder: Math.max(0, ...terms.map((item) => item.sortOrder)) + 1,
    isCurrent: false,
    createdAt: now,
    updatedAt: now
  }
  await db.terms.add(term)
  return term
}

export async function deleteTermAndCourses(termId: string): Promise<Term | undefined> {
  const courses = await db.courses.where('termId').equals(termId).toArray()
  await db.transaction('rw', db.terms, db.courses, db.components, async () => {
    await Promise.all(courses.map((course) => db.components.where('courseId').equals(course.id).delete()))
    await db.courses.where('termId').equals(termId).delete()
    await db.terms.delete(termId)
  })

  const nextTerm = await db.terms.orderBy('sortOrder').first()
  await writeTermOrder(await db.terms.orderBy('sortOrder').toArray())
  markWorkspaceDirty()
  return nextTerm
}

export async function deleteTermAndMoveCoursesToUncategorized(termId: string): Promise<Term> {
  let targetTerm: Term | undefined
  await db.transaction('rw', db.terms, db.courses, async () => {
    targetTerm = await ensureUncategorizedTerm(termId)
    await db.courses.where('termId').equals(termId).modify({
      termId: targetTerm.id,
      updatedAt: nowIso()
    })
    await db.terms.delete(termId)
  })

  await writeTermOrder(await db.terms.orderBy('sortOrder').toArray())
  markWorkspaceDirty()
  return targetTerm!
}
