import type { AppSetting, AssessmentComponent, Course, GradingProfile, Term } from './domain'

export interface WorkspaceFileDataV1 {
  schemaVersion: 1
  exportedAt: string
  terms: Term[]
  courses: Course[]
  components: AssessmentComponent[]
  gradingProfiles: GradingProfile[]
  appSettings: AppSetting[]
}

export interface WorkspaceFileRecord {
  id: 'current'
  name: string
  handle?: FileSystemFileHandle
  /** Tauri 桌面版的绝对文件路径 */
  path?: string
  saveMode: 'native' | 'download' | 'tauri'
  openedAt: string
}
