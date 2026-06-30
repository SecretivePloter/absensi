// ============================================================
// Tab "Kelola" — edit caption/kategori & hapus media (dgn konfirmasi).
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent } from '../../../components/ui/card'
import { Select } from '../../../components/ui/select'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Button } from '../../../components/ui/button'
import { Spinner } from '../../../components/ui/spinner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog'
import { useToast } from '../../../components/ui/toast'
import { listCategories, listMedia, updateMedia, deleteMedia } from '../lib/galleryApi'

export default function GalleryManage({ refreshKey, onChanged }) {
  const toast = useToast()
  const [categories, setCategories] = useState([])
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(null)   // media row sedang diedit
  const [del, setDel] = useState(null)     // media row sedang dikonfirmasi hapus
  const [saving, setSaving] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      setMedia(await listMedia())
    } catch {
      setMedia([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { listCategories().then(setCategories).catch(() => {}) }, [])
  useEffect(() => { fetchAll() }, [fetchAll, refreshKey])

  const saveEdit = async () => {
    if (!edit) return
    setSaving(true)
    try {
      await updateMedia(edit.id, {
        caption: edit.caption || null,
        category_id: edit.category_id || null,
      })
      toast({ title: 'Perubahan disimpan', variant: 'success' })
      setEdit(null)
      fetchAll()
      onChanged?.()
    } catch (err) {
      toast({ title: 'Gagal menyimpan', description: err.message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!del) return
    setSaving(true)
    try {
      await deleteMedia(del)
      toast({ title: 'Foto dihapus dari Drive & galeri', variant: 'success' })
      setDel(null)
      fetchAll()
      onChanged?.()
    } catch (err) {
      toast({ title: 'Gagal menghapus', description: err.message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>
  if (media.length === 0) return <p className="text-center py-16 text-muted-foreground">Belum ada foto.</p>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {media.map((m) => (
          <Card key={m.id} className="overflow-hidden">
            <div className="aspect-square bg-muted">
              <img src={m.drive_thumb_url} alt={m.caption || ''} loading="lazy"
                className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <CardContent className="p-2 space-y-1">
              <p className="text-xs truncate">{m.caption || <span className="text-muted-foreground italic">tanpa caption</span>}</p>
              <p className="text-[10px] text-muted-foreground truncate">{m.gallery_categories?.name || 'tanpa kategori'}</p>
              <div className="flex gap-1 pt-1">
                <Button variant="outline" size="sm" className="flex-1 h-7 px-0"
                  onClick={() => setEdit({ ...m })}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="outline" size="sm" className="flex-1 h-7 px-0 text-destructive hover:text-destructive"
                  onClick={() => setDel(m)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit */}
      <Dialog open={!!edit} onClose={() => setEdit(null)}>
        <DialogContent onClose={() => setEdit(null)} className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Foto</DialogTitle></DialogHeader>
          {edit && (
            <div className="px-6 pb-2 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Caption</Label>
                <Input value={edit.caption || ''} onChange={(e) => setEdit((s) => ({ ...s, caption: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Kategori</Label>
                <Select value={edit.category_id || ''} onChange={(e) => setEdit((s) => ({ ...s, category_id: e.target.value }))}>
                  <option value="">(Tanpa kategori)</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
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

      {/* Konfirmasi hapus */}
      <Dialog open={!!del} onClose={() => setDel(null)}>
        <DialogContent onClose={() => setDel(null)} className="max-w-sm">
          <DialogHeader><DialogTitle>Hapus Foto?</DialogTitle></DialogHeader>
          <div className="px-6 pb-2 text-sm text-muted-foreground">
            Foto akan <strong className="text-foreground">dihapus permanen dari Google Drive</strong> dan dari galeri. Tindakan ini tidak bisa dibatalkan.
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
