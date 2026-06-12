import { useState, useEffect, useCallback } from 'react'
import { format, subDays } from 'date-fns'
import { id } from 'date-fns/locale'
import { Users, UserCheck, TrendingUp, Calendar, RefreshCw } from 'lucide-react'
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
import { useToast } from '../components/ui/toast'

export default function Dashboard() {
  const toast = useToast()
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [roleFilter, setRoleFilter] = useState('all')
  const [classFilter, setClassFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [records, setRecords] = useState([])
  const [classes, setClasses] = useState([])
  const [locationList, setLocationList] = useState([])
  const [stats, setStats] = useState({ today: 0, students: 0, employees: 0, percentage: 0 })
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchClasses = useCallback(async () => {
    const [{ data: cls }, { data: locs }] = await Promise.all([
      supabase.from('classes').select('id, name').order('name'),
      supabase.from('locations').select('id, name').order('name'),
    ])
    setClasses(cls || [])
    setLocationList(locs || [])
  }, [])

  const fetchStats = useCallback(async () => {
    const today = format(new Date(), 'yyyy-MM-dd')

    const [{ count: todayCount }, { count: studentCount }, { count: employeeCount }, { count: totalActive }] = await Promise.all([
      supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('date', today),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('is_active', true),
      supabase.from('users').select('*', { count: 'exact', head: true }).in('role', ['employee', 'staff', 'sensei']).eq('is_active', true),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_active', true),
    ])

    setStats({
      today: todayCount || 0,
      students: studentCount || 0,
      employees: employeeCount || 0,
      percentage: totalActive ? Math.round(((todayCount || 0) / totalActive) * 100) : 0,
    })
  }, [])

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
      name: format(new Date(d), 'EEE', { locale: id }),
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

    if (roleFilter !== 'all') {
      filtered = filtered.filter(r => r.users?.role === roleFilter)
    }
    if (classFilter !== 'all') {
      filtered = filtered.filter(r => r.users?.class_id === classFilter)
    }
    if (locationFilter !== 'all') {
      filtered = filtered.filter(r => r.location_id === locationFilter)
    }

    setRecords(filtered)
    setLoading(false)
  }, [selectedDate, roleFilter, classFilter, locationFilter])

  useEffect(() => {
    fetchClasses()
    fetchStats()
    fetchChartData()
  }, [])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

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

  const statCards = [
    { title: 'Hadir Hari Ini', value: stats.today, icon: UserCheck, color: 'text-green-600' },
    { title: 'Total Murid Aktif', value: stats.students, icon: Users, color: 'text-blue-600' },
    { title: 'Total Staff Aktif', value: stats.employees, icon: Users, color: 'text-purple-600' },
    { title: 'Persentase Kehadiran', value: `${stats.percentage}%`, icon: TrendingUp, color: 'text-orange-600' },
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

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(({ title, value, icon: Icon, color }) => (
            <Card key={title}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{title}</p>
                    <p className="text-3xl font-bold mt-1">{value}</p>
                  </div>
                  <Icon className={`h-8 w-8 ${color} opacity-80`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kehadiran 7 Hari Terakhir</CardTitle>
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

        {/* Filters + Table */}
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
    </Layout>
  )
}
