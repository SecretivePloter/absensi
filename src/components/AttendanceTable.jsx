import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { Trash2, Pencil, Check, X } from 'lucide-react'
import { Badge } from './ui/badge'
import { Spinner } from './ui/spinner'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'

const roleLabel = (role) => {
  if (role === 'student') return 'Murid'
  if (role === 'sensei') return 'Sensei'
  if (role === 'asisten_sensei') return 'Asisten Sensei'
  return 'Staff'
}

const roleBadgeVariant = (role) => {
  if (role === 'student') return 'default'
  if (role === 'sensei') return 'warning'
  if (role === 'asisten_sensei') return 'warning'
  return 'secondary'
}

const earlyReasonLabel = (reason) => {
  const map = { izin: 'Izin', sakit: 'Sakit', dinas_keluar: 'Dinas Keluar', others: 'Lainnya' }
  return map[reason] ?? null
}

const earlyReasonVariant = (reason) => {
  if (reason === 'dinas_keluar') return 'success'
  if (reason === 'sakit') return 'warning'
  return 'outline'
}

export function AttendanceTable({ records, loading, selectable = false, onDeleteSelected, onUpdateNote }) {
  const [selected, setSelected] = useState(() => new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editingNote, setEditingNote] = useState(null) // { id, value }
  const [savingNote, setSavingNote] = useState(false)
  const noteInputRef = useRef(null)

  useEffect(() => {
    if (editingNote) noteInputRef.current?.focus()
  }, [editingNote])

  const startEditNote = (r) => {
    setEditingNote({ id: r.id, value: r.notes ?? '' })
  }

  const cancelEditNote = () => setEditingNote(null)

  const saveNote = async () => {
    if (!editingNote || !onUpdateNote) return
    setSavingNote(true)
    try {
      await onUpdateNote(editingNote.id, editingNote.value.trim())
      setEditingNote(null)
    } finally {
      setSavingNote(false)
    }
  }

  const handleNoteKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveNote() }
    if (e.key === 'Escape') cancelEditNote()
  }

  useEffect(() => {
    setSelected(prev => {
      if (prev.size === 0) return prev
      const ids = new Set((records || []).map(r => r.id))
      const next = new Set([...prev].filter(id => ids.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [records])

  if (loading) {
    return <div className="flex justify-center py-12"><Spinner size="lg" /></div>
  }

  if (!records || records.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">Belum ada data absensi</div>
  }

  const allIds = records.map(r => r.id)
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id))

  const toggleAll = () => {
    setSelected(prev => (allIds.every(id => prev.has(id)) ? new Set() : new Set(allIds)))
  }

  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleConfirmDelete = async () => {
    setDeleting(true)
    try {
      await onDeleteSelected?.(Array.from(selected))
      setSelected(new Set())
      setConfirmOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-3">
      {selectable && selected.size > 0 && (
        <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-md px-3 py-2 animate-fade-in">
          <span className="text-sm font-medium">{selected.size} record terpilih</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Batal pilih
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1.5" />
              Hapus
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {selectable && (
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-input accent-primary cursor-pointer align-middle"
                    aria-label="Pilih semua"
                  />
                </th>
              )}
              <th className="text-left p-3 font-medium">Nama</th>
              <th className="text-left p-3 font-medium">Role</th>
              <th className="text-left p-3 font-medium hidden md:table-cell">Kelas</th>
              <th className="text-left p-3 font-medium">Masuk</th>
              <th className="text-left p-3 font-medium">Pulang</th>
              <th className="text-left p-3 font-medium hidden md:table-cell">Alasan</th>
              <th className="text-left p-3 font-medium hidden md:table-cell">Lokasi</th>
              <th className="text-left p-3 font-medium hidden sm:table-cell">Metode</th>
              {onUpdateNote && <th className="text-left p-3 font-medium hidden lg:table-cell">Catatan</th>}
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr
                key={r.id}
                className={`border-b last:border-0 transition-colors ${
                  selected.has(r.id) ? 'bg-primary/5' : 'hover:bg-muted/30'
                }`}
              >
                {selectable && (
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                      className="h-4 w-4 rounded border-input accent-primary cursor-pointer align-middle"
                      aria-label={`Pilih ${r.users?.name}`}
                    />
                  </td>
                )}
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {r.users?.photo_url ? (
                      <img src={r.users.photo_url} alt={r.users.name} className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {r.users?.name?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                    <span className="font-medium">{r.users?.name}</span>
                  </div>
                </td>
                <td className="p-3">
                  <Badge variant={roleBadgeVariant(r.users?.role)}>
                    {roleLabel(r.users?.role)}
                  </Badge>
                </td>
                <td className="p-3 hidden md:table-cell text-muted-foreground">
                  {r.users?.classes?.name ?? '-'}
                </td>
                <td className="p-3 font-mono text-xs">
                  {r.check_in_at
                    ? format(new Date(r.check_in_at), 'HH:mm:ss')
                    : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="p-3 font-mono text-xs">
                  {r.check_out_at
                    ? format(new Date(r.check_out_at), 'HH:mm:ss')
                    : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="p-3 hidden md:table-cell">
                  {r.absence_reason ? (
                    <Badge variant={r.absence_reason === 'sakit' ? 'warning' : 'outline'}>
                      {r.absence_reason === 'sakit' ? 'Sakit' : 'Izin'}
                    </Badge>
                  ) : r.early_checkout_reason ? (
                    <Badge variant={earlyReasonVariant(r.early_checkout_reason)}>
                      {earlyReasonLabel(r.early_checkout_reason)}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-3 hidden md:table-cell text-muted-foreground text-xs">
                  {r.locations?.name ?? '-'}
                </td>
                <td className="p-3 hidden sm:table-cell">
                  <Badge variant={r.method === 'qr' ? 'success' : 'warning'}>
                    {r.method === 'qr' ? 'QR Scan' : 'Manual'}
                  </Badge>
                </td>
                {onUpdateNote && (
                  <td className="p-3 hidden lg:table-cell">
                    {editingNote?.id === r.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          ref={noteInputRef}
                          value={editingNote.value}
                          onChange={e => setEditingNote(n => ({ ...n, value: e.target.value }))}
                          onKeyDown={handleNoteKeyDown}
                          placeholder="Tulis catatan..."
                          className="flex-1 text-xs border border-input rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary min-w-0 w-36"
                          disabled={savingNote}
                        />
                        <button
                          onClick={saveNote}
                          disabled={savingNote}
                          className="p-1 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-950 disabled:opacity-50"
                          title="Simpan"
                        >
                          {savingNote ? <Spinner size="sm" /> : <Check className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={cancelEditNote}
                          disabled={savingNote}
                          className="p-1 rounded text-muted-foreground hover:bg-muted"
                          title="Batal"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div
                        className="group flex items-center gap-1.5 cursor-pointer"
                        onClick={() => startEditNote(r)}
                        title="Klik untuk edit catatan"
                      >
                        <span className="text-xs text-muted-foreground">
                          {r.notes || <span className="italic">Tambah catatan...</span>}
                        </span>
                        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={confirmOpen} onClose={() => !deleting && setConfirmOpen(false)}>
        <DialogContent onClose={deleting ? undefined : () => setConfirmOpen(false)} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Record Absensi</DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-2 text-sm text-muted-foreground">
            Anda akan menghapus <strong className="text-foreground">{selected.size} record</strong> absensi.
            Tindakan ini permanen dan tidak bisa dibatalkan.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleting}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? <Spinner size="sm" className="mr-2" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
              {deleting ? 'Menghapus...' : `Hapus ${selected.size} record`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
