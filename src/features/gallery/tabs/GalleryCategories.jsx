// ============================================================
// Tab "Kategori" — CRUD kategori galeri.
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Card, CardContent } from '../../../components/ui/card'
import { Input } from '../../../components/ui/input'
import { Button } from '../../../components/ui/button'
import { Spinner } from '../../../components/ui/spinner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog'
import { useToast } from '../../../components/ui/toast'
import { listCategories, createCategory, updateCategory, deleteCategory } from '../lib/galleryApi'

export default function GalleryCategories({ onChanged }) {
  const toast = useToast()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [edit, setEdit] = useState(null)
  const [del, setDel] = useState(null)
  const [saving, setSaving] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try { setCategories(await listCategories()) } catch { setCategories([]) } finally { setLoading(false) }
  }, [])
  useEffect(() => { fetchAll() }, [fetchAll])

  const add = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await createCategory(newName)
      setNewName('')
      toast({ title: 'Kategori ditambah', variant: 'success' })
      fetchAll(); onChanged?.()
    } catch (err) {
      toast({ title: 'Gagal', description: err.message, variant: 'error' })
    } finally { setSaving(false) }
  }

  const saveEdit = async () => {
    if (!edit?.name.trim()) return
    setSaving(true)
    try {
      await updateCategory(edit.id, edit.name)
      toast({ title: 'Kategori diperbarui', variant: 'success' })
      setEdit(null); fetchAll(); onChanged?.()
    } catch (err) {
      toast({ title: 'Gagal', description: err.message, variant: 'error' })
    } finally { setSaving(false) }
  }

  const confirmDelete = async () => {
    if (!del) return
    setSaving(true)
    try {
      await deleteCategory(del.id)
      toast({ title: 'Kategori dihapus', description: 'Foto di kategori ini menjadi tanpa kategori.', variant: 'success' })
      setDel(null); fetchAll(); onChanged?.()
    } catch (err) {
      toast({ title: 'Gagal', description: err.message, variant: 'error' })
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-2">
            <Input
              placeholder="Nama kategori baru..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') add() }}
            />
            <Button onClick={add} disabled={saving || !newName.trim()}>
              <Plus className="h-4 w-4 mr-1" />Tambah
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner size="lg" /></div>
      ) : categories.length === 0 ? (
        <p className="text-center py-10 text-muted-foreground">Belum ada kategori.</p>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">{c.slug}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEdit({ ...c })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDel(c)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Edit */}
      <Dialog open={!!edit} onClose={() => setEdit(null)}>
        <DialogContent onClose={() => setEdit(null)} className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Kategori</DialogTitle></DialogHeader>
          {edit && (
            <div className="px-6 pb-2">
              <Input value={edit.name} onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit() }} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)} disabled={saving}>Batal</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? <Spinner size="sm" className="mr-2" /> : null}Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hapus */}
      <Dialog open={!!del} onClose={() => setDel(null)}>
        <DialogContent onClose={() => setDel(null)} className="max-w-sm">
          <DialogHeader><DialogTitle>Hapus Kategori?</DialogTitle></DialogHeader>
          <div className="px-6 pb-2 text-sm text-muted-foreground">
            Kategori <strong className="text-foreground">{del?.name}</strong> akan dihapus. Foto yang memakai kategori ini tidak ikut terhapus, hanya menjadi tanpa kategori.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDel(null)} disabled={saving}>Batal</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={saving}>
              {saving ? <Spinner size="sm" className="mr-2" /> : null}Ya, Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
