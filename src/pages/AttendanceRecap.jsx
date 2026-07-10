import { useState, useEffect, useMemo, useCallback } from 'react'
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/useAuthStore'
import { roleLabel } from '../store/useRolesStore'
import { Layout } from '../components/Layout'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Spinner } from '../components/ui/spinner'
import { Input } from '../components/ui/input'
import { exportAttendanceToExcel } from '../utils/exportExcel'
import {
    FileSpreadsheet,
    Search,
    Calendar,
    Users,
    Filter,
    ClipboardList,
    Clock,
    UserCheck,
    AlertCircle,
    HeartPulse,
} from 'lucide-react'

const earlyReasonLabel = { izin: 'Izin', sakit: 'Sakit', dinas_keluar: 'Dinas Keluar', others: 'Lainnya' }
const absenceReasonLabel = { izin: 'Izin', sakit: 'Sakit', alpha: 'Alpha' }
const earlyReasonVariant = (r) =>
    r === 'dinas_keluar' ? 'success' : r === 'sakit' ? 'warning' : 'outline'
const absenceVariant = (r) =>
    r === 'sakit' ? 'warning' : r === 'izin' ? 'secondary' : 'destructive'

export default function AttendanceRecap() {
    const { adminRole } = useAuthStore()

    // Filter state
    const today = format(new Date(), 'yyyy-MM-dd')
    const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
    const [dateTo, setDateTo] = useState(today)
    const [roleFilter, setRoleFilter] = useState('all') // all | student | employee
    const [searchName, setSearchName] = useState('')
    const [loading, setLoading] = useState(false)

    // Data
    const [records, setRecords] = useState([])
    const [allUsers, setAllUsers] = useState([])

    // Fetch users for filter
    useEffect(() => {
        ; (async () => {
            const { data } = await supabase
                .from('users')
                .select('id, name, role, class_id, is_active, classes(name)')
                .eq('is_active', true)
                .order('name')
            setAllUsers(data ?? [])
        })()
    }, [])

    // Fetch attendance records
    const fetchRecords = useCallback(async () => {
        setLoading(true)
        try {
            let q = supabase
                .from('attendance')
                .select('*, users!inner(id, name, role, class_id, classes(name)), locations(name)')
                .gte('date', dateFrom)
                .lte('date', dateTo)
                .order('date', { ascending: false })

            if (roleFilter !== 'all') {
                q = q.eq('users.role', roleFilter)
            }

            const { data, error } = await q
            if (error) throw error
            setRecords(data ?? [])
        } catch (err) {
            console.error('Fetch recap error:', err)
        } finally {
            setLoading(false)
        }
    }, [dateFrom, dateTo, roleFilter])

    useEffect(() => {
        fetchRecords()
    }, [fetchRecords])

    // Filtered records by search name
    const filtered = useMemo(() => {
        if (!searchName.trim()) return records
        const q = searchName.toLowerCase()
        return records.filter((r) => r.users?.name?.toLowerCase().includes(q))
    }, [records, searchName])

    // Stats
    const stats = useMemo(() => {
        const hadir = filtered.filter((r) => r.check_in_at && !r.absence_reason).length
        const izin = filtered.filter((r) => r.absence_reason === 'izin').length
        const sakit = filtered.filter((r) => r.absence_reason === 'sakit').length
        const alpha = filtered.filter((r) => r.absence_reason === 'alpha').length
        const earlyOut = filtered.filter((r) => r.early_checkout_reason).length
        return { hadir, izin, sakit, alpha, earlyOut, total: filtered.length }
    }, [filtered])

    const handleExport = () => {
        const filename = `rekap_absensi_${dateFrom}_${dateTo}`
        exportAttendanceToExcel(filtered, filename)
    }

    // Quick date presets
    const setPreset = (preset) => {
        const now = new Date()
        switch (preset) {
            case 'today':
                setDateFrom(today)
                setDateTo(today)
                break
            case 'yesterday': {
                const y = format(subDays(now, 1), 'yyyy-MM-dd')
                setDateFrom(y)
                setDateTo(y)
                break
            }
            case 'week': {
                setDateFrom(format(subDays(now, 6), 'yyyy-MM-dd'))
                setDateTo(today)
                break
            }
            case 'month':
                setDateFrom(format(startOfMonth(now), 'yyyy-MM-dd'))
                setDateTo(format(endOfMonth(now), 'yyyy-MM-dd'))
                break
        }
    }

    const fmtTime = (t) => (t ? format(new Date(t), 'HH:mm:ss') : '-')

    return (
        <Layout>
            <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <ClipboardList className="h-6 w-6" />
                            Rekap Absensi
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Laporan kehadiran harian dengan filter dan export Excel
                        </p>
                    </div>
                    <Button onClick={handleExport} disabled={filtered.length === 0} className="gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        Export Excel ({filtered.length})
                    </Button>
                </div>

                {/* Filters */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Filter className="h-4 w-4" />
                            Filter
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Date presets */}
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => setPreset('today')}>
                                Hari Ini
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setPreset('yesterday')}>
                                Kemarin
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setPreset('week')}>
                                7 Hari Terakhir
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setPreset('month')}>
                                Bulan Ini
                            </Button>
                        </div>

                        {/* Date range + role + search */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" /> Dari
                                </label>
                                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" /> Sampai
                                </label>
                                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <Users className="h-3 w-3" /> Tipe
                                </label>
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value)}
                                >
                                    <option value="all">Semua</option>
                                    <option value="student">Murid</option>
                                    <option value="employee">Staff / Karyawan</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <Search className="h-3 w-3" /> Cari Nama
                                </label>
                                <Input
                                    placeholder="Ketik nama..."
                                    value={searchName}
                                    onChange={(e) => setSearchName(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Stats summary */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
                                <UserCheck className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.hadir}</p>
                                <p className="text-xs text-muted-foreground">Hadir</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                                <ClipboardList className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.izin}</p>
                                <p className="text-xs text-muted-foreground">Izin</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg">
                                <HeartPulse className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.sakit}</p>
                                <p className="text-xs text-muted-foreground">Sakit</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg">
                                <AlertCircle className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.alpha}</p>
                                <p className="text-xs text-muted-foreground">Alpha</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg">
                                <Clock className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{stats.earlyOut}</p>
                                <p className="text-xs text-muted-foreground">Pulang Awal</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Records table */}
                <Card>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex justify-center py-12">
                                <Spinner size="lg" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">Tidak ada data</p>
                                <p className="text-sm">Ubah filter untuk menampilkan rekap absensi</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            <th className="p-3 text-left font-medium">No</th>
                                            <th className="p-3 text-left font-medium">Nama</th>
                                            <th className="p-3 text-left font-medium hidden md:table-cell">Role</th>
                                            <th className="p-3 text-left font-medium hidden lg:table-cell">Kelas</th>
                                            <th className="p-3 text-left font-medium">Tanggal</th>
                                            <th className="p-3 text-left font-medium">Masuk</th>
                                            <th className="p-3 text-left font-medium">Pulang</th>
                                            <th className="p-3 text-left font-medium hidden md:table-cell">Keterangan</th>
                                            <th className="p-3 text-left font-medium hidden lg:table-cell">Lokasi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((r, i) => (
                                            <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                                                <td className="p-3 text-muted-foreground">{i + 1}</td>
                                                <td className="p-3 font-medium">{r.users?.name ?? '-'}</td>
                                                <td className="p-3 hidden md:table-cell">
                                                    <Badge variant="outline" className="text-xs">
                                                        {roleLabel(r.users?.role)}
                                                    </Badge>
                                                </td>
                                                <td className="p-3 hidden lg:table-cell text-muted-foreground">
                                                    {r.users?.classes?.name ?? '-'}
                                                </td>
                                                <td className="p-3">
                                                    {format(new Date(r.date), 'EEE, d MMM', { locale: localeId })}
                                                </td>
                                                <td className="p-3 font-mono text-xs">
                                                    {r.check_in_at ? (
                                                        fmtTime(r.check_in_at)
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </td>
                                                <td className="p-3 font-mono text-xs">
                                                    {r.check_out_at ? (
                                                        fmtTime(r.check_out_at)
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </td>
                                                <td className="p-3 hidden md:table-cell">
                                                    {r.absence_reason ? (
                                                        <Badge variant={absenceVariant(r.absence_reason)}>
                                                            {absenceReasonLabel[r.absence_reason] ?? r.absence_reason}
                                                        </Badge>
                                                    ) : r.early_checkout_reason ? (
                                                        <Badge variant={earlyReasonVariant(r.early_checkout_reason)}>
                                                            {earlyReasonLabel[r.early_checkout_reason] ?? r.early_checkout_reason}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </td>
                                                <td className="p-3 hidden lg:table-cell text-muted-foreground text-xs">
                                                    {r.locations?.name ?? '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </Layout>
    )
}
