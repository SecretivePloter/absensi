import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/Layout'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { Spinner } from '../components/ui/spinner'
import { useToast } from '../components/ui/toast'

const emptyForm = { name: '', address: '' }

export default function Locations() {
  const toast = useToast()
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchLocations = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('locations').select('*').order('name')
    setLocations(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchLocations() }, [fetchLocations])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  const openEdit = (l) => {
    setEditing(l)
    setForm({ name: l.name, address: l.address || '' })
    setFormOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { name: form.name, address: form.address || null }
      if (editing) {
        const { error } = await supabase.from('locations').update(payload).eq('id', editing.id)
        if (error) throw error
        toast({ title: 'Berhasil', description: 'Lokasi diperbarui', variant: 'success' })
      } else {
        const { error } = await supabase.from('locations').insert(payload)
        if (error) throw error
        toast({ title: 'Berhasil', description: 'Lokasi baru ditambahkan', variant: 'success' })
      }
      setFormOpen(false)
      fetchLocations()
    } catch (err) {
      toast({ title: 'Gagal', description: err.message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    try {
      const { error } = await supabase.from('locations').delete().eq('id', deleteConfirm.id)
      if (error) throw error
      toast({ title: 'Lokasi dihapus', variant: 'success' })
      setDeleteConfirm(null)
      fetchLocations()
    } catch (err) {
      toast({ title: 'Gagal', description: err.message, variant: 'error' })
    }
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Lokasi Kantor</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Lokasi yang bisa dipilih di halaman scan QR
            </p>
          </div>
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1.5" />
            Tambah Lokasi
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {locations.map(l => (
              <Card key={l.id} className="relative group">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary shrink-0" />
                      {l.name}
                    </CardTitle>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(l)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirm(l)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{l.address || 'Tanpa alamat'}</p>
                </CardContent>
              </Card>
            ))}
            {locations.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                Belum ada lokasi. Tambahkan lokasi kantor supaya bisa dipilih di halaman scan.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)}>
        <DialogContent onClose={() => setFormOpen(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Lokasi' : 'Tambah Lokasi Baru'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <div className="p-6 pt-2 space-y-4">
              <div className="space-y-2">
                <Label>Nama Lokasi *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Contoh: Kantor Pusat"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Alamat</Label>
                <Input
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Alamat singkat (opsional)"
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

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogContent onClose={() => setDeleteConfirm(null)} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Lokasi</DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-2">
            <p className="text-sm text-muted-foreground">
              Hapus lokasi <strong>{deleteConfirm?.name}</strong>? Riwayat absensi di lokasi ini
              tidak terhapus, tapi nama lokasinya akan hilang dari record lama.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  )
}
