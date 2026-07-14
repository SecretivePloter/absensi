import { useState, useEffect } from 'react'
import QRCodeLib from 'qrcode'
import { Search, Printer, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/Layout'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Spinner } from '../components/ui/spinner'
import { useRoles, roleLabel, roleBadgeVariant as roleBadge } from '../store/useRolesStore'

async function printMassIDCards(users) {
  const logoUrl = window.location.origin + '/logo.png'
  let cardsHtml = ''

  for (const user of users) {
    const label = roleLabel(user.role)
    const initial = user.name.charAt(0).toUpperCase()

    const photoTag = user.photo_url
      ? `<img src="${user.photo_url}" style="width:100%;height:100%;object-fit:cover;display:block;" />`
      : `<div style="width:100%;height:100%;background:#f1f5f9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;">
           <div style="width:38px;height:38px;border-radius:50%;background:#cbd5e1;display:flex;align-items:center;justify-content:center;">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5">
               <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.118a7.5 7.5 0 0115 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.5-1.632z"/>
             </svg>
           </div>
           <span style="font-size:8px;color:#94a3b8;font-family:Arial;">${initial}</span>
         </div>`

    const nikValue = user.employee_id ?? user.nik ?? ''
    const nikLine = nikValue
      ? `<div class="info-nik">NIK: ${nikValue}</div>`
      : ''

    const qrDataUrl = await QRCodeLib.toDataURL(user.qr_code, {
      width: 180,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' }
    })

    cardsHtml += `
      <div class="user-row">
        <!-- Sisi Depan -->
        <div class="card">
          <svg class="bg-svg" viewBox="0 0 242 382" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
            <polygon points="165,0 260,0 260,150 150,60" fill="#f0b8c4" opacity="0.85"/>
            <polygon points="185,0 260,0 260,110 175,30" fill="#a8d5e2" opacity="0.82"/>
            <polygon points="208,0 260,0 260,80 200,8"  fill="#8a8fa8" opacity="0.75"/>
            <polygon points="0,235 100,325 0,382 -15,382" fill="#f0b8c4" opacity="0.85"/>
            <polygon points="0,265 82,342 0,382"          fill="#a8d5e2" opacity="0.82"/>
            <polygon points="0,300 65,360 0,382"           fill="#8a8fa8" opacity="0.75"/>
          </svg>
          <div class="card-content">
            <div class="card-header">
              <img class="card-logo" src="${logoUrl}" onerror="this.style.display='none'" />
              <div class="company-name">PT ICHIKARA</div>
            </div>
            <div class="photo-section">
              <div class="photo-backdrop">${photoTag}</div>
            </div>
            <div class="info-section">
              <div class="info-name">${user.name}</div>
              <div class="info-divider"></div>
              <div class="info-role">${label}</div>
              ${nikLine}
            </div>
          </div>
        </div>

        <!-- Sisi Belakang -->
        <div class="card">
          <svg class="bg-svg" viewBox="0 0 242 382" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
             <polygon points="0,0 242,0 242,382 0,382" fill="#f8fafc" />
             <polygon points="200,0 242,0 242,50" fill="#e2e8f0" />
             <polygon points="0,332 42,382 0,382" fill="#e2e8f0" />
          </svg>
          <div class="card-content" style="align-items: center; justify-content: center; padding: 5mm;">
             <p style="font-size: 7.5pt; color: #334155; text-align: center; margin-bottom: 3.5mm; font-weight: bold; text-transform: uppercase;">
                Kartu Identitas
             </p>
             <img src="${qrDataUrl}" style="width: 32mm; height: 32mm; mix-blend-mode: multiply;" />
             <p style="font-size: 6pt; color: #64748b; text-align: center; margin-top: 3mm; line-height: 1.3;">
                Gunakan QR Code ini<br/>untuk presensi absen.
             </p>
          </div>
        </div>
      </div>
    `
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Cetak ID Card Massal</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page {
      size: A4 portrait;
      margin: 10mm 15mm;
    }
    body {
      font-family: Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      background: #fff;
    }
    .print-container {
      display: flex;
      flex-direction: column;
      gap: 5mm;
    }
    /* Mencegah terpotong per beda baris row */
    .user-row {
      display: flex;
      gap: 4mm;
      page-break-inside: avoid;
    }
    .card {
      width: 54mm;
      height: 85.6mm;
      position: relative;
      background: #ffffff;
      overflow: hidden;
      border: 1px solid #cbd5e1;
      border-radius: 1.5mm;
    }
    .bg-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 0;
    }
    .card-content {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .card-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
      padding: 4mm 4mm 2mm;
    }
    .card-logo {
      height: 9mm;
      width: auto;
      object-fit: contain;
    }
    .company-name {
      font-size: 10pt;
      font-weight: 900;
      color: #0a0a0a;
      letter-spacing: -0.2px;
      line-height: 1;
      white-space: nowrap;
    }
    .photo-section {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 1.5mm 5mm 0;
    }
    .photo-backdrop {
      width: 39mm;
      height: 43mm;
      background: #ffffff;
      border-radius: 2.5mm;
      box-shadow: 0 1px 6px rgba(0,0,0,0.12);
      overflow: hidden;
    }
    .info-section {
      padding: 2.5mm 4mm 4mm;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .info-name {
      font-size: 8.5pt;
      font-weight: 900;
      color: #0a0a0a;
      text-transform: uppercase;
      letter-spacing: 0.2px;
      text-align: center;
      line-height: 1.1;
    }
    .info-divider {
      width: 100%;
      height: 1px;
      background: #1a1a6e;
      margin: 1.5mm 0;
    }
    .info-role {
      font-size: 6.5pt;
      font-weight: 700;
      color: #1a1a6e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: center;
    }
    .info-nik {
      font-size: 5.5pt;
      color: #334155;
      margin-top: 1mm;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="print-container">
    ${cardsHtml}
  </div>
<script>window.onload = () => setTimeout(() => window.print(), 500);<\/script>
</body>
</html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
}

export default function IDCard() {
  const roles = useRoles()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [printing, setPrinting] = useState(null)
  const [selectedUsers, setSelectedUsers] = useState(new Set())

  useEffect(() => {
    supabase
      .from('users')
      .select('id, name, role, photo_url, qr_code, is_active, nik, classes(name)')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => { setUsers(data || []); setLoading(false) })
  }, [])

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    return matchSearch && matchRole
  })

  const handleSelectAll = (e) => {
    if (e.target.checked) setSelectedUsers(new Set(filtered.map(u => u.id)))
    else setSelectedUsers(new Set())
  }

  const handleSelectUser = (id, checked) => {
    const next = new Set(selectedUsers)
    if (checked) next.add(id)
    else next.delete(id)
    setSelectedUsers(next)
  }

  const handlePrintMass = async () => {
    if (selectedUsers.size === 0) return
    const usersToPrint = filtered.filter(u => selectedUsers.has(u.id))
    setPrinting('mass')
    try {
      await printMassIDCards(usersToPrint)
    } finally {
      setPrinting(null)
    }
  }

  const handlePrint = async (user) => {
    setPrinting(user.id)
    try {
      await printMassIDCards([user])
    } finally {
      setPrinting(null)
    }
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">ID Card Generator</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cetak kartu identitas 2 sisi · ukuran 5,5 × 8,7 cm (portrait)
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Semua Role</option>
            {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        {/* Info tip */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
          💡 Setelah klik <strong>Cetak</strong>, dialog print akan muncul. Pilih <strong>"Save as PDF"</strong> untuk simpan, atau pilih printer untuk langsung cetak. Pastikan ukuran kertas diatur ke <strong>A4</strong> dengan margin diatur ke <strong>Default/None</strong> sesuai selera.
        </div>

        {/* Mass Print Action Bar */}
        <div className="flex justify-between items-center bg-muted/30 p-3 rounded-lg border">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              className="rounded border-gray-300 h-4 w-4 text-primary focus:ring-primary cursor-pointer"
              checked={selectedUsers.size > 0 && selectedUsers.size === filtered.length}
              // Indeterminate state simulation visually if some but not all selected:
              ref={el => el && (el.indeterminate = selectedUsers.size > 0 && selectedUsers.size < filtered.length)}
              onChange={handleSelectAll}
            />
            <span className="text-sm font-medium">Pilih Semua ({selectedUsers.size} pengguna)</span>
          </div>
          <Button onClick={handlePrintMass} disabled={selectedUsers.size === 0 || printing === 'mass'}>
            {printing === 'mass' ? <Spinner size="sm" className="mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
            {printing === 'mass' ? 'Memproses...' : `Cetak ${selectedUsers.size} Kartu Pilihan`}
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{filtered.length} pengguna</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(user => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors relative"
                >
                  <input
                    type="checkbox"
                    className="absolute top-3 right-3 rounded border-gray-300 h-4 w-4 text-primary focus:ring-primary cursor-pointer"
                    checked={selectedUsers.has(user.id)}
                    onChange={(e) => handleSelectUser(user.id, e.target.checked)}
                  />
                  {user.photo_url ? (
                    <img
                      src={user.photo_url}
                      alt={user.name}
                      className="h-11 w-11 rounded-full object-cover border-2 border-primary/20 shrink-0"
                    />
                  ) : (
                    <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-base font-bold text-primary shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0 pr-6">
                    <p className="font-medium text-sm truncate">{user.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant={roleBadge(user.role)} className="text-xs py-0">
                        {roleLabel(user.role, roles)}
                      </Badge>
                      {user.classes?.name && (
                        <span className="text-xs text-muted-foreground truncate">{user.classes.name}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePrint(user)}
                    disabled={printing === user.id}
                    className="shrink-0"
                  >
                    {printing === user.id
                      ? <Spinner size="sm" />
                      : <><Printer className="h-3.5 w-3.5" /></>
                    }
                  </Button>
                </div>
              ))}
            </div>
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground w-full">
                <Users className="h-10 w-10 opacity-30" />
                <p>Tidak ada pengguna ditemukan</p>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
