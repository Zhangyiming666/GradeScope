import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { App } from '../app/App'
import { Providers } from '../app/providers'
import { db } from '../db/database'
import { useAppStore } from '../stores/appStore'
import { useWorkspaceStore } from '../features/workspace/workspaceStore'
import { CoursePage } from '../pages/CoursePage'
import { GradeDatabasePage } from '../pages/GradeDatabasePage'

async function resetDatabase() {
  db.close()
  await db.delete()
  await db.open()
  useAppStore.setState({ selectedTermId: undefined })
  useWorkspaceStore.setState({
    isReady: false,
    isLoading: true,
    mode: 'unselected',
    fileName: undefined,
    saveMode: undefined,
    saveStatus: 'idle',
    error: undefined
  })
}

function renderRoute(path: string, routePath: string, element: ReactNode) {
  return render(
    <Providers>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
      </MemoryRouter>
    </Providers>
  )
}

describe('GradePilot UI', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('updates readonly target fields when course target changes', async () => {
    renderRoute('/courses/course-acct1001', '/courses/:courseId', <CoursePage />)

    const targetInput = await screen.findByLabelText('目标课程总分')
    fireEvent.change(targetInput, { target: { value: '75' } })
    fireEvent.blur(targetInput)

    await waitFor(() => expect(screen.getByLabelText('目标绩点')).toHaveValue('3.00'))
  })

  it('shows workspace choices before loading the full app', async () => {
    render(<App />)

    expect(await screen.findByText('GradeScope')).toBeInTheDocument()
    expect(screen.getByText('GradeScope 是一个本地成绩管理与目标成绩反推工具。选择已有数据文件继续分析，或新建一个工作区开始记录课程、分数和 GPA。')).toBeInTheDocument()
    expect(screen.getByText('打开数据文件')).toBeInTheDocument()
    expect(screen.getByText('新建数据文件')).toBeInTheDocument()
    expect(screen.queryByText('继续使用浏览器本地数据')).not.toBeInTheDocument()
  })

  it('updates reverse solve result when target changes', async () => {
    renderRoute('/courses/course-acct1001', '/courses/:courseId', <CoursePage />)

    expect(await screen.findByText('91.50 分')).toBeInTheDocument()
    const targetInput = screen.getByLabelText('目标课程总分')
    fireEvent.change(targetInput, { target: { value: '92' } })
    fireEvent.blur(targetInput)

    expect(await screen.findByText('96.50 分')).toBeInTheDocument()
  })

  it('adds and deletes an assessment component', async () => {
    renderRoute('/courses/course-acct1001', '/courses/:courseId', <CoursePage />)

    fireEvent.click(await screen.findByText('添加项目'))
    expect(await screen.findByDisplayValue('新项目')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('删除 新项目'))
    await waitFor(() => expect(screen.queryByDisplayValue('新项目')).not.toBeInTheDocument())
  })

  it('switches dashboard term data', async () => {
    useWorkspaceStore.setState({ isReady: true, isLoading: false, mode: 'local', saveStatus: 'idle' })
    render(<App />)

    expect(await screen.findByText('会计学')).toBeInTheDocument()
    const termSelect = await screen.findByLabelText('选择学期')
    fireEvent.change(termSelect, { target: { value: 'term-y1-autumn' } })

    expect(await screen.findByText('金融学')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('会计学')).not.toBeInTheDocument())
  })

  it('reorders terms from the term management dialog', async () => {
    useWorkspaceStore.setState({ isReady: true, isLoading: false, mode: 'local', saveStatus: 'idle' })
    render(<App />)

    const termSelect = await screen.findByLabelText('选择学期')
    expect(Array.from(termSelect.querySelectorAll('option')).map((option) => option.textContent)).toEqual([
      '大一上',
      '大一下',
      '大二上',
      '大二下',
      '大三上',
      '大三冬',
      '2024-2025 春季学期'
    ])

    fireEvent.click(screen.getByRole('button', { name: '学期管理' }))
    fireEvent.click(await screen.findByLabelText('下移 大一上'))

    await waitFor(() =>
      expect(Array.from(termSelect.querySelectorAll('option')).map((option) => option.textContent)).toEqual([
        '大一下',
        '大一上',
        '大二上',
        '大二下',
        '大三上',
        '大三冬',
        '2024-2025 春季学期'
      ])
    )
  })

  it('filters the database table by search text', async () => {
    renderRoute('/database', '/database', <GradeDatabasePage />)

    expect(await screen.findByText('经济学')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('搜索课程'), { target: { value: '会计' } })

    expect(await screen.findByText('会计学')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('经济学')).not.toBeInTheDocument())
  })

  it('renders the full application shell', async () => {
    useWorkspaceStore.setState({ isReady: true, isLoading: false, mode: 'local', saveStatus: 'idle' })
    render(<App />)

    expect(await screen.findByText('GradeScope')).toBeInTheDocument()
    expect(await screen.findAllByText('成绩数据库')).not.toHaveLength(0)
  })

  it('does not persist Chinese course name drafts until composition commits', async () => {
    renderRoute('/courses/course-acct1001', '/courses/:courseId', <CoursePage />)

    const nameInput = await screen.findByLabelText('课程名称')
    fireEvent.compositionStart(nameInput)
    fireEvent.change(nameInput, { target: { value: '高级会计学' } })

    expect((await db.courses.get('course-acct1001'))?.name).toBe('会计学')

    fireEvent.compositionEnd(nameInput, { data: '高级会计学' })
    await waitFor(async () => expect((await db.courses.get('course-acct1001'))?.name).toBe('高级会计学'))
  })
})
