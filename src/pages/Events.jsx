import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, CalendarDays, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { Spinner } from '../components/ui/spinner'
import { useToast } from '../components/ui/toast'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

const emptyForm = { name: '', start_date: '', end_date: '', is_active: true }

export default function Events() {
    const toast = useToast()
    const navigate = useNavigate()
    const [events, setEvents] = useState([])
    const [loading, setLoading] = useState(true)
    const [formOpen, setFormOpen] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState(null)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)

    const fetchEvents = useCallback(async () => {
        setLoading(true)
        const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false })
        setEvents(data || [])
        setLoading(false)
    }, [])

    useEffect(() => { fetchEvents() }, [fetchEvents])

    const openAdd = () => {
        setEditing(null)
        setForm(emptyForm)
        setFormOpen(true)
    }

    const openEdit = (ev) => {
        setEditing(ev)
        setForm({
            name: ev.name,
            start_date: ev.start_date || '',
            end_date: ev.end_date || '',
            is_active: ev.is_active
        })
        setFormOpen(true)
    }

    const handleSave = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            const payload = {
                name: form.name,
                start_date: form.start_date || null,
                end_date: form.end_date || null,
                is_active: form.is_active
            }
            if (editing) {
                const { error } = await supabase.from('events').update(payload).eq('id', editing.id)
                if (error) throw error
                toast({ title: 'Berhasil', description: 'Event diperbarui', variant: 'success' })
            } else {
                const { error } = await supabase.from('events').insert(payload)
                if (error) throw error
                toast({ title: 'Berhasil', description: 'Event baru ditambahkan', variant: 'success' })
            }
            setFormOpen(false)
            fetchEvents()
        } catch (err) {
            toast({ title: 'Gagal', description: err.message, variant: 'error' })
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!deleteConfirm) return
        try {
            const { error } = await supabase.from('events').delete().eq('id', deleteConfirm.id)
            if (error) throw error
            toast({ title: 'Event dihapus', variant: 'success' })
            setDeleteConfirm(null)
            fetchEvents()
        } catch (err) {
            toast({ title: 'Gagal', description: err.message, variant: 'error' })
        }
    }

    const formatDate = (dateStr) => {
        if (!dateStr) return '-'
        return format(new Date(dateStr), 'd MMM yyyy', { locale: idLocale })
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <CalendarDays className="h-6 w-6 text-primary" />
                        Manajemen Event Belajar Malam
                    </h1>
                    <p className="text-muted-foreground mt-1">Kelola data kegiatan khusus, tryout, dsb.</p>
                </div>
                <Button onClick={openAdd} className="shrink-0">
                    <Plus className="h-4 w-4 mr-2" />
                    Buat Event
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {events.map(ev => (
                        <Card key={ev.id} className="relative group border-l-4 overflow-hidden flex flex-col" style={{ borderLeftColor: ev.is_active ? '#22c55e' : '#6b7280' }}>
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <CardTitle className="leading-tight text-lg">{ev.name}</CardTitle>
                                        <div className="text-sm text-muted-foreground mt-1.5 flex items-center gap-1.5">
                                            <CalendarDays className="h-3.5 w-3.5" />
                                            {formatDate(ev.start_date)} {ev.end_date ? '— ' + formatDate(ev.end_date) : ''}
                                        </div>
                                    </div>
                                    <div className="bg-background/80 flex gap-1 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(ev)} title="Edit Event">
                                            <Edit2 className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(ev)} title="Hapus Event">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ev.is_active ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-gray-500/10 text-gray-600 dark:text-gray-400'}`}>
                                        {ev.is_active ? 'Aktif' : 'Selesai'}
                                    </span>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-0 pb-4">
                                <Button variant="secondary" className="w-full" onClick={() => navigate(`/events/${ev.id}`)}>
                                    <Users className="h-4 w-4 mr-2" />
                                    Kelola Partisipan & Absensi
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}

                    {events.length === 0 && (
                        <div className="col-span-full border-2 border-dashed rounded-lg p-12 text-center text-muted-foreground">
                            Belum ada event. Mulai dengan membuat event baru.
                        </div>
                    )}
                </div>
            )}

            {/* Dialog Add/Edit */}
            <Dialog open={formOpen} onClose={() => setFormOpen(false)}>
                <DialogContent onClose={() => setFormOpen(false)} className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Edit Event' : 'Buat Event Baru'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave}>
                        <div className="p-6 pt-2 space-y-4">
                            <div className="space-y-2">
                                <Label>Nama Event *</Label>
                                <Input
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="Contoh: Belajar Malam Desember"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Tanggal Mulai</Label>
                                    <Input
                                        type="date"
                                        value={form.start_date}
                                        onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Tanggal Selesai</Label>
                                    <Input
                                        type="date"
                                        value={form.end_date}
                                        onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={form.is_active}
                                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                                />
                                <Label htmlFor="isActive" className="cursor-pointer">Event Masih Berjalan (Aktif)</Label>
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
                        <DialogTitle>Hapus Event</DialogTitle>
                    </DialogHeader>
                    <div className="p-6 pt-2">
                        <p className="text-sm text-muted-foreground">
                            Apakah Anda yakin ingin menghapus event <strong>{deleteConfirm?.name}</strong>?
                            Ini akan menghapus seluruh data pendaftaran peserta beserta riwayat absennya di event tersebut!
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Batal</Button>
                        <Button variant="destructive" onClick={handleDelete}>Ya, Hapus</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
