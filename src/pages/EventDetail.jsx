import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, UserPlus, Trash2, CalendarDays, ExternalLink, QrCode, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { Spinner } from '../components/ui/spinner'
import { useToast } from '../components/ui/toast'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

export default function EventDetail() {
    const { eventId } = useParams()
    const navigate = useNavigate()
    const toast = useToast()

    const [event, setEvent] = useState(null)
    const [participants, setParticipants] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('participants')

    // States for adding participant
    const [addModalOpen, setAddModalOpen] = useState(false)
    const [usersRef, setUsersRef] = useState([])
    const [searchUser, setSearchUser] = useState('')
    const [addingId, setAddingId] = useState(null)

    // Attendance state
    const [attendance, setAttendance] = useState([])
    const [attendanceDate, setAttendanceDate] = useState(format(new Date(), 'yyyy-MM-dd'))

    // Manual Status Modal
    const [statusModalOpen, setStatusModalOpen] = useState(false)
    const [selectedParticipant, setSelectedParticipant] = useState(null)
    const [manualStatus, setManualStatus] = useState('izin')
    const [manualNotes, setManualNotes] = useState('')
    const [savingStatus, setSavingStatus] = useState(false)

    const fetchEventData = useCallback(async () => {
        setLoading(true)
        const { data: eventData } = await supabase.from('events').select('*').eq('id', eventId).single()
        setEvent(eventData)

        const { data: parts } = await supabase
            .from('event_participants')
            .select('id, user_id, users(name, role)')
            .eq('event_id', eventId)
            .order('created_at', { ascending: false })

        setParticipants(parts || [])

        // Fetch attendance if needed
        if (activeTab === 'attendance' && parts && parts.length > 0) {
            const partIds = parts.map(p => p.id)
            const { data: att } = await supabase
                .from('event_attendance')
                .select(`
                    id, check_in_at, date, status, notes, event_participant_id
                `)
                .in('event_participant_id', partIds)
                .eq('date', attendanceDate)
            setAttendance(att || [])
        } else if (activeTab === 'attendance') {
            setAttendance([])
        }

        setLoading(false)
    }, [eventId, activeTab, attendanceDate])

    useEffect(() => { fetchEventData() }, [fetchEventData])

    const openAddParticipant = async () => {
        setAddModalOpen(true)
        const { data } = await supabase.from('users').select('id, name, role').eq('is_active', true).order('name')
        setUsersRef(data || [])
    }

    const handleAddParticipant = async (userId) => {
        setAddingId(userId)
        try {
            const { error } = await supabase.from('event_participants').insert({
                event_id: eventId,
                user_id: userId
            })
            if (error) {
                if (error.code === '23505') throw new Error('User sudah didaftarkan pada event ini')
                throw error
            }
            toast({ title: 'Berhasil', description: 'Peserta ditambahkan', variant: 'success' })
            fetchEventData()
        } catch (err) {
            toast({ title: 'Gagal Menambahkan', description: err.message, variant: 'error' })
        } finally {
            setAddingId(null)
        }
    }

    const handleRemoveParticipant = async (participantId) => {
        if (!window.confirm('Yakin ingin mengeluarkan peserta ini dari event? Data absennya di event ini akan ikut terhapus.')) return
        try {
            const { error } = await supabase.from('event_participants').delete().eq('id', participantId)
            if (error) throw error
            toast({ title: 'Peserta dihapus', variant: 'success' })
            fetchEventData()
        } catch (err) {
            toast({ title: 'Gagal menghapus', description: err.message, variant: 'error' })
        }
    }

    const openManualStatus = (p) => {
        setSelectedParticipant(p)
        const existingAtt = attendance.find(a => a.event_participant_id === p.id)
        if (existingAtt) {
            setManualStatus(existingAtt.status || 'izin')
            setManualNotes(existingAtt.notes || '')
        } else {
            setManualStatus('izin')
            setManualNotes('')
        }
        setStatusModalOpen(true)
    }

    const handleSaveManualStatus = async (e) => {
        e.preventDefault()
        setSavingStatus(true)
        try {
            const existingAtt = attendance.find(a => a.event_participant_id === selectedParticipant.id)
            const payload = {
                event_participant_id: selectedParticipant.id,
                date: attendanceDate,
                status: manualStatus,
                notes: manualNotes,
                check_in_at: manualStatus === 'hadir' ? (existingAtt?.check_in_at || new Date().toISOString()) : null
            }

            let error;
            if (existingAtt) {
                const res = await supabase.from('event_attendance').update(payload).eq('id', existingAtt.id)
                error = res.error
            } else {
                const res = await supabase.from('event_attendance').insert(payload)
                error = res.error
            }

            if (error) throw error
            toast({ title: 'Berhasil', description: 'Status kehadiran diperbarui', variant: 'success' })
            setStatusModalOpen(false)
            fetchEventData()
        } catch (err) {
            toast({ title: 'Gagal', description: err.message, variant: 'error' })
        } finally {
            setSavingStatus(true)
            setStatusModalOpen(false)
            setTimeout(() => setSavingStatus(false), 500)
        }
    }

    if (loading && !event) {
        return <div className="p-8 flex justify-center"><Spinner size="lg" /></div>
    }

    if (!event) return <div className="p-8 text-center text-muted-foreground">Event tidak ditemukan.</div>

    const filteredUsers = usersRef.filter(u => u.name.toLowerCase().includes(searchUser.toLowerCase())).slice(0, 50)
    const isParticipant = (uid) => participants.some(p => p.user_id === uid)

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate('/events')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        {event.name}
                        {!event.is_active && <span className="text-xs bg-gray-500/20 text-gray-500 px-2 py-1 rounded">Selesai</span>}
                    </h1>
                    <p className="text-muted-foreground text-sm flex items-center gap-2 mt-1">
                        <CalendarDays className="h-4 w-4" />
                        {event.start_date ? format(new Date(event.start_date), 'dd MMM yy') : '-'} s/d {event.end_date ? format(new Date(event.end_date), 'dd MMM yy') : '-'}
                    </p>
                </div>
            </div>

            <div className="flex border-b border-border">
                <button
                    onClick={() => setActiveTab('participants')}
                    className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'participants' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    Daftar Peserta
                </button>
                <button
                    onClick={() => setActiveTab('attendance')}
                    className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'attendance' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    Riwayat Kehadiran (Event)
                </button>
            </div>

            {activeTab === 'participants' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold">Total Peserta: {participants.length}</h2>
                        <div className="flex gap-2">
                            <Button onClick={() => window.open('/scan-event/' + event.id, '_blank')} variant="outline" className="border-blue-500/30 text-blue-500 hover:text-blue-400">
                                <QrCode className="h-4 w-4 mr-2" />
                                Buka Scanner Event
                            </Button>
                            <Button onClick={openAddParticipant}>
                                <UserPlus className="h-4 w-4 mr-2" />
                                Tambah Peserta
                            </Button>
                        </div>
                    </div>

                    <div className="bg-card border rounded-md overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3">Nama</th>
                                    <th className="px-4 py-3">Role</th>
                                    <th className="px-4 py-3 w-16 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {participants.map(p => (
                                    <tr key={p.id} className="hover:bg-muted/30">
                                        <td className="px-4 py-3 font-medium">{p.users?.name}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{p.users?.role}</td>
                                        <td className="px-4 py-3 text-right">
                                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleRemoveParticipant(p.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {participants.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                                            Belum ada peserta yang didaftarkan pada event ini.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'attendance' && (
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Label className="whitespace-nowrap">Tanggal:</Label>
                            <Input
                                type="date"
                                value={attendanceDate}
                                onChange={e => setAttendanceDate(e.target.value)}
                                className="w-auto"
                            />
                        </div>
                        <div className="flex gap-4 text-sm font-medium">
                            <span className="text-green-500">Hadir: {attendance.filter(a => a.status === 'hadir').length}</span>
                            <span className="text-yellow-500">Izin/Sakit: {attendance.filter(a => a.status !== 'hadir').length}</span>
                            <span className="text-red-500">Belum Hadir: {participants.length - attendance.length}</span>
                        </div>
                    </div>
                    <div className="bg-card border rounded-md overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3">Nama</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Waktu Masuk</th>
                                    <th className="px-4 py-3">Keterangan</th>
                                    <th className="px-4 py-3 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {participants.map(p => {
                                    const att = attendance.find(a => a.event_participant_id === p.id)
                                    const u = p.users
                                    const isHadir = att?.status === 'hadir'
                                    const isIzin = att && !isHadir
                                    const isBelum = !att
                                    return (
                                        <tr key={p.id} className="hover:bg-muted/30">
                                            <td className="px-4 py-3 font-medium">
                                                {u?.name || '-'}
                                                <div className="text-xs text-muted-foreground font-normal">{u?.role || '-'}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {isHadir && <span className="bg-green-500/10 text-green-500 px-2 py-0.5 rounded text-xs">Hadir</span>}
                                                {isIzin && <span className="bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded text-xs capitalize">{att.status}</span>}
                                                {isBelum && <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-xs">Belum Hadir</span>}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {isHadir && att.check_in_at ? format(new Date(att.check_in_at), 'HH:mm:ss') : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {att?.notes || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Button size="sm" variant="ghost" onClick={() => openManualStatus(p)}>
                                                    Set Status
                                                </Button>
                                            </td>
                                        </tr>
                                    )
                                })}
                                {participants.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                            Belum ada peserta yang didaftarkan pada event ini.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Add Participant Dialog */}
            <Dialog open={addModalOpen} onClose={() => setAddModalOpen(false)}>
                <DialogContent onClose={() => setAddModalOpen(false)} className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Kaitkan User ke Event</DialogTitle>
                    </DialogHeader>
                    <div className="p-6 pt-2 h-[60dvh] flex flex-col">
                        <Input
                            placeholder="Cari nama user..."
                            value={searchUser}
                            onChange={e => setSearchUser(e.target.value)}
                            className="mb-4"
                        />
                        <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                            {filteredUsers.map(u => {
                                const enrolled = isParticipant(u.id)
                                return (
                                    <div key={u.id} className="flex items-center justify-between p-2 rounded border">
                                        <div>
                                            <div className="font-medium text-sm">{u.name}</div>
                                            <div className="text-xs text-muted-foreground">{u.role}</div>
                                        </div>
                                        {enrolled ? (
                                            <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">Terdaftar</span>
                                        ) : (
                                            <Button size="sm" variant="secondary" onClick={() => handleAddParticipant(u.id)} disabled={addingId === u.id}>
                                                {addingId === u.id ? <Spinner size="sm" /> : <Plus className="h-3 w-3 mr-1" />}
                                                Pilih
                                            </Button>
                                        )}
                                    </div>
                                )
                            })}
                            {filteredUsers.length === 0 && (
                                <p className="text-center text-sm text-muted-foreground py-8">User tidak ditemukan.</p>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Set Status Manual Dialog */}
            <Dialog open={statusModalOpen} onClose={() => setStatusModalOpen(false)}>
                <DialogContent onClose={() => setStatusModalOpen(false)} className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Set Status Kehadiran</DialogTitle>
                        <p className="text-sm text-muted-foreground mt-2">
                            Peserta: <strong>{selectedParticipant?.users?.name}</strong><br />
                            Tanggal: {format(new Date(attendanceDate), 'd MMM yyyy', { locale: idLocale })}
                        </p>
                    </DialogHeader>
                    <form onSubmit={handleSaveManualStatus}>
                        <div className="p-6 pt-2 space-y-4">
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                                    value={manualStatus}
                                    onChange={e => setManualStatus(e.target.value)}
                                >
                                    <option value="hadir">Hadir</option>
                                    <option value="izin">Izin</option>
                                    <option value="sakit">Sakit</option>
                                    <option value="alfa">Alfa</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Keterangan (Opsional)</Label>
                                <textarea
                                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="Alasan tidak hadir..."
                                    value={manualNotes}
                                    onChange={e => setManualNotes(e.target.value)}
                                    rows={3}
                                ></textarea>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setStatusModalOpen(false)}>Batal</Button>
                            <Button type="submit" disabled={savingStatus}>
                                {savingStatus ? <Spinner size="sm" className="mr-2" /> : null}
                                Simpan
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
