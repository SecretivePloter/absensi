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
                    id, check_in_at, date, event_participant_id, 
                    event_participants(user_id, users(name, role))
                `)
                .in('event_participant_id', partIds)
                .order('date', { ascending: false })
                .order('check_in_at', { ascending: false })
            setAttendance(att || [])
        } else if (activeTab === 'attendance') {
            setAttendance([])
        }

        setLoading(false)
    }, [eventId, activeTab])

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
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold">Total Kehadiran: {attendance.length}</h2>
                    </div>
                    <div className="bg-card border rounded-md overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3">Tanggal</th>
                                    <th className="px-4 py-3">Nama</th>
                                    <th className="px-4 py-3">Role</th>
                                    <th className="px-4 py-3">Waktu Masuk</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {attendance.map(att => {
                                    const u = att.event_participants?.users
                                    return (
                                        <tr key={att.id} className="hover:bg-muted/30">
                                            <td className="px-4 py-3 whitespace-nowrap">{format(new Date(att.date), 'dd MMM yyyy', { locale: idLocale })}</td>
                                            <td className="px-4 py-3 font-medium">{u?.name || '-'}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{u?.role || '-'}</td>
                                            <td className="px-4 py-3">
                                                {att.check_in_at ? format(new Date(att.check_in_at), 'HH:mm:ss') : '-'}
                                            </td>
                                        </tr>
                                    )
                                })}
                                {attendance.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                                            Belum ada data kehadiran pada event ini.
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
        </div>
    )
}
