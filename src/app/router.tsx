import { createBrowserRouter, type RouterProviderProps } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { CoursePage } from '../pages/CoursePage'
import { DashboardPage } from '../pages/DashboardPage'
import { GradeDatabasePage } from '../pages/GradeDatabasePage'
import { ScoreRedirect } from '../pages/ScoreRedirect'

export const router: RouterProviderProps['router'] = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'courses', element: <CoursePage /> },
      { path: 'courses/:courseId', element: <CoursePage /> },
      { path: 'scores', element: <ScoreRedirect /> },
      { path: 'scores/:courseId', element: <ScoreRedirect /> },
      { path: 'database', element: <GradeDatabasePage /> }
    ]
  }
])
