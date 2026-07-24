import { useState } from 'react'
import { BookOpen, MapPin, Shield, Plus, Trash2, Lock } from 'lucide-react'
import { clsx } from 'clsx'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/Layout'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent } from '../components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { Spinner } from '../components/ui/spinner'
import { useToast } from '../components/ui/toast'
import { ClassesManager } from './Classes'
import { LocationsManager } from './Locations'
import { useRoles, useRolesStore, slugifyRole, BUILTIN_ROLES, isStaffRole } from '../store/useRolesStore'
import { exportMassPayrollReport } from '../utils/exportPayroll'

// Role bawaan tidak boleh dihapus (dipakai logika inti aplikasi).
const PROTECTED = new Set(BUILTIN_ROLES.map(r => r.value))

function RolesManager() {
  const toast = useToast()
  const roles = useRoles()
  const addRole = useRolesStore(s => s.addRole)
  const deleteRole = useRolesStore(s => s.deleteRole)

  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const handleAdd = async () => {
    const label = newLabel.trim()
    if (!label) return
    const value = slugifyRole(label)
    if (!value) {
      toast({ title: 'Nama role tidak valid', description: 'Gunakan huruf/angka.', variant: 'error' })
      return
    }
    if (roles.some(r => r.value === value)) {
      toast({ title: 'Role sudah ada', description: `"${label}" sudah terdaftar.`, variant: 'error' })
      return
    }
    setSaving(true)
    try {
      await addRole({ value, label })
      toast({ title: 'Role ditambahkan', description: label, variant: 'success' })
      setNewLabel('')
    } catch (err) {
      toast({ title: 'Gagal menambah role', description: err.message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      // Jangan hapus jika masih ada pengguna memakai role ini.
      const { count, error } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', deleteTarget.value)
      if (error) throw error
      if (count && count > 0) {
        toast({
          title: 'Role masih dipakai',
          description: `${count} pengguna masih memakai role ini. Ubah role mereka dulu.`,
          variant: 'error',
        })
        setDeleteTarget(null)
        return
      }
      await deleteRole(deleteTarget.value)
      toast({ title: 'Role dihapus', description: deleteTarget.label, variant: 'success' })
      setDeleteTarget(null)
    } catch (err) {
      toast({ title: 'Gagal menghapus', description: err.message, variant: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold">Manajemen Role</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Role/posisi yang bisa dipilih untuk pengguna. Role baru otomatis dihitung sebagai karyawan/staff.
          </p>
        </div>

        {/* Tambah role */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <Label>Nama role baru</Label>
            <Input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="mis. HRD, Manager, Marketing"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
            />
          </div>
          <Button onClick={handleAdd} disabled={saving || !newLabel.trim()}>
            {saving ? <Spinner size="sm" className="mr-2" /> : <Plus className="h-4 w-4 mr-1.5" />}
            {saving ? 'Menyimpan...' : 'Tambah Role'}
          </Button>
        </div>
        {newLabel.trim() && (
          <p className="text-xs text-muted-foreground -mt-3">
            Kode role: <span className="font-mono">{slugifyRole(newLabel) || '-'}</span>
          </p>
        )}

        {/* Daftar role */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {roles.map(r => {
            const locked = PROTECTED.has(r.value)
            return (
              <Card key={r.value} className="group">
                <CardContent className="py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.label}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {r.value}{r.is_staff ? ' · staff' : ' · murid'}
                    </p>
                  </div>
                  {locked ? (
                    <span title="Role bawaan tidak bisa dihapus" className="text-muted-foreground/60 shrink-0">
                      <Lock className="h-4 w-4" />
                    </span>
                  ) : (
                    <Button
                      variant="ghost" size="icon"
                      className="text-destructive hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setDeleteTarget(r)}
                      title="Hapus role"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Konfirmasi hapus role */}
      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)}>
        <DialogContent onClose={deleting ? undefined : () => setDeleteTarget(null)} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Role</DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-2">
            <p className="text-sm text-muted-foreground">
              Hapus role <strong className="text-foreground">{deleteTarget?.label}</strong>?
              Role hanya bisa dihapus bila tidak ada pengguna yang memakainya.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Spinner size="sm" className="mr-2" /> : null}
              {deleting ? 'Menghapus...' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function MassExportManager() {
  const toast = useToast()

  // Default to current year-month
  const now = new Date()
  const currentMonthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [monthStr, setMonthStr] = useState(currentMonthValue)
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      if (!monthStr) throw new Error('Pilih bulan terlebih dahulu.')

      // Hitung periode dari 21 bulan lalu ke 20 bulan yg dipilih
      const [y, m] = monthStr.split('-').map(Number)
      const dateSelected = new Date(y, m - 1) // m is 1-based, getMonth is 0-based

      const startDate = new Date(dateSelected)
      startDate.setMonth(startDate.getMonth() - 1)
      startDate.setDate(21)

      const endDate = new Date(dateSelected)
      endDate.setDate(20)

      const startLabel = startDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      const endLabel = endDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      const periodLabel = `${startLabel} - ${endLabel}`

      const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
      const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

      // 1. Ambil list semua pengguna yang aktif (atau yang pernah aktif & punya data absensi)
      // Kita abaikan is_active untuk berjaga jika staff sudah nonaktif tapi ada gajj. 
      const { data: users, error: errU } = await supabase
        .from('users')
        .select('id, name, role')

      if (errU) throw errU

      const staffUsers = users.filter(u => isStaffRole(u.role))
      if (staffUsers.length === 0) {
        throw new Error('Tidak ada akun staff ditemukan.')
      }

      const staffIds = staffUsers.map(u => u.id)

      // 2. Ambil absensinya semua sekaligus
      const { data: attendance, error: errA } = await supabase
        .from('attendance')
        .select(`
          id, user_id, date, check_in_at, check_out_at, method, early_checkout_reason, notes,
          locations (name)
        `)
        .in('user_id', staffIds)
        .gte('date', startStr)
        .lte('date', endStr)
        .order('date', { ascending: true })

      if (errA) throw errA

      // 3. Kelompokkan absen berdasarkan staf
      // Hasil akhir: array isi { staffName, records: [...] }
      const recordsByStaff = staffUsers.map(staff => {
        return {
          staffName: staff.name,
          records: attendance.filter(a => a.user_id === staff.id)
        }
      })

      // Sort staff berdasarkan nama untuk output berurut
      recordsByStaff.sort((a, b) => a.staffName.localeCompare(b.staffName))

      // 4. Ekspor ke Excel
      exportMassPayrollReport({
        recordsByStaff,
        periodStart: startDate,
        periodEnd: endDate,
        filename: `Rekap_Bulan_${monthStr}`
      })
      toast({ title: 'Ekspor berhasil!', description: `Mengekspor ${recordsByStaff.length} entri staf.`, variant: 'success' })

    } catch (err) {
      console.error(err)
      toast({ title: 'Gagal mengekspor data', description: err.message, variant: 'error' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-xl font-bold">Ekspor Massal Absensi</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Unduh laporan absensi bagi semua akun staff (HRD, Sensei, Director, dll). Masing-masing orang disajikan pada <i>Sheet</i> tersendiri.
        </p>
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="periodMonth">Bulan Acuan</Label>
            <Input
              id="periodMonth"
              type="month"
              value={monthStr}
              onChange={e => setMonthStr(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Catatan: Periode rekap ditetapkan otomatis dari tanggal <strong>21 bulan sebelumnya</strong> ke <strong>20 bulan yang dipilih</strong>.
            </p>
          </div>

          <Button onClick={handleExport} disabled={exporting || !monthStr} className="w-full">
            {exporting ? <Spinner size="sm" className="mr-2" /> : null}
            {exporting ? 'Menyusun File Excel...' : 'Ekspor Laporan (Excel)'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

import { Download } from 'lucide-react'

const TABS = [
  { key: 'classes', label: 'Kelas', icon: BookOpen },
  { key: 'locations', label: 'Lokasi', icon: MapPin },
  { key: 'roles', label: 'Role', icon: Shield },
  { key: 'export', label: 'Ekspor Massal', icon: Download },
]

export default function Settings() {
  const [tab, setTab] = useState('classes')

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Pengaturan</h1>

        {/* Tab switcher */}
        <div className="flex gap-1 border-b">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Konten tab */}
        <div>
          {tab === 'classes' && <ClassesManager />}
          {tab === 'locations' && <LocationsManager />}
          {tab === 'roles' && <RolesManager />}
          {tab === 'export' && <MassExportManager />}
        </div>
      </div>
    </Layout>
  )
}
