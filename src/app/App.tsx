import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { Providers } from './providers'
import { WorkspaceGate } from '../features/workspace/WorkspaceGate'

export function App() {
  return (
    <Providers>
      <WorkspaceGate>
        <RouterProvider router={router} />
      </WorkspaceGate>
    </Providers>
  )
}
