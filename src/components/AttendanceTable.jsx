import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { Badge } from './ui/badge'
import { Spinner } from './ui/spinner'

export function AttendanceTable({ records, loading }) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!records || records.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Belum ada data absensi
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-3 font-medium">Nama</th>
            <th className="text-left p-3 font-medium">Role</th>
            <th className="text-left p-3 font-medium hidden md:table-cell">Kelas</th>
            <th className="text-left p-3 font-medium">Jam</th>
            <th className="text-left p-3 font-medium hidden sm:table-cell">Metode</th>
            <th className="text-left p-3 font-medium hidden lg:table-cell">Catatan</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
              <td className="p-3">
                <div className="flex items-center gap-2">
                  {r.users?.photo_url ? (
                    <img
                      src={r.users.photo_url}
                      alt={r.users.name}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                      {r.users?.name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                  <span className="font-medium">{r.users?.name}</span>
                </div>
              </td>
              <td className="p-3">
                <Badge variant={r.users?.role === 'student' ? 'default' : 'secondary'}>
                  {r.users?.role === 'student' ? 'Murid' : 'Karyawan'}
                </Badge>
              </td>
              <td className="p-3 hidden md:table-cell text-muted-foreground">
                {r.users?.classes?.name ?? '-'}
              </td>
              <td className="p-3 font-mono text-xs">
                {format(new Date(r.check_in_at), 'HH:mm:ss')}
              </td>
              <td className="p-3 hidden sm:table-cell">
                <Badge variant={r.method === 'qr' ? 'success' : 'warning'}>
                  {r.method === 'qr' ? 'QR Scan' : 'Manual'}
                </Badge>
              </td>
              <td className="p-3 hidden lg:table-cell text-muted-foreground text-xs">
                {r.notes || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
