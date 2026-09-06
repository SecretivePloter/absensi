import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { Plus, Trash2, Music, Play, Library, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { playAudio } from '../utils/audioPlayer'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { Spinner } from '../components/ui/spinner'
import { useToast } from '../components/ui/toast'

const CATEGORY_LABEL = { default: 'Default', event: 'Event', custom: 'Custom' }
const DIRECTION_LABEL = { masuk: 'Masuk', pulang: 'Pulang' }
const trackBadgeLabel = (t) => t.category === 'default'
  ? `Default · ${DIRECTION_LABEL[t.direction] || '?'}`
  : (CATEGORY_LABEL[t.category] || t.category)

const emptyTrackForm = { label: '', category: 'default', direction: 'masuk' }
const emptyDayForm = { event_date: '', audio_id: '', label: '' }

export function AudioManager() {
  const toast = useToast()

  // ---- Pustaka Audio (upload sekali, dipakai berulang lewat selector) ----
  const [tracks, setTracks] = useState([])
  const [loadingTracks, setLoadingTracks] = useState(true)
  const [trackFormOpen, setTrackFormOpen] = useState(false)
  const [editingTrack, setEditingTrack] = useState(null)
  const [trackForm, setTrackForm] = useState(emptyTrackForm)
  const [trackFile, setTrackFile] = useState(null)
  const [savingTrack, setSavingTrack] = useState(false)
  const [deleteTrackConfirm, setDeleteTrackConfirm] = useState(null)

  const fetchTracks = useCallback(async () => {
    setLoadingTracks(true)
    const { data, error } = await supabase.from('audio_library').select('*').order('created_at', { ascending: false })
    if (!error) setTracks(data || [])
    setLoadingTracks(false)
  }, [])

  useEffect(() => { fetchTracks() }, [fetchTracks])

  const openAddTrack = () => {
    setEditingTrack(null)
    setTrackForm(emptyTrackForm)
    setTrackFile(null)
    setTrackFormOpen(true)
  }

  const openEditTrack = (t) => {
    setEditingTrack(t)
    setTrackForm({ label: t.label, category: t.category, direction: t.direction || 'masuk' })
    setTrackFile(null)
    setTrackFormOpen(true)
  }

  const handleTrackFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('audio/')) {
      toast({ title: 'File harus berupa audio', variant: 'error' })
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: 'Ukuran maksimal 3 MB', variant: 'error' })
      return
    }
    setTrackFile(file)
    if (!trackForm.label) {
      setTrackForm(f => ({ ...f, label: file.name.replace(/\.[^/.]+$/, '') }))
    }
  }

  const handleSaveTrack = async (e) => {
    e.preventDefault()
    if (!trackForm.label.trim()) {
      toast({ title: 'Isi label/judul audio dulu', variant: 'error' })
      return
    }
    if (!editingTrack && !trackFile) {
      toast({ title: 'Pilih file audio dulu', variant: 'error' })
      return
    }
    setSavingTrack(true)
    try {
      const payload = {
        label: trackForm.label.trim(),
        category: trackForm.category,
        direction: trackForm.category === 'default' ? trackForm.direction : null,
      }

      if (editingTrack) {
        // Edit metadata saja — file audio tidak diganti.
        const { error } = await supabase.from('audio_library').update(payload).eq('id', editingTrack.id)
        if (error) throw error
        toast({ title: 'Berhasil', description: 'Audio diperbarui', variant: 'success' })
      } else {
        const ext = trackFile.name.split('.').pop()?.toLowerCase() || 'mp3'
        const path = `library/${crypto.randomUUID()}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('audio').upload(path, trackFile, {
          cacheControl: '3600',
          contentType: trackFile.type,
        })
        if (uploadErr) throw new Error(`Upload audio gagal: ${uploadErr.message}`)
        const { data: urlData } = supabase.storage.from('audio').getPublicUrl(path)

        const { error } = await supabase.from('audio_library').insert({ ...payload, audio_url: urlData.publicUrl })
        if (error) throw error
        toast({ title: 'Berhasil', description: 'Audio ditambahkan ke pustaka', variant: 'success' })
      }

      setTrackFormOpen(false)
      fetchTracks()
    } catch (err) {
      toast({ title: 'Gagal', description: err.message, variant: 'error' })
    } finally {
      setSavingTrack(false)
    }
  }

  const handleDeleteTrack = async () => {
    if (!deleteTrackConfirm) return
    try {
      const { error } = await supabase.from('audio_library').delete().eq('id', deleteTrackConfirm.id)
      if (error) throw error
      toast({ title: 'Dihapus dari pustaka', variant: 'success' })
      setDeleteTrackConfirm(null)
      fetchTracks()
    } catch (err) {
      toast({ title: 'Gagal menghapus', description: err.message, variant: 'error' })
    }
  }

  // ---- Audio hari spesial (pilih dari pustaka) ----
  const [days, setDays] = useState([])
  const [loadingDays, setLoadingDays] = useState(true)
  const [dayFormOpen, setDayFormOpen] = useState(false)
  const [deleteDayConfirm, setDeleteDayConfirm] = useState(null)
  const [dayForm, setDayForm] = useState(emptyDayForm)
  const [savingDay, setSavingDay] = useState(false)

  const fetchDays = useCallback(async () => {
    setLoadingDays(true)
    const { data, error } = await supabase.from('special_audio_days').select('*').order('event_date', { ascending: false })
    if (!error) setDays(data || [])
    setLoadingDays(false)
  }, [])

  useEffect(() => { fetchDays() }, [fetchDays])

  const openAddDay = () => {
    setDayForm(emptyDayForm)
    setDayFormOpen(true)
  }

  const handleSaveDay = async (e) => {
    e.preventDefault()
    if (!dayForm.event_date || !dayForm.audio_id) return
    setSavingDay(true)
    try {
      const track = tracks.find(t => t.id === dayForm.audio_id)
      if (!track) throw new Error('Audio tidak ditemukan di pustaka')

      const { error } = await supabase.from('special_audio_days').upsert({
        event_date: dayForm.event_date,
        label: dayForm.label || track.label,
        audio_url: track.audio_url,
      }, { onConflict: 'event_date' })
      if (error) throw error

      toast({ title: 'Berhasil', description: 'Audio hari spesial disimpan', variant: 'success' })
      setDayFormOpen(false)
      fetchDays()
    } catch (err) {
      toast({ title: 'Gagal', description: err.message, variant: 'error' })
    } finally {
      setSavingDay(false)
    }
  }

  const handleDeleteDay = async () => {
    if (!deleteDayConfirm) return
    try {
      const { error } = await supabase.from('special_audio_days').delete().eq('id', deleteDayConfirm.id)
      if (error) throw error
      toast({ title: 'Dihapus', variant: 'success' })
      setDeleteDayConfirm(null)
      fetchDays()
    } catch (err) {
      toast({ title: 'Gagal menghapus', description: err.message, variant: 'error' })
    }
  }

  return (
    <>
      <div className="space-y-8 max-w-2xl">
        {/* Pustaka Audio */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Library className="h-5 w-5" /> Pustaka Audio
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Upload sekali di sini, lalu pilih lewat selector di profil user atau audio hari spesial.
                Kategori & label bisa diubah kapan saja lewat tombol edit — tidak terkunci sejak upload.
              </p>
              <ul className="text-xs text-muted-foreground mt-2 space-y-0.5 list-disc list-inside">
                <li><strong>Default</strong> — ikut variasi acak di kiosk scan (pisah arah Masuk/Pulang).</li>
                <li><strong>Event</strong> — bisa dipilih untuk Audio Hari Spesial di bawah.</li>
                <li><strong>Custom</strong> — bisa dipilih sebagai audio pribadi per user (halaman Pengguna).</li>
              </ul>
            </div>
            <Button size="sm" onClick={openAddTrack}>
              <Plus className="h-4 w-4 mr-1.5" /> Upload
            </Button>
          </div>

          {loadingTracks ? (
            <div className="flex justify-center py-8"><Spinner size="lg" /></div>
          ) : (
            <div className="space-y-2">
              {tracks.map(t => (
                <Card key={t.id}>
                  <CardContent className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2">
                      <Music className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{t.label}</p>
                        <Badge variant="outline" className="text-[10px]">{trackBadgeLabel(t)}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => playAudio(t.audio_url)} title="Dengarkan">
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditTrack(t)} title="Edit label/kategori">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTrackConfirm(t)}
                        title="Hapus"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {tracks.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Pustaka masih kosong. Upload audio pertama kamu.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Audio hari spesial */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Music className="h-5 w-5" /> Audio Hari Spesial
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Pada tanggal yang dipilih, SEMUA orang yang absen (masuk & pulang) akan mendengar audio ini,
                menggantikan audio pribadi/acak sementara untuk hari itu saja.
              </p>
            </div>
            <Button size="sm" onClick={openAddDay} disabled={tracks.length === 0}>
              <Plus className="h-4 w-4 mr-1.5" /> Tambah
            </Button>
          </div>

          {loadingDays ? (
            <div className="flex justify-center py-8"><Spinner size="lg" /></div>
          ) : (
            <div className="space-y-2">
              {days.map(d => (
                <Card key={d.id}>
                  <CardContent className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {format(new Date(d.event_date + 'T00:00:00'), 'EEEE, d MMMM yyyy', { locale: id })}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{d.label || 'Tanpa label'}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => playAudio(d.audio_url)} title="Dengarkan">
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteDayConfirm(d)}
                        title="Hapus"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {days.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Belum ada audio hari spesial.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dialog: Upload / Edit Pustaka */}
      <Dialog open={trackFormOpen} onClose={() => setTrackFormOpen(false)}>
        <DialogContent onClose={() => setTrackFormOpen(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTrack ? 'Edit Audio' : 'Upload Audio ke Pustaka'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveTrack}>
            <div className="p-6 pt-2 space-y-4">
              {!editingTrack && (
                <div className="space-y-2">
                  <Label>File Audio *</Label>
                  <Input type="file" accept="audio/*" onChange={handleTrackFileChange} className="cursor-pointer file:cursor-pointer" required />
                  <p className="text-xs text-muted-foreground">{trackFile ? trackFile.name : 'MP3, maksimal 3 MB'}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Label / Judul *</Label>
                <Input
                  value={trackForm.label}
                  onChange={e => setTrackForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="mis. Semangat Pagi, Selamat Jalan"
                  required
                />
                <p className="text-xs text-muted-foreground">Supaya gampang dikenali saat memilih di selector.</p>
              </div>
              <div className="space-y-2">
                <Label>Kategori *</Label>
                <Select value={trackForm.category} onChange={e => setTrackForm(f => ({ ...f, category: e.target.value }))}>
                  <option value="default">Default (ikut variasi acak)</option>
                  <option value="event">Event / Hari Spesial</option>
                  <option value="custom">Custom (audio pribadi user)</option>
                </Select>
              </div>
              {trackForm.category === 'default' && (
                <div className="space-y-2">
                  <Label>Arah *</Label>
                  <Select value={trackForm.direction} onChange={e => setTrackForm(f => ({ ...f, direction: e.target.value }))}>
                    <option value="masuk">Masuk (datang)</option>
                    <option value="pulang">Pulang</option>
                  </Select>
                  <p className="text-xs text-muted-foreground">Menentukan pool acak mana yang memakai audio ini.</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTrackFormOpen(false)}>Batal</Button>
              <Button type="submit" disabled={savingTrack}>
                {savingTrack ? <Spinner size="sm" className="mr-2" /> : null}
                {savingTrack ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Hapus dari Pustaka */}
      <Dialog open={!!deleteTrackConfirm} onClose={() => setDeleteTrackConfirm(null)}>
        <DialogContent onClose={() => setDeleteTrackConfirm(null)} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Audio dari Pustaka</DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-2">
            <p className="text-sm text-muted-foreground">
              Hapus <strong>{deleteTrackConfirm?.label}</strong> dari pustaka? User yang sudah memilih audio ini
              sebagai audio pribadinya akan kembali ke audio acak default.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTrackConfirm(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDeleteTrack}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Tambah Audio Hari Spesial (pilih dari pustaka) */}
      <Dialog open={dayFormOpen} onClose={() => setDayFormOpen(false)}>
        <DialogContent onClose={() => setDayFormOpen(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Audio Hari Spesial</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveDay}>
            <div className="p-6 pt-2 space-y-4">
              <div className="space-y-2">
                <Label>Tanggal *</Label>
                <Input
                  type="date"
                  value={dayForm.event_date}
                  onChange={e => setDayForm(f => ({ ...f, event_date: e.target.value }))}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Kalau tanggal ini sudah punya audio, akan ditimpa dengan yang baru.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Pilih Audio dari Pustaka *</Label>
                <Select
                  value={dayForm.audio_id}
                  onChange={e => setDayForm(f => ({ ...f, audio_id: e.target.value }))}
                  required
                >
                  <option value="">— Pilih audio —</option>
                  {tracks.map(t => (
                    <option key={t.id} value={t.id}>{t.label} ({trackBadgeLabel(t)})</option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">Dipakai untuk absen masuk maupun pulang pada tanggal ini.</p>
              </div>
              <div className="space-y-2">
                <Label>Label Tampilan (opsional)</Label>
                <Input
                  value={dayForm.label}
                  onChange={e => setDayForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="mis. Hari Kemerdekaan, Ujian Akhir"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDayFormOpen(false)}>Batal</Button>
              <Button type="submit" disabled={savingDay}>
                {savingDay ? <Spinner size="sm" className="mr-2" /> : null}
                {savingDay ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Hapus Audio Hari Spesial */}
      <Dialog open={!!deleteDayConfirm} onClose={() => setDeleteDayConfirm(null)}>
        <DialogContent onClose={() => setDeleteDayConfirm(null)} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Audio Hari Spesial</DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-2">
            <p className="text-sm text-muted-foreground">
              Hapus audio untuk tanggal{' '}
              <strong>{deleteDayConfirm && format(new Date(deleteDayConfirm.event_date + 'T00:00:00'), 'd MMMM yyyy', { locale: id })}</strong>?
              Hari itu akan kembali pakai audio pribadi/acak biasa.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDayConfirm(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDeleteDay}>Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
