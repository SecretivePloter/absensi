// ============================================================
// Tab "WA Admin" — kelola nomor WhatsApp admin (untuk fase bot WA).
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { Trash2, Plus, Star } from 'lucide-react'
import { Card, CardContent } from '../../../components/ui/card'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'
import { Spinner } from '../../../components/ui/spinner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog'
import { useToast } from '../../../components/ui/toast'
import { listWaAdmins, createWaAdmin, deleteWaAdmin } from '../lib/galleryApi'

export default function GalleryWaAdmins() {
  const toast = useToast()
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ phone: '', name: '', is_super_admin: false })
  const [del, setDel] = useState(null)
  const [saving, setSaving] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try { setAdmins(await listWaAdmins()) } catch { setAdmins([]) } finally { setLoading(false) }
  }, [])
  useEffect(() => { fetchAll() }, [fetchAll])

  const add = async () => {
    const phone = form.phone.replace(/[^0-9]/g, '')
    if (!phone) { toast({ title: 'Nomor wajib diisi', variant: 'error' }); return }
    if (!phone.startsWith('62')) { toast({ title: 'Gunakan format 62xxx', variant: 'error' }); return }
    setSaving(true)
    try {
      await createWaAdmin({ ...form, phone })
      setForm({ phone: '', name: '', is_super_admin: false })
      toast({ title: 'Admin WA ditambah', variant: 'success' })
      fetchAll()
    } catch (err) {
      const msg = err.message?.includes('duplicate') ? 'Nomor sudah terdaftar' : err.message
      toast({ title: 'Gagal', description: msg, variant: 'error' })
    } finally { setSaving(false) }
  }

  const confirmDelete = async () => {
    if (!del) return
    setSaving(true)
    try {
      await deleteWaAdmin(del.id)
      toast({ title: 'Admin WA dihapus', variant: 'success' })
      setDel(null); fetchAll()
    } catch (err) {
      toast({ title: 'Gagal', description: err.message, variant: 'error' })
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
        Nomor di sini dipakai untuk fase <strong>Bot WhatsApp</strong> (kirim foto via WA → masuk galeri). Hanya nomor super admin yang nanti bisa menambah admin lewat WA.
      </div>

      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nomor WhatsApp (62xxx)</Label>
              <Input placeholder="6281xxxxxxxxx" value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nama</Label>
              <Input placeholder="Nama admin" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_super_admin}
              onChange={(e) => setForm((f) => ({ ...f, is_super_admin: e.target.checked }))} />
            Jadikan super admin
          </label>
          <div className="flex justify-end">
            <Button onClick={add} disabled={saving}>
              <Plus className="h-4 w-4 mr-1" />Tambah Admin
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner size="lg" /></div>
      ) : admins.length === 0 ? (
        <p className="text-center py-10 text-muted-foreground">Belum ada admin WA.</p>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {admins.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      {a.name || 'Tanpa nama'}
                      {a.is_super_admin && (
                        <Badge variant="warning" className="gap-1"><Star className="h-3 w-3" />Super</Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">{a.phone}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDel(a)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!del} onClose={() => setDel(null)}>
        <DialogContent onClose={() => setDel(null)} className="max-w-sm">
          <DialogHeader><DialogTitle>Hapus Admin WA?</DialogTitle></DialogHeader>
          <div className="px-6 pb-2 text-sm text-muted-foreground">
            Nomor <strong className="text-foreground">{del?.phone}</strong> ({del?.name || 'tanpa nama'}) akan dihapus dari daftar admin WhatsApp.
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
