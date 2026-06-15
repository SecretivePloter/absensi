import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './store/useAuthStore'
import { useThemeStore } from './store/useThemeStore'
import { ToastProvider } from './components/ui/toast'
import { Spinner } from './components/ui/spinner'

import Login from './pages/Login'
import Scan from './pages/Scan'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import UserDetail from './pages/UserDetail'
import Classes from './pages/Classes'
import Locations from './pages/Locations'
import ManualAttendance from './pages/ManualAttendance'
import IDCard from './pages/IDCard'

function AuthGuard() {
  const { user, loading } = useAuthStore()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

function AppInitializer({ children }) {
  const { initialize: initAuth } = useAuthStore()
  const { initialize: initTheme } = useThemeStore()

  useEffect(() => {
    initTheme()
    initAuth()
  }, [])

  return children
}

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/scan', element: <Scan /> },
  {
    path: '/',
    element: <AuthGuard />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'users', element: <Users /> },
      { path: 'users/:id', element: <UserDetail /> },
      { path: 'classes', element: <Classes /> },
      { path: 'locations', element: <Locations /> },
      { path: 'attendance/manual', element: <ManualAttendance /> },
      { path: 'id-card', element: <IDCard /> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])

export default function App() {
  return (
    <AppInitializer>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </AppInitializer>
  )
}
