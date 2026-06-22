import Dexie, { type Table } from 'dexie'
import type { AppSetting, AssessmentComponent, Course, GradingProfile, Term } from '../types/domain'
import type { WorkspaceFileRecord } from '../types/workspace'

export class GradePilotDatabase extends Dexie {
  terms!: Table<Term, string>
  courses!: Table<Course, string>
  components!: Table<AssessmentComponent, string>
  gradingProfiles!: Table<GradingProfile, string>
  appSettings!: Table<AppSetting, string>
  workspaceFiles!: Table<WorkspaceFileRecord, string>

  constructor() {
    super('gradepilot-db')

    this.version(1).stores({
      terms: 'id, isCurrent, sortOrder',
      courses: 'id, termId, code, status, gradingProfileId',
      components: 'id, courseId, order, scoreStatus',
      gradingProfiles: 'id',
      appSettings: 'key'
    })

    this.version(2).stores({
      terms: 'id, isCurrent, sortOrder',
      courses: 'id, termId, code, status, gradingProfileId',
      components: 'id, courseId, order, scoreStatus',
      gradingProfiles: 'id',
      appSettings: 'key',
      workspaceFiles: 'id, openedAt'
    })
  }
}

export const db = new GradePilotDatabase()
