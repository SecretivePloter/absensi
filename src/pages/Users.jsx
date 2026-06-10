import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Edit2, QrCode, ToggleLeft, ToggleRight, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/Layout'
import { QRCodeDisplay } from '../components/QRCode'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { Spinner } from '../components/ui/spinner'
import { useToast } from '../components/ui/toast'
import { exportUsersToExcel } from '../utils/exportExcel'
import { FileSpreadsheet } from 'lucide-react'

const emptyForm = { name: '', role: 'student', class_id: '', phone: '', qr_code: '', photo_url: '' }

export default function Users() {
  const toast = useToast()
  const [users, setUsers] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [classFilter, setClassFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [qrModalUser, setQrModalUser] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'File harus berupa gambar', variant: 'error' })
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Ukuran maksimal 2 MB', description: 'Kompres dulu fotonya', variant: 'error' })
      return
    }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const uploadPhoto = async (file) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `users/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('photos').upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
    })
    if (error) throw new Error(`Upload foto gagal: ${error.message}`)
    const { data } = supabase.storage.from('photos').getPublicUrl(path)
    return data.publicUrl
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: usersData }, { data: classesData }] = await Promise.all([
      supabase.from('users').select('*, classes(name)').order('name'),
      supabase.from('classes').select('id, name').order('name'),
    ])
    setUsers(usersData || [])
    setClasses(classesData || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = users.filter(u => {
    if (search && !u.name.toLowerCase().includes(search.toLowerCase())) return false
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    if (statusFilter === 'active' && !u.is_active) return false
    if (statusFilter === 'inactive' && u.is_active) return false
    if (classFilter !== 'all' && u.class_id !== classFilter) return false
    return true
  })

  const openAdd = () => {
    setEditing(null)
    setForm({ ...emptyForm, qr_code: crypto.randomUUID() })
    setPhotoFile(null)
    setPhotoPreview('')
    setFormOpen(true)
  }

  const openEdit = (u) => {
    setEditing(u)
    setForm({
      name: u.name,
      role: u.role,
      class_id: u.class_id || '',
      phone: u.phone || '',
      qr_code: u.qr_code,
      photo_url: u.photo_url || '',
    })
    setPhotoFile(null)
    setPhotoPreview(u.photo_url || '')
    setFormOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      let photoUrl = form.photo_url || null
      if (photoFile) {
        photoUrl = await uploadPhoto(photoFile)
      }

      const payload = {
        name: form.name,
        role: form.role,
        class_id: form.class_id || null,
        phone: form.phone || null,
        qr_code: form.qr_code || crypto.randomUUID(),
        photo_url: photoUrl,
      }

      if (editing) {
        const { error } = await supabase.from('users').update(payload).eq('id', editing.id)
        if (error) throw error
        toast({ title: 'Berhasil', description: 'Data pengguna diperbarui', variant: 'success' })
      } else {
        const { error } = await supabase.from('users').insert({ ...payload, is_active: true })
        if (error) throw error
        toast({ title: 'Berhasil', description: 'Pengguna baru ditambahkan', variant: 'success' })
      }

      setFormOpen(false)
      fetchData()
    } catch (err) {
      toast({ title: 'Gagal', description: err.message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (u) => {
    try {
      await supabase.from('users').update({ is_active: !u.is_active }).eq('id', u.id)
      toast({
        title: u.is_active ? 'Pengguna dinonaktifkan' : 'Pengguna diaktifkan',
        variant: 'success',
      })
      fetchData()
    } catch (err) {
      toast({ title: 'Gagal', description: err.message, variant: 'error' })
    }
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Manajemen Pengguna</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportUsersToExcel(filtered, 'users')}>
              <FileSpreadsheet className="h-4 w-4 mr-1.5" />
              Export
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1.5" />
              Tambah
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="w-36">
                <option value="all">Semua Role</option>
                <option value="student">Murid</option>
                <option value="employee">Karyawan</option>
              </Select>
              <Select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="w-40">
                <option value="all">Semua Kelas</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-36">
                <option value="all">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{filtered.length} Pengguna</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Nama</th>
                      <th className="text-left p-3 font-medium">Role</th>
                      <th className="text-left p-3 font-medium hidden md:table-cell">Kelas</th>
                      <th className="text-left p-3 font-medium hidden lg:table-cell">No HP</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-right p-3 font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(u => (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {u.photo_url ? (
                              <img src={u.photo_url} alt={u.name} className="h-8 w-8 rounded-full object-cover" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <Link to={`/users/${u.id}`} className="font-medium hover:text-primary transition-colors">
                              {u.name}
                            </Link>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant={u.role === 'student' ? 'default' : 'secondary'}>
                            {u.role === 'student' ? 'Murid' : 'Karyawan'}
                          </Badge>
                        </td>
                        <td className="p-3 hidden md:table-cell text-muted-foreground">
                          {u.classes?.name ?? '-'}
                        </td>
                        <td className="p-3 hidden lg:table-cell text-muted-foreground">
                          {u.phone ?? '-'}
                        </td>
                        <td className="p-3">
                          <Badge variant={u.is_active ? 'success' : 'outline'}>
                            {u.is_active ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => setQrModalUser(u)}
                              title="Lihat QR"
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => openEdit(u)}
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => toggleActive(u)}
                              title={u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            >
                              {u.is_active
                                ? <ToggleRight className="h-4 w-4 text-green-600" />
                                : <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                              }
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">Tidak ada data</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)}>
        <DialogContent onClose={() => setFormOpen(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <div className="p-6 pt-2 space-y-4">
              <div className="space-y-2">
                <Label>Nama Lengkap *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Role *</Label>
                  <Select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="student">Murid</option>
                    <option value="employee">Karyawan</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Kelas</Label>
                  <Select value={form.class_id} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}>
                    <option value="">Tanpa Kelas</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>No HP</Label>
                <Input
                  type="tel"
                  placeholder="08xxxxxxxxxx"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Foto</Label>
                <div className="flex items-center gap-3">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="h-14 w-14 rounded-full object-cover border"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground border">
                      Foto
                    </div>
                  )}
                  <div className="flex-1 space-y-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="cursor-pointer file:cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground">JPG/PNG, maksimal 2 MB</p>
                  </div>
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={() => { setPhotoFile(null); setPhotoPreview(''); setForm(f => ({ ...f, photo_url: '' })) }}
                      className="text-xs text-destructive hover:underline shrink-0"
                    >
                      Hapus
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>QR Code</Label>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, qr_code: crypto.randomUUID() }))}
                    className="text-xs text-primary hover:underline"
                  >
                    Generate baru
                  </button>
                </div>
                <Input
                  value={form.qr_code}
                  onChange={e => setForm(f => ({ ...f, qr_code: e.target.value }))}
                  placeholder="UUID atau kode custom"
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Spinner size="sm" className="mr-2" /> : null}
                {saving ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* QR Modal */}
      <Dialog open={!!qrModalUser} onClose={() => setQrModalUser(null)}>
        <DialogContent onClose={() => setQrModalUser(null)} className="max-w-xs">
          <DialogHeader>
            <DialogTitle>QR Code — {qrModalUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-2 flex flex-col items-center gap-3">
            <Badge variant={qrModalUser?.role === 'student' ? 'default' : 'secondary'}>
              {qrModalUser?.role === 'student' ? 'Murid' : 'Karyawan'}
            </Badge>
            {qrModalUser && (
              <QRCodeDisplay
                value={qrModalUser.qr_code}
                userName={qrModalUser.name}
                size={200}
              />
            )}
            <p className="text-xs text-muted-foreground font-mono break-all text-center">
              {qrModalUser?.qr_code}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  )
}
