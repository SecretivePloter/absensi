import * as XLSX from 'xlsx'

export function exportAttendanceToExcel(records, filename = 'absensi') {
  const rows = records.map(r => ({
    'Nama': r.users?.name ?? '-',
    'Role': r.users?.role === 'student' ? 'Murid' : 'Karyawan',
    'Kelas': r.users?.classes?.name ?? '-',
    'Tanggal': r.date,
    'Jam Check-in': new Date(r.check_in_at).toLocaleTimeString('id-ID'),
    'Metode': r.method === 'qr' ? 'QR Scan' : 'Manual',
    'Catatan': r.notes ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Absensi')
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export function exportUsersToExcel(users, filename = 'users') {
  const rows = users.map(u => ({
    'Nama': u.name,
    'Role': u.role === 'student' ? 'Murid' : 'Karyawan',
    'Kelas': u.classes?.name ?? '-',
    'No HP': u.phone ?? '-',
    'Status': u.is_active ? 'Aktif' : 'Nonaktif',
    'Terdaftar': new Date(u.created_at).toLocaleDateString('id-ID'),
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Users')
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
