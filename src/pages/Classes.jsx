import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/Layout'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { Spinner } from '../components/ui/spinner'
import { useToast } from '../components/ui/toast'

const emptyForm = { name: '', description: '', schedule: '' }

export default function Classes() {
  const toast = useToast()
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchClasses = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('classes')
      .select('*, users(id)')
      .order('name')
    setClasses((data || []).map(c => ({ ...c, studentCount: c.users?.length ?? 0 })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchClasses() }, [fetchClasses])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  const openEdit = (c) => {
    setEditing(c)
    setForm({ name: c.name, description: c.description || '', schedule: c.schedule || '' })
    setFormOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { name: form.name, description: form.description || null, schedule: form.schedule || null }
      if (editing) {
        const { error } = await supabase.from('classes').update(payload).eq('id', editing.id)
        if (error) throw error
        toast({ title: 'Berhasil', description: 'Kelas diperbarui', variant: 'success' })
      } else {
        const { error } = await supabase.from('classes').insert(payload)
        if (error) throw error
        toast({ title: 'Berhasil', description: 'Kelas baru ditambahkan', variant: 'success' })
      }
      setFormOpen(false)
      fetchClasses()
    } catch (err) {
      toast({ title: 'Gagal', description: err.message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    try {
      const { error } = await supabase.from('classes').delete().eq('id', deleteConfirm.id)
      if (error) throw error
      toast({ title: 'Kelas dihapus', variant: 'success' })
      setDeleteConfirm(null)
      fetchClasses()
    } catch (err) {
      toast({ title: 'Gagal', description: err.message, variant: 'error' })
    }
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Manajemen Kelas</h1>
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1.5" />
            Tambah Kelas
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map(c => (
              <Card key={c.id} className="relative group">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{c.name}</CardTitle>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirm(c)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
                  {c.schedule && (
                    <p className="text-xs bg-muted rounded px-2 py-1 inline-block">📅 {c.schedule}</p>
                  )}
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2">
                    <Users className="h-4 w-4" />
                    <span>{c.studentCount} murid</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {classes.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                Belum ada kelas. Klik "Tambah Kelas" untuk memulai.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)}>
        <DialogContent onClose={() => setFormOpen(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Kelas' : 'Tambah Kelas Baru'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <div className="p-6 pt-2 space-y-4">
              <div className="space-y-2">
                <Label>Nama Kelas *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Contoh: N5 Pemula"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Deskripsi</Label>
                <Input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Deskripsi singkat kelas"
                />
              </div>
              <div className="space-y-2">
                <Label>Jadwal</Label>
                <Input
                  value={form.schedule}
                  onChange={e => setForm(f => ({ ...f, schedule: e.target.value }))}
                  placeholder="Contoh: Senin & Rabu, 09:00 - 11:00"
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
            <DialogTitle>Hapus Kelas</DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-2">
            <p className="text-sm text-muted-foreground">
              Hapus kelas <strong>{deleteConfirm?.name}</strong>? Murid di kelas ini tidak akan dihapus,
              tapi mereka tidak akan terhubung ke kelas manapun.
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
