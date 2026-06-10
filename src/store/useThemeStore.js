import { create } from 'zustand'

const getInitialTheme = () => {
  const stored = localStorage.getItem('theme')
  if (stored) return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useThemeStore = create((set) => ({
  theme: 'light',

  initialize: () => {
    const theme = getInitialTheme()
    document.documentElement.classList.toggle('dark', theme === 'dark')
    set({ theme })
  },

  toggle: () => set((state) => {
    const next = state.theme === 'light' ? 'dark' : 'light'
    document.documentElement.classList.toggle('dark', next === 'dark')
    localStorage.setItem('theme', next)
    return { theme: next }
  }),
}))
