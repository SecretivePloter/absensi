import { useState, useEffect, useCallback } from 'react'
import { format, subDays } from 'date-fns'
import { id } from 'date-fns/locale'
import { Users, UserCheck, TrendingUp, UserX, RefreshCw, Clock } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/Layout'
import { AttendanceTable } from '../components/AttendanceTable'
import { ExportButton } from '../components/ExportButton'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { Button } from '../components/ui/button'
import { Spinner } from '../components/ui/spinner'
import { Badge } from '../components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { useToast } from '../components/ui/toast'

const STAFF_ROLES = ['staff', 'sensei', 'asisten_sensei', 'employee']

const ROLE_LABEL = { student: 'Murid', sensei: 'Sensei', asisten_sensei: 'Asisten Sensei', staff: 'Staff', employee: 'Staff' }
const roleLabel = (r) => ROLE_LABEL[r] ?? r

export default function Dashboard() {
  const toast = useToast()

  // Group filter for stat cards
  const [groupFilter, setGroupFilter] = useState('all') // 'all' | 'staff' | classId

  // Table filters (independent)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [roleFilter, setRoleFilter] = useState('all')
  const [classFilter, setClassFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')

  const [records, setRecords] = useState([])
  const [classes, setClasses] = useState([])
  const [locationList, setLocationList] = useState([])
  const [stats, setStats] = useState(null)
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [detailModal, setDetailModal] = useState(null) // { title, type:'hadir'|'tidak_hadir', rows:[], loading }

  const openDetail = useCallback(async (type) => {
    setDetailModal({ title: '', type, rows: [], loading: true })
    const today = format(new Date(), 'yyyy-MM-dd')

    let groupUserIds = null // null = semua

    if (groupFilter === 'staff') {
      const { data } = await supabase.from('users').select('id, name, role').in('role', STAFF_ROLES).eq('is_active', true)
      groupUserIds = data || []
    } else if (groupFilter !== 'all') {
      const { data } = await supabase.from('users').select('id, name, role').eq('class_id', groupFilter).eq('is_active', true)
      groupUserIds = data || []
    } else {
      const { data } = await supabase.from('users').select('id, name, role').eq('is_active', true)
      groupUserIds = data || []
    }

    const ids = groupUserIds.map(u => u.id)
    const userMap = Object.fromEntries(groupUserIds.map(u => [u.id, u]))

    let rows = []
    if (type === 'hadir') {
      const query = supabase.from('attendance').select('user_id, check_in_at, check_out_at').eq('date', today)
      const { data: attRows } = ids.length > 0 ? await query.in('user_id', ids) : await query
      rows = (attRows || []).map(a => ({
        name: userMap[a.user_id]?.name ?? '—',
        role: userMap[a.user_id]?.role ?? '',
        check_in_at: a.check_in_at,
        check_out_at: a.check_out_at,
      })).sort((a, b) => a.name.localeCompare(b.name, 'id'))
    } else {
      const query = supabase.from('attendance').select('user_id').eq('date', today)
      const { data: attRows } = ids.length > 0 ? await query.in('user_id', ids) : await query
      const hadirSet = new Set((attRows || []).map(a => a.user_id))
      rows = groupUserIds.filter(u => !hadirSet.has(u.id))
        .map(u => ({ name: u.name, role: u.role }))
        .sort((a, b) => a.name.localeCompare(b.name, 'id'))
    }

    const titleMap = { hadir: 'Sudah Hadir', tidak_hadir: 'Belum Hadir' }
    const groupLabel = groupFilter === 'all' ? 'Semua' : groupFilter === 'staff' ? 'Staff & Sensei' : `Murid ${classes.find(c => c.id === groupFilter)?.name ?? ''}`
    setDetailModal({ title: `${titleMap[type]} — ${groupLabel}`, type, rows, loading: false })
  }, [groupFilter, classes])

  // Load lookup tables once
  const fetchLookups = useCallback(async () => {
    const [{ data: cls }, { data: locs }] = await Promise.all([
      supabase.from('classes').select('id, name').order('name'),
      supabase.from('locations').select('id, name').order('name'),
    ])
    setClasses(cls || [])
    setLocationList(locs || [])
  }, [])

  // Stat cards — recomputed when groupFilter changes
  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    const today = format(new Date(), 'yyyy-MM-dd')

    try {
      if (groupFilter === 'all') {
        const [{ count: hadirCount }, { count: muridCount }, { count: staffCount }, { count: totalCount }] = await Promise.all([
          supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('date', today),
          supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('is_active', true),
          supabase.from('users').select('*', { count: 'exact', head: true }).in('role', STAFF_ROLES).eq('is_active', true),
          supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_active', true),
        ])
        const hadir = hadirCount || 0
        const total = totalCount || 0
        setStats({
          mode: 'all',
          hadir,
          total,
          tidakHadir: Math.max(0, total - hadir),
          persentase: total ? Math.round((hadir / total) * 100) : 0,
          totalMurid: muridCount || 0,
          totalStaff: staffCount || 0,
          label: 'Semua',
        })

      } else if (groupFilter === 'staff') {
        const { data: staffUsers } = await supabase
          .from('users').select('id').in('role', STAFF_ROLES).eq('is_active', true)
        const ids = (staffUsers || []).map(u => u.id)
        const total = ids.length

        let hadir = 0
        if (ids.length > 0) {
          const { count } = await supabase
            .from('attendance').select('*', { count: 'exact', head: true })
            .eq('date', today).in('user_id', ids)
          hadir = count || 0
        }
        setStats({
          mode: 'group',
          hadir,
          total,
          tidakHadir: Math.max(0, total - hadir),
          persentase: total ? Math.round((hadir / total) * 100) : 0,
          label: 'Staff & Sensei',
        })

      } else {
        // classId
        const { data: classUsers } = await supabase
          .from('users').select('id').eq('class_id', groupFilter).eq('is_active', true)
        const ids = (classUsers || []).map(u => u.id)
        const total = ids.length

        let hadir = 0
        if (ids.length > 0) {
          const { count } = await supabase
            .from('attendance').select('*', { count: 'exact', head: true })
            .eq('date', today).in('user_id', ids)
          hadir = count || 0
        }
        setStats({
          mode: 'group',
          hadir,
          total,
          tidakHadir: Math.max(0, total - hadir),
          persentase: total ? Math.round((hadir / total) * 100) : 0,
          label: `Murid Kelas`,
        })
      }
    } finally {
      setStatsLoading(false)
    }
  }, [groupFilter])

  const fetchChartData = useCallback(async () => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i)
      return format(d, 'yyyy-MM-dd')
    })
    const results = await Promise.all(
      days.map(d =>
        supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('date', d)
      )
    )
    setChartData(days.map((d, i) => ({
      name: format(new Date(d + 'T12:00:00'), 'EEE', { locale: id }),
      hadir: results[i]?.count || 0,
    })))
  }, [])

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('attendance')
      .select('*, users(id, name, role, class_id, photo_url, classes(name)), locations(name)')
      .eq('date', selectedDate)
      .order('check_in_at', { ascending: false })

    let filtered = data || []
    if (roleFilter !== 'all') filtered = filtered.filter(r => r.users?.role === roleFilter)
    if (classFilter !== 'all') filtered = filtered.filter(r => r.users?.class_id === classFilter)
    if (locationFilter !== 'all') filtered = filtered.filter(r => r.location_id === locationFilter)

    setRecords(filtered)
    setLoading(false)
  }, [selectedDate, roleFilter, classFilter, locationFilter])

  useEffect(() => {
    fetchLookups()
    fetchChartData()
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { fetchRecords() }, [fetchRecords])

  const handleRefresh = () => {
    fetchStats()
    fetchChartData()
    fetchRecords()
  }

  const handleDeleteRecords = async (ids) => {
    const { error } = await supabase.from('attendance').delete().in('id', ids)
    if (error) {
      toast({ title: 'Gagal menghapus', description: error.message, variant: 'error' })
      return
    }
    toast({ title: 'Berhasil', description: `${ids.length} record absensi dihapus`, variant: 'success' })
    handleRefresh()
  }

  // Group tab options
  const groupTabs = [
    { key: 'all', label: 'Semua' },
    { key: 'staff', label: 'Staff & Sensei' },
    ...classes.map(c => ({ key: c.id, label: `Murid — ${c.name}` })),
  ]

  // Stat cards based on mode
  const statCards = stats?.mode === 'all'
    ? [
        { title: 'Hadir Hari Ini', value: stats.hadir, icon: UserCheck, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950', clickType: 'hadir' },
        { title: 'Total Murid Aktif', value: stats.totalMurid, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950', clickType: null },
        { title: 'Total Staff Aktif', value: stats.totalStaff, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950', clickType: null },
        { title: 'Persentase Kehadiran', value: `${stats.persentase}%`, icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950', clickType: null },
      ]
    : [
        { title: 'Hadir Hari Ini', value: stats?.hadir ?? '-', icon: UserCheck, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950', clickType: 'hadir' },
        { title: 'Total Anggota Aktif', value: stats?.total ?? '-', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950', clickType: null },
        { title: 'Belum Hadir', value: stats?.tidakHadir ?? '-', icon: UserX, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950', clickType: 'tidak_hadir' },
        { title: 'Persentase Kehadiran', value: stats ? `${stats.persentase}%` : '-', icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950', clickType: null },
      ]

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground text-sm">
              {format(new Date(), "EEEE, d MMMM yyyy", { locale: id })}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
        </div>

        {/* Group filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {groupTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setGroupFilter(tab.key)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                groupFilter === tab.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Stat Cards */}
        {statsLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6 flex justify-center items-center h-24">
                  <Spinner size="sm" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map(({ title, value, icon: Icon, color, bg, clickType }) => (
              <Card
                key={title}
                onClick={clickType ? () => openDetail(clickType) : undefined}
                className={clickType ? 'cursor-pointer hover:shadow-md hover:border-primary/40 transition-all' : ''}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground leading-tight">{title}</p>
                      <p className="text-3xl font-bold mt-1">{value}</p>
                      {clickType && (
                        <p className="text-xs text-muted-foreground mt-1 underline underline-offset-2">Lihat daftar</p>
                      )}
                    </div>
                    <div className={`p-2 rounded-lg ${bg}`}>
                      <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Label grup aktif */}
        {groupFilter !== 'all' && stats && (
          <p className="text-xs text-muted-foreground -mt-2">
            Menampilkan ringkasan untuk: <span className="font-semibold text-foreground">{stats.label}</span>
            {groupFilter !== 'staff' && classes.find(c => c.id === groupFilter)
              ? ` — ${classes.find(c => c.id === groupFilter).name}`
              : ''}
          </p>
        )}

        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kehadiran 7 Hari Terakhir (Semua)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    color: 'hsl(var(--card-foreground))',
                  }}
                />
                <Bar dataKey="hadir" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Hadir" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Table + filters */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <CardTitle className="text-base flex-1">Data Absensi</CardTitle>
              <div className="flex flex-wrap gap-2 items-center">
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-auto text-sm h-9"
                />
                <Select
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
                  className="w-auto h-9 text-sm"
                >
                  <option value="all">Semua Role</option>
                  <option value="student">Murid</option>
                  <option value="staff">Staff</option>
                  <option value="sensei">Sensei</option>
                  <option value="asisten_sensei">Asisten Sensei</option>
                  <option value="employee">Lama (employee)</option>
                </Select>
                <Select
                  value={classFilter}
                  onChange={e => setClassFilter(e.target.value)}
                  className="w-auto h-9 text-sm"
                >
                  <option value="all">Semua Kelas</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
                <Select
                  value={locationFilter}
                  onChange={e => setLocationFilter(e.target.value)}
                  className="w-auto h-9 text-sm"
                >
                  <option value="all">Semua Lokasi</option>
                  {locationList.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </Select>
                <ExportButton
                  records={records}
                  filename={`absensi_${selectedDate}`}
                  disabled={loading}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <AttendanceTable
              records={records}
              loading={loading}
              selectable
              onDeleteSelected={handleDeleteRecords}
            />
          </CardContent>
        </Card>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!detailModal} onClose={() => setDetailModal(null)}>
        <DialogContent onClose={() => setDetailModal(null)} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{detailModal?.title}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            {detailModal?.loading ? (
              <div className="flex justify-center py-8"><Spinner size="lg" /></div>
            ) : detailModal?.rows?.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">Tidak ada data</p>
            ) : (
              <ul className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {detailModal.rows.map((row, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {row.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{roleLabel(row.role)}</p>
                      </div>
                    </div>
                    {detailModal.type === 'hadir' && row.check_in_at && (
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <Clock className="h-3 w-3" />
                          {format(new Date(row.check_in_at), 'HH:mm')}
                        </div>
                        {row.check_out_at && (
                          <div className="text-xs text-muted-foreground">
                            Pulang {format(new Date(row.check_out_at), 'HH:mm')}
                          </div>
                        )}
                      </div>
                    )}
                    {detailModal.type === 'tidak_hadir' && (
                      <Badge variant="outline" className="text-xs shrink-0">Alpha</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground mt-3 text-center">
              {detailModal?.rows?.length ?? 0} orang · {format(new Date(), 'd MMM yyyy', { locale: id })}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  )
}
