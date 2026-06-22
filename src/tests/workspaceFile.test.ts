import { describe, expect, it } from 'vitest'
import { createEmptyWorkspaceData, parseWorkspaceFileText } from '../features/workspace/workspaceStore'

describe('workspace file', () => {
  it('round-trips GradeScope workspace JSON data', () => {
    const data = createEmptyWorkspaceData()
    const parsed = parseWorkspaceFileText(JSON.stringify(data))

    expect(parsed.schemaVersion).toBe(1)
    expect(parsed.terms).toEqual(data.terms)
    expect(parsed.courses).toEqual([])
    expect(parsed.components).toEqual([])
    expect(parsed.gradingProfiles.length).toBeGreaterThan(0)
    expect(parsed.appSettings.some((setting) => setting.key === 'seedVersion')).toBe(true)
  })

  it('rejects non-workspace JSON files', () => {
    expect(() => parseWorkspaceFileText(JSON.stringify({ hello: 'world' }))).toThrow('不是有效的 GradeScope 数据文件')
  })
})
