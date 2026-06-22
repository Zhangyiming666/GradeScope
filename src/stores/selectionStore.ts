import { create } from 'zustand'

interface SelectionState {
  selectedCourseId?: string
  setSelectedCourseId: (courseId: string | undefined) => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedCourseId: undefined,
  setSelectedCourseId: (courseId) => set({ selectedCourseId: courseId })
}))
