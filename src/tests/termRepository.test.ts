import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/database'
import { createCustomTerm, moveTerm } from '../db/repositories/termRepository'
import type { Term } from '../types/domain'

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

function term(id: string, name: string, sortOrder: number): Term {
  return {
    id,
    name,
    academicYear: '2026',
    season: 'spring',
    sortOrder,
    isCurrent: false,
    createdAt: `2026-01-0${sortOrder}T00:00:00.000Z`,
    updatedAt: `2026-01-0${sortOrder}T00:00:00.000Z`
  }
}

async function termNames(): Promise<string[]> {
  return (await db.terms.orderBy('sortOrder').toArray()).map((item) => item.name)
}

async function sortOrders(): Promise<number[]> {
  return (await db.terms.orderBy('sortOrder').toArray()).map((item) => item.sortOrder)
}

describe('termRepository', () => {
  beforeEach(async () => {
    await resetDatabase()
    await db.terms.bulkAdd([
      term('term-y2-autumn', '大二上', 1),
      term('term-y2-spring', '大二下', 2),
      term('term-y3-autumn', '大三上', 3)
    ])
  })

  it('creates a new term after the selected term and normalizes order', async () => {
    const created = await createCustomTerm('大一上', 'term-y2-autumn')

    expect(created.name).toBe('大一上')
    expect(await termNames()).toEqual(['大二上', '大一上', '大二下', '大三上'])
    expect(await sortOrders()).toEqual([1, 2, 3, 4])
  })

  it('moves terms up and down while keeping continuous order', async () => {
    await moveTerm('term-y3-autumn', 'up')
    expect(await termNames()).toEqual(['大二上', '大三上', '大二下'])
    expect(await sortOrders()).toEqual([1, 2, 3])

    await moveTerm('term-y3-autumn', 'down')
    expect(await termNames()).toEqual(['大二上', '大二下', '大三上'])
    expect(await sortOrders()).toEqual([1, 2, 3])
  })

  it('does not move the first term up or the last term down', async () => {
    await moveTerm('term-y2-autumn', 'up')
    await moveTerm('term-y3-autumn', 'down')

    expect(await termNames()).toEqual(['大二上', '大二下', '大三上'])
    expect(await sortOrders()).toEqual([1, 2, 3])
  })
})
