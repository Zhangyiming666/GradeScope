import { create } from 'zustand'
import { defaultGradingProfile, gradingProfiles } from '../../config/gradingProfile'
import { db } from '../../db/database'
import type { AppSetting, Term } from '../../types/domain'
import type { WorkspaceFileDataV1, WorkspaceFileRecord } from '../../types/workspace'
import { nowIso } from '../../utils/format'
import { createId } from '../../utils/id'
import { isTauri } from '../../utils/platform'
import {
  basename as tauriBasename,
  fileExists as tauriFileExists,
  pickOpenPath,
  pickSavePath,
  readTextFile as tauriReadTextFile,
  writeTextFile as tauriWriteTextFile
} from './tauriFiles'

const WORKSPACE_RECORD_ID: WorkspaceFileRecord['id'] = 'current'
const WORKSPACE_SCHEMA_VERSION = 1
const AUTOSAVE_DELAY_MS = 800
const AUTOSAVE_STORAGE_KEY = 'gradescope:autoSaveEnabled'

type PickerWindow = Window & {
  showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle[]>
  showSaveFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle>
}

type PermissionedFileHandle = FileSystemFileHandle & {
  queryPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>
}

interface WorkspaceState {
  isReady: boolean
  isLoading: boolean
  mode: 'unselected' | 'local' | 'file'
  fileName?: string
  saveMode?: WorkspaceFileRecord['saveMode']
  saveStatus: 'idle' | 'saved' | 'dirty' | 'saving' | 'error'
  autoSaveEnabled: boolean
  lastSavedAt?: string
  error?: string
  setState: (nextState: Partial<Omit<WorkspaceState, 'setState'>>) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  isReady: false,
  isLoading: true,
  mode: 'unselected',
  saveStatus: 'idle',
  autoSaveEnabled: readAutoSavePreference(),
  setState: (nextState) => set(nextState)
}))

let autosaveTimer: number | undefined

function pickerWindow(): PickerWindow {
  return window as PickerWindow
}

function readAutoSavePreference(): boolean {
  try {
    return window.localStorage.getItem(AUTOSAVE_STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

function writeAutoSavePreference(enabled: boolean): void {
  try {
    window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, String(enabled))
  } catch {
    // localStorage may be unavailable in restricted contexts.
  }
}

function clearAutosaveTimer(): void {
  if (autosaveTimer) {
    window.clearTimeout(autosaveTimer)
    autosaveTimer = undefined
  }
}

function isUserAbort(error: unknown): boolean {
  return (
    error instanceof DOMException && error.name === 'AbortError'
  ) || (
    error instanceof Error && (error.name === 'AbortError' || error.message.includes('user aborted'))
  )
}

export function supportsNativeWorkspaceFiles(): boolean {
  return Boolean(pickerWindow().showOpenFilePicker && pickerWindow().showSaveFilePicker)
}

function defaultWorkspaceTerm(): Term {
  const now = nowIso()
  return {
    id: createId('term'),
    name: '新学期',
    academicYear: String(new Date().getFullYear()),
    season: 'spring',
    sortOrder: 1,
    isCurrent: true,
    createdAt: now,
    updatedAt: now
  }
}

function normalizeAppSettings(appSettings: AppSetting[]): AppSetting[] {
  const settings = new Map(appSettings.map((setting) => [setting.key, setting.value]))
  settings.set('seedVersion', settings.get('seedVersion') ?? 'workspace-file')
  return [...settings.entries()].map(([key, value]) => ({ key, value }))
}

export function createEmptyWorkspaceData(): WorkspaceFileDataV1 {
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    exportedAt: nowIso(),
    terms: [defaultWorkspaceTerm()],
    courses: [],
    components: [],
    gradingProfiles,
    appSettings: normalizeAppSettings([])
  }
}

export async function buildWorkspaceData(): Promise<WorkspaceFileDataV1> {
  const [terms, courses, components, storedProfiles, appSettings] = await Promise.all([
    db.terms.orderBy('sortOrder').toArray(),
    db.courses.toArray(),
    db.components.orderBy('order').toArray(),
    db.gradingProfiles.toArray(),
    db.appSettings.toArray()
  ])

  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    exportedAt: nowIso(),
    terms,
    courses,
    components,
    gradingProfiles: storedProfiles.length > 0 ? storedProfiles : [defaultGradingProfile],
    appSettings: normalizeAppSettings(appSettings)
  }
}

export function parseWorkspaceFileText(text: string): WorkspaceFileDataV1 {
  const parsed = JSON.parse(text) as Partial<WorkspaceFileDataV1>
  if (
    parsed.schemaVersion !== WORKSPACE_SCHEMA_VERSION ||
    !Array.isArray(parsed.terms) ||
    !Array.isArray(parsed.courses) ||
    !Array.isArray(parsed.components) ||
    !Array.isArray(parsed.gradingProfiles) ||
    !Array.isArray(parsed.appSettings)
  ) {
    throw new Error('不是有效的 GradeScope 数据文件')
  }

  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : nowIso(),
    terms: parsed.terms,
    courses: parsed.courses,
    components: parsed.components,
    gradingProfiles: parsed.gradingProfiles.length > 0 ? parsed.gradingProfiles : gradingProfiles,
    appSettings: normalizeAppSettings(parsed.appSettings)
  }
}

async function replaceWorkspaceData(data: WorkspaceFileDataV1): Promise<void> {
  await db.transaction('rw', db.terms, db.courses, db.components, db.gradingProfiles, db.appSettings, async () => {
    await Promise.all([db.terms.clear(), db.courses.clear(), db.components.clear(), db.gradingProfiles.clear(), db.appSettings.clear()])
    await db.terms.bulkPut(data.terms)
    await db.courses.bulkPut(data.courses)
    await db.components.bulkPut(data.components)
    await db.gradingProfiles.bulkPut(data.gradingProfiles.length > 0 ? data.gradingProfiles : gradingProfiles)
    await db.appSettings.bulkPut(normalizeAppSettings(data.appSettings))
  })
}

async function saveRecord(record: WorkspaceFileRecord): Promise<void> {
  await db.workspaceFiles.put(record)
}

async function writeNativeFile(handle: FileSystemFileHandle, data: WorkspaceFileDataV1): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(JSON.stringify(data, null, 2))
  await writable.close()
}

function downloadWorkspaceFile(data: WorkspaceFileDataV1, fileName = 'gradepilot.gradepilot.json'): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName.endsWith('.gradepilot.json') ? fileName : `${fileName}.gradepilot.json`
  link.click()
  URL.revokeObjectURL(url)
}

// ===== Tauri 桌面版：通过原生对话框 + Rust 命令直接读写本地文件 =====

async function openWorkspaceFileTauri(): Promise<void> {
  const path = await pickOpenPath()
  if (!path) {
    return
  }

  const data = parseWorkspaceFileText(await tauriReadTextFile(path))
  await replaceWorkspaceData(data)
  const name = tauriBasename(path)
  await saveRecord({ id: WORKSPACE_RECORD_ID, name, path, saveMode: 'tauri', openedAt: nowIso() })
  useWorkspaceStore.getState().setState({
    isReady: true,
    isLoading: false,
    mode: 'file',
    fileName: name,
    saveMode: 'tauri',
    saveStatus: 'saved',
    lastSavedAt: nowIso(),
    error: undefined
  })
}

async function createWorkspaceFileTauri(): Promise<void> {
  const path = await pickSavePath()
  if (!path) {
    return
  }

  const data = createEmptyWorkspaceData()
  await tauriWriteTextFile(path, JSON.stringify(data, null, 2))
  await replaceWorkspaceData(data)
  const name = tauriBasename(path)
  await saveRecord({ id: WORKSPACE_RECORD_ID, name, path, saveMode: 'tauri', openedAt: nowIso() })
  useWorkspaceStore.getState().setState({
    isReady: true,
    isLoading: false,
    mode: 'file',
    fileName: name,
    saveMode: 'tauri',
    saveStatus: 'saved',
    lastSavedAt: nowIso(),
    error: undefined
  })
}

async function saveWorkspaceFileAsTauri(): Promise<void> {
  const data = await buildWorkspaceData()
  const path = await pickSavePath(useWorkspaceStore.getState().fileName ?? 'gradepilot.gradepilot.json')
  if (!path) {
    return
  }

  await tauriWriteTextFile(path, JSON.stringify(data, null, 2))
  const name = tauriBasename(path)
  await saveRecord({ id: WORKSPACE_RECORD_ID, name, path, saveMode: 'tauri', openedAt: nowIso() })
  useWorkspaceStore.getState().setState({
    mode: 'file',
    fileName: name,
    saveMode: 'tauri',
    saveStatus: 'saved',
    lastSavedAt: nowIso(),
    error: undefined
  })
}

export async function openWorkspaceFile(): Promise<void> {
  if (isTauri()) {
    return openWorkspaceFileTauri()
  }

  let handles: FileSystemFileHandle[] | undefined
  try {
    handles = await pickerWindow().showOpenFilePicker?.({
      multiple: false,
      types: [{ description: 'GradeScope 数据文件', accept: { 'application/json': ['.gradepilot.json', '.json'] } }]
    })
  } catch (error) {
    if (isUserAbort(error)) {
      return
    }
    throw error
  }

  const handle = handles?.[0]
  if (!handle) {
    return
  }

  const file = await handle.getFile()
  const data = parseWorkspaceFileText(await file.text())
  await replaceWorkspaceData(data)
  await saveRecord({ id: WORKSPACE_RECORD_ID, name: handle.name, handle, saveMode: 'native', openedAt: nowIso() })
  const savedAt = nowIso()
  useWorkspaceStore.getState().setState({
    isReady: true,
    isLoading: false,
    mode: 'file',
    fileName: handle.name,
    saveMode: 'native',
    saveStatus: 'saved',
    lastSavedAt: savedAt,
    error: undefined
  })
}

export async function openWorkspaceFileFromUpload(file: File): Promise<void> {
  const data = parseWorkspaceFileText(await file.text())
  await replaceWorkspaceData(data)
  await saveRecord({ id: WORKSPACE_RECORD_ID, name: file.name, saveMode: 'download', openedAt: nowIso() })
  useWorkspaceStore.getState().setState({
    isReady: true,
    isLoading: false,
    mode: 'file',
    fileName: file.name,
    saveMode: 'download',
    saveStatus: 'dirty',
    lastSavedAt: undefined,
    error: undefined
  })
}

export async function createWorkspaceFile(): Promise<void> {
  if (isTauri()) {
    return createWorkspaceFileTauri()
  }

  const data = createEmptyWorkspaceData()
  if (supportsNativeWorkspaceFiles()) {
    let handle: FileSystemFileHandle | undefined
    try {
      handle = await pickerWindow().showSaveFilePicker?.({
        suggestedName: 'gradepilot.gradepilot.json',
        types: [{ description: 'GradeScope 数据文件', accept: { 'application/json': ['.gradepilot.json', '.json'] } }]
      })
    } catch (error) {
      if (isUserAbort(error)) {
        return
      }
      throw error
    }
    if (!handle) {
      return
    }
    await writeNativeFile(handle, data)
    await replaceWorkspaceData(data)
    await saveRecord({ id: WORKSPACE_RECORD_ID, name: handle.name, handle, saveMode: 'native', openedAt: nowIso() })
    const savedAt = nowIso()
    useWorkspaceStore.getState().setState({
      isReady: true,
      isLoading: false,
      mode: 'file',
      fileName: handle.name,
      saveMode: 'native',
      saveStatus: 'saved',
      lastSavedAt: savedAt,
      error: undefined
    })
    return
  }

  await replaceWorkspaceData(data)
  downloadWorkspaceFile(data)
  await saveRecord({ id: WORKSPACE_RECORD_ID, name: 'gradepilot.gradepilot.json', saveMode: 'download', openedAt: nowIso() })
  useWorkspaceStore.getState().setState({
    isReady: true,
    isLoading: false,
    mode: 'file',
    fileName: 'gradepilot.gradepilot.json',
    saveMode: 'download',
    saveStatus: 'dirty',
    lastSavedAt: undefined,
    error: undefined
  })
}

export async function saveWorkspaceFile(): Promise<void> {
  const state = useWorkspaceStore.getState()
  if (state.mode !== 'file') {
    return
  }

  useWorkspaceStore.getState().setState({ saveStatus: 'saving', error: undefined })
  const data = await buildWorkspaceData()
  const record = await db.workspaceFiles.get(WORKSPACE_RECORD_ID)
  try {
    if (record?.saveMode === 'tauri' && record.path) {
      await tauriWriteTextFile(record.path, JSON.stringify(data, null, 2))
      useWorkspaceStore.getState().setState({ saveStatus: 'saved', lastSavedAt: nowIso(), error: undefined })
      return
    }

    if (record?.saveMode === 'native' && record.handle) {
      await writeNativeFile(record.handle, data)
      useWorkspaceStore.getState().setState({ saveStatus: 'saved', lastSavedAt: nowIso(), error: undefined })
      return
    }

    downloadWorkspaceFile(data, state.fileName)
    useWorkspaceStore.getState().setState({ saveStatus: 'saved', lastSavedAt: nowIso(), error: undefined })
  } catch (error) {
    useWorkspaceStore.getState().setState({
      saveStatus: 'error',
      error: error instanceof Error ? error.message : '保存工作区失败'
    })
  }
}

export async function saveWorkspaceFileAs(): Promise<void> {
  if (isTauri()) {
    return saveWorkspaceFileAsTauri()
  }

  const data = await buildWorkspaceData()
  if (supportsNativeWorkspaceFiles()) {
    let handle: FileSystemFileHandle | undefined
    try {
      handle = await pickerWindow().showSaveFilePicker?.({
        suggestedName: useWorkspaceStore.getState().fileName ?? 'gradepilot.gradepilot.json',
        types: [{ description: 'GradeScope 数据文件', accept: { 'application/json': ['.gradepilot.json', '.json'] } }]
      })
    } catch (error) {
      if (isUserAbort(error)) {
        return
      }
      throw error
    }
    if (!handle) {
      return
    }
    await writeNativeFile(handle, data)
    await saveRecord({ id: WORKSPACE_RECORD_ID, name: handle.name, handle, saveMode: 'native', openedAt: nowIso() })
    const savedAt = nowIso()
    useWorkspaceStore.getState().setState({
      mode: 'file',
      fileName: handle.name,
      saveMode: 'native',
      saveStatus: 'saved',
      lastSavedAt: savedAt,
      error: undefined
    })
    return
  }

  downloadWorkspaceFile(data, useWorkspaceStore.getState().fileName)
  useWorkspaceStore.getState().setState({ saveStatus: 'saved', lastSavedAt: nowIso(), error: undefined })
}

export async function loadLastWorkspaceFileIfPermitted(): Promise<boolean> {
  const record = await db.workspaceFiles.get(WORKSPACE_RECORD_ID)

  // Tauri 桌面版：用记住的绝对路径直接读回
  if (isTauri()) {
    if (record?.saveMode !== 'tauri' || !record.path) {
      return false
    }
    if (!(await tauriFileExists(record.path))) {
      return false
    }
    const data = parseWorkspaceFileText(await tauriReadTextFile(record.path))
    await replaceWorkspaceData(data)
    useWorkspaceStore.getState().setState({
      isReady: true,
      isLoading: false,
      mode: 'file',
      fileName: record.name,
      saveMode: 'tauri',
      saveStatus: 'saved',
      lastSavedAt: nowIso(),
      error: undefined
    })
    return true
  }

  if (!record?.handle || record.saveMode !== 'native') {
    return false
  }

  const handle = record.handle as PermissionedFileHandle
  const queryPermission = handle.queryPermission?.bind(handle)
  const permission = queryPermission ? await queryPermission({ mode: 'readwrite' }) : 'denied'
  if (permission !== 'granted') {
    return false
  }

  const file = await handle.getFile()
  const data = parseWorkspaceFileText(await file.text())
  await replaceWorkspaceData(data)
  const savedAt = nowIso()
  useWorkspaceStore.getState().setState({
    isReady: true,
    isLoading: false,
    mode: 'file',
    fileName: record.name,
    saveMode: 'native',
    saveStatus: 'saved',
    lastSavedAt: savedAt,
    error: undefined
  })
  return true
}

export function continueWithBrowserData(): void {
  useWorkspaceStore.getState().setState({
    isReady: true,
    isLoading: false,
    mode: 'local',
    fileName: undefined,
    saveMode: undefined,
    saveStatus: 'idle',
    lastSavedAt: undefined,
    error: undefined
  })
}

export function leaveWorkspace(): void {
  clearAutosaveTimer()

  useWorkspaceStore.getState().setState({
    isReady: false,
    isLoading: false,
    mode: 'unselected',
    fileName: undefined,
    saveMode: undefined,
    saveStatus: 'idle',
    lastSavedAt: undefined,
    error: undefined
  })
}

export function setWorkspaceAutoSaveEnabled(enabled: boolean): void {
  writeAutoSavePreference(enabled)
  if (!enabled) {
    clearAutosaveTimer()
  }

  useWorkspaceStore.getState().setState({ autoSaveEnabled: enabled })
  const state = useWorkspaceStore.getState()
  if (
    enabled &&
    state.mode === 'file' &&
    (state.saveMode === 'native' || state.saveMode === 'tauri') &&
    state.saveStatus === 'dirty'
  ) {
    void saveWorkspaceFile()
  }
}

export function markWorkspaceDirty(): void {
  const state = useWorkspaceStore.getState()
  if (state.mode !== 'file') {
    return
  }

  useWorkspaceStore.getState().setState({ saveStatus: 'dirty' })
  if (state.saveMode !== 'native' && state.saveMode !== 'tauri') {
    return
  }

  if (!state.autoSaveEnabled) {
    clearAutosaveTimer()
    return
  }

  clearAutosaveTimer()
  autosaveTimer = window.setTimeout(() => {
    void saveWorkspaceFile()
  }, AUTOSAVE_DELAY_MS)
}
