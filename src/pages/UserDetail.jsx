import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns'
import { id } from 'date-fns/locale'
import { ArrowLeft, QrCode, Calendar, TrendingUp, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/Layout'
import { QRCodeDisplay } from '../components/QRCode'
import { ExportButton } from '../components/ExportButton'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Spinner } from '../components/ui/spinner'
import { clsx } from 'clsx'

const PAGE_SIZE = 15

export default function UserDetail() {
  const { id: userId } = useParams()
  const [user, setUser] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [qrOpen, setQrOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(new Date())
  const [page, setPage] = useState(0)
  const [stats, setStats] = useState({ thisMonth: 0, percentage: 0, avgHour: null })

  const fetchUser = useCallback(async () => {
    const { data } = await supabase
      .from('users')
      .select('*, classes(name)')
      .eq('id', userId)
      .single()
    setUser(data)
  }, [userId])

  const fetchAttendance = useCallback(async () => {
    const { data } = await supabase
      .from('attendance')
      .select('*, locations(name)')
      .eq('user_id', userId)
      .order('check_in_at', { ascending: false })
    setAttendance(data || [])

    // Compute stats for current month
    const monthStart = format(viewMonth, 'yyyy-MM-01')
    const monthEnd = format(endOfMonth(viewMonth), 'yyyy-MM-dd')
    const monthRecords = (data || []).filter(r => r.date >= monthStart && r.date <= monthEnd)
    const daysInMonth = eachDayOfInterval({ start: startOfMonth(viewMonth), end: new Date() < endOfMonth(viewMonth) ? new Date() : endOfMonth(viewMonth) }).length

    const hours = monthRecords.map(r => new Date(r.check_in_at).getHours() + new Date(r.check_in_at).getMinutes() / 60)
    const avgHour = hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null

    setStats({
      thisMonth: monthRecords.length,
      percentage: daysInMonth ? Math.round((monthRecords.length / daysInMonth) * 100) : 0,
      avgHour,
    })
    setLoading(false)
  }, [userId, viewMonth])

  useEffect(() => {
    fetchUser()
    fetchAttendance()
  }, [fetchUser, fetchAttendance])

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-64">
          <Spinner size="lg" />
        </div>
      </Layout>
    )
  }

  if (!user) {
    return (
      <Layout>
        <div className="p-6 text-center text-muted-foreground">Pengguna tidak ditemukan</div>
      </Layout>
    )
  }

  // Calendar for current month
  const monthDays = eachDayOfInterval({ start: startOfMonth(viewMonth), end: endOfMonth(viewMonth) })
  const presentDays = attendance.map(r => r.date)

  const paged = attendance.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(attendance.length / PAGE_SIZE)

  // Fake attendance joined data for export
  const exportRecords = attendance.map(r => ({
    ...r,
    users: { name: user.name, role: user.role, classes: user.classes },
  }))

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Back */}
        <Link to="/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Pengguna
        </Link>

        {/* Profile Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              {user.photo_url ? (
                <img src={user.photo_url} alt={user.name} className="h-20 w-20 rounded-full object-cover border-4 border-primary/20" />
              ) : (
                <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary border-4 border-primary/20">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{user.name}</h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant={user.role === 'student' ? 'default' : 'secondary'}>
                    {user.role === 'student' ? 'Murid' : 'Karyawan'}
                  </Badge>
                  {user.classes && <Badge variant="outline">{user.classes.name}</Badge>}
                  <Badge variant={user.is_active ? 'success' : 'outline'}>
                    {user.is_active ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </div>
                {user.phone && <p className="text-sm text-muted-foreground mt-2">📱 {user.phone}</p>}
              </div>
              <Button variant="outline" size="sm" onClick={() => setQrOpen(true)}>
                <QrCode className="h-4 w-4 mr-1.5" />
                Lihat QR
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Calendar className="h-6 w-6 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.thisMonth}</p>
              <p className="text-xs text-muted-foreground">Hadir Bulan Ini</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <TrendingUp className="h-6 w-6 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.percentage}%</p>
              <p className="text-xs text-muted-foreground">Persentase</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Clock className="h-6 w-6 text-orange-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">
                {stats.avgHour !== null
                  ? `${Math.floor(stats.avgHour)}:${String(Math.round((stats.avgHour % 1) * 60)).padStart(2, '0')}`
                  : '-'
                }
              </p>
              <p className="text-xs text-muted-foreground">Rata-rata Jam</p>
            </CardContent>
          </Card>
        </div>

        {/* Calendar mini */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Kalender Kehadiran — {format(viewMonth, 'MMMM yyyy', { locale: id })}
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}
                >‹</Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}
                >›</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center">
              {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(d => (
                <div key={d} className="text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
              {/* Empty cells for first day offset */}
              {Array.from({ length: monthDays[0].getDay() }).map((_, i) => (
                <div key={`e-${i}`} />
              ))}
              {monthDays.map(day => {
                const dayStr = format(day, 'yyyy-MM-dd')
                const present = presentDays.includes(dayStr)
                const isToday = isSameDay(day, new Date())
                return (
                  <div
                    key={dayStr}
                    className={clsx(
                      'rounded-md py-1.5 text-xs font-medium transition-colors',
                      present && 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                      !present && 'text-muted-foreground',
                      isToday && !present && 'ring-1 ring-primary',
                    )}
                  >
                    {format(day, 'd')}
                  </div>
                )
              })}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded bg-green-200 dark:bg-green-900" />
                Hadir
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded bg-muted" />
                Tidak Hadir
              </span>
            </div>
          </CardContent>
        </Card>

        {/* History Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Riwayat Absensi ({attendance.length} total)</CardTitle>
              <ExportButton records={exportRecords} filename={`absensi_${user.name.replace(/\s+/g, '_')}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Tanggal</th>
                    <th className="text-left p-3 font-medium">Masuk</th>
                    <th className="text-left p-3 font-medium">Pulang</th>
                    <th className="text-left p-3 font-medium hidden md:table-cell">Lokasi</th>
                    <th className="text-left p-3 font-medium">Metode</th>
                    <th className="text-left p-3 font-medium hidden sm:table-cell">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(r => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">
                        {format(new Date(r.date), 'EEE, d MMM yyyy', { locale: id })}
                      </td>
                      <td className="p-3 font-mono text-xs">{format(new Date(r.check_in_at), 'HH:mm:ss')}</td>
                      <td className="p-3 font-mono text-xs">
                        {r.check_out_at ? format(new Date(r.check_out_at), 'HH:mm:ss') : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-3 hidden md:table-cell text-muted-foreground text-xs">
                        {r.locations?.name ?? '-'}
                      </td>
                      <td className="p-3">
                        <Badge variant={r.method === 'qr' ? 'success' : 'warning'}>
                          {r.method === 'qr' ? 'QR Scan' : 'Manual'}
                        </Badge>
                      </td>
                      <td className="p-3 hidden sm:table-cell text-muted-foreground text-xs">
                        {r.notes || '-'}
                      </td>
                    </tr>
                  ))}
                  {paged.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Belum ada riwayat</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >Sebelumnya</Button>
                <span className="flex items-center text-sm text-muted-foreground px-2">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >Berikutnya</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* QR Dialog */}
      <Dialog open={qrOpen} onClose={() => setQrOpen(false)}>
        <DialogContent onClose={() => setQrOpen(false)} className="max-w-xs">
          <DialogHeader>
            <DialogTitle>QR Code — {user.name}</DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-2 flex flex-col items-center gap-3">
            <QRCodeDisplay value={user.qr_code} userName={user.name} size={200} />
            <p className="text-xs text-muted-foreground font-mono break-all text-center">{user.qr_code}</p>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  )
}
