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
import { useRoles, useRolesStore, slugifyRole, BUILTIN_ROLES } from '../store/useRolesStore'

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

const TABS = [
  { key: 'classes', label: 'Kelas', icon: BookOpen },
  { key: 'locations', label: 'Lokasi', icon: MapPin },
  { key: 'roles', label: 'Role', icon: Shield },
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
        </div>
      </div>
    </Layout>
  )
}
