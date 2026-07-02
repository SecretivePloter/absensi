import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { Search, ClipboardCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/Layout'
import { AttendanceTable } from '../components/AttendanceTable'
import { ExportButton } from '../components/ExportButton'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Spinner } from '../components/ui/spinner'
import { useToast } from '../components/ui/toast'
import { useRoles, roleLabel } from '../store/useRolesStore'

export default function ManualAttendance() {
  const toast = useToast()
  useRoles() // muat label role custom untuk daftar pencarian
  const [users, setUsers] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [tableLoading, setTableLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [notes, setNotes] = useState('')
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [locationsList, setLocationsList] = useState([])
  const [locationId, setLocationId] = useState('')

  const fetchUsers = useCallback(async () => {
    const [{ data }, { data: locs }] = await Promise.all([
      supabase
        .from('users')
        .select('id, name, role, classes(name)')
        .eq('is_active', true)
        .order('name'),
      supabase.from('locations').select('id, name').order('name'),
    ])
    setUsers(data || [])
    setLocationsList(locs || [])
  }, [])

  const fetchRecords = useCallback(async () => {
    setTableLoading(true)
    const { data } = await supabase
      .from('attendance')
      .select('*, users(id, name, role, photo_url, classes(name)), locations(name)')
      .eq('date', filterDate)
      .order('check_in_at', { ascending: false })
    setRecords(data || [])
    setTableLoading(false)
  }, [filterDate])

  useEffect(() => { fetchUsers() }, [fetchUsers])
  useEffect(() => { fetchRecords() }, [fetchRecords])

  const handleDeleteRecords = async (ids) => {
    const { error } = await supabase.from('attendance').delete().in('id', ids)
    if (error) {
      toast({ title: 'Gagal menghapus', description: error.message, variant: 'error' })
      return
    }
    toast({ title: 'Berhasil', description: `${ids.length} record absensi dihapus`, variant: 'success' })
    fetchRecords()
  }

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedUser) {
      toast({ title: 'Pilih pengguna terlebih dahulu', variant: 'error' })
      return
    }
    setLoading(true)
    try {
      // Check duplicate
      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('user_id', selectedUser)
        .eq('date', date)
        .maybeSingle()

      if (existing) {
        toast({ title: 'Sudah absen', description: 'Pengguna ini sudah tercatat absen pada tanggal tersebut', variant: 'error' })
        setLoading(false)
        return
      }

      const { error } = await supabase.from('attendance').insert({
        user_id: selectedUser,
        date,
        method: 'manual',
        notes: notes || null,
        location_id: locationId || null,
      })

      if (error) {
        if (error.code === '23505') {
          toast({ title: 'Sudah absen', description: 'Pengguna ini sudah tercatat pada tanggal tersebut', variant: 'error' })
          setLoading(false)
          return
        }
        throw error
      }

      const user = users.find(u => u.id === selectedUser)
      toast({ title: 'Absensi dicatat', description: `${user?.name} — ${date}`, variant: 'success' })
      setSelectedUser('')
      setNotes('')
      setSearch('')
      fetchRecords()
    } catch (err) {
      toast({ title: 'Gagal', description: err.message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Absensi Manual</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Catat absensi tanpa scan QR — untuk kondisi darurat atau perangkat bermasalah
          </p>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Catat Absensi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cari Pengguna</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Ketik nama pengguna..."
                      value={search}
                      onChange={e => { setSearch(e.target.value); setSelectedUser('') }}
                      className="pl-9"
                    />
                  </div>
                  {search && filteredUsers.length > 0 && !selectedUser && (
                    <div className="border rounded-md bg-card shadow-sm max-h-48 overflow-y-auto">
                      {filteredUsers.map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => { setSelectedUser(u.id); setSearch(u.name) }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between"
                        >
                          <span>{u.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {roleLabel(u.role)}
                            {u.classes ? ` — ${u.classes.name}` : ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedUser && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      ✓ Terpilih: {users.find(u => u.id === selectedUser)?.name}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Tanggal</Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    max={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Lokasi</Label>
                <Select value={locationId} onChange={e => setLocationId(e.target.value)}>
                  <option value="">Tanpa lokasi</option>
                  {locationsList.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Catatan (opsional)</Label>
                <Input
                  placeholder="Contoh: HP rusak, datang terlambat, dll."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              <Button type="submit" disabled={loading || !selectedUser}>
                {loading ? <Spinner size="sm" className="mr-2" /> : <ClipboardCheck className="h-4 w-4 mr-1.5" />}
                {loading ? 'Menyimpan...' : 'Catat Absensi'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Records */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <CardTitle className="text-base flex-1">Rekap Absensi</CardTitle>
              <div className="flex gap-2 items-center">
                <Input
                  type="date"
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                  className="w-auto text-sm h-9"
                />
                <ExportButton
                  records={records}
                  filename={`absensi_manual_${filterDate}`}
                  disabled={tableLoading}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <AttendanceTable
              records={records}
              loading={tableLoading}
              selectable
              onDeleteSelected={handleDeleteRecords}
            />
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
