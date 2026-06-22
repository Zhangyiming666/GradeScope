import { create } from 'zustand'

interface AppState {
  selectedTermId?: string
  setSelectedTermId: (termId: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  selectedTermId: undefined,
  setSelectedTermId: (termId) => set({ selectedTermId: termId })
}))
