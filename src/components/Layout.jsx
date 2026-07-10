import { NavLink, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  LayoutDashboard, Users, ScanLine,
  ClipboardList, Settings, Moon, Sun, LogOut, Menu, X, CreditCard, Images,
  Shield, FileBarChart
} from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { useThemeStore } from '../store/useThemeStore'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

const allNavItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'operator'] },
  { to: '/users', icon: Users, label: 'Pengguna', roles: ['admin'] },
  { to: '/attendance/manual', icon: ClipboardList, label: 'Absensi Manual', roles: ['admin'] },
  { to: '/attendance/recap', icon: FileBarChart, label: 'Rekap Absen', roles: ['admin'] },
  { to: '/id-card', icon: CreditCard, label: 'ID Card', roles: ['admin'] },
  { to: '/gallery', icon: Images, label: 'Galeri', roles: ['admin'] },
  { to: '/settings', icon: Settings, label: 'Pengaturan', roles: ['admin'] },
  { to: '/scan', icon: ScanLine, label: 'Scan QR', roles: ['admin', 'operator'], external: true },
]

export function Layout({ children }) {
  const navigate = useNavigate()
  const { signOut, user, adminRole } = useAuthStore()
  const { theme, toggle } = useThemeStore()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  // Filter nav items berdasarkan role
  const navItems = allNavItems.filter(item => item.roles.includes(adminRole))

  const roleBadge = adminRole === 'operator' ? (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-1">Operator</Badge>
  ) : (
    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">Admin</Badge>
  )

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 border-r bg-card flex-col">
        <div className="p-6 border-b">
          <div className="flex flex-col items-start gap-2">
            <img src="/logo.png" alt="Ichikara" className="h-10 w-auto" />
            <div className="flex items-center">
              <span className="text-xs font-semibold text-muted-foreground">Sistem Absensi QR</span>
              {roleBadge}
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t space-y-1">
          <div className="px-3 py-2 text-xs text-muted-foreground truncate">
            {user?.email}
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={toggle}>
            {theme === 'dark' ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
            {theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-destructive hover:text-destructive" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Keluar
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Ichikara" className="h-7 w-auto" />
          <span className="font-bold text-sm">Absensi QR</span>
          {roleBadge}
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 pt-14">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <nav className="relative bg-card w-64 h-full p-3 space-y-1 overflow-y-auto">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
            <Button variant="ghost" size="sm" className="w-full justify-start mt-4" onClick={toggle}>
              {theme === 'dark' ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
              {theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start text-destructive hover:text-destructive" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Keluar
            </Button>
          </nav>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto md:p-0">
        <div className="md:hidden h-14" />
        {children}
      </main>
    </div>
  )
}
