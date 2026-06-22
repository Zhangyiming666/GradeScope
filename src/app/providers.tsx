import type { PropsWithChildren } from 'react'
import { Toaster } from 'sonner'

export function Providers({ children }: PropsWithChildren) {
  return (
    <>
      {children}
      <Toaster richColors position="top-center" />
    </>
  )
}
