import { useState, useEffect } from 'react'
import { Search, Printer, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/Layout'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Spinner } from '../components/ui/spinner'
import { useRoles, roleLabel, roleBadgeVariant as roleBadge } from '../store/useRolesStore'

async function printIDCard(user) {
  const label = roleLabel(user.role)
  const initial = user.name.charAt(0).toUpperCase()

  const logoUrl = window.location.origin + '/logo.png'

  const photoTag = user.photo_url
    ? `<img src="${user.photo_url}" style="width:100%;height:100%;object-fit:cover;display:block;" />`
    : `<div style="width:100%;height:100%;background:#f1f5f9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;">
         <div style="width:60px;height:60px;border-radius:50%;background:#cbd5e1;display:flex;align-items:center;justify-content:center;">
           <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5">
             <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.118a7.5 7.5 0 0115 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.5-1.632z"/>
           </svg>
         </div>
         <span style="font-size:10px;color:#94a3b8;font-family:Arial;">${initial}</span>
       </div>`

  const nikValue = user.employee_id ?? user.nik ?? ''
  const nikLine = nikValue
    ? `<div class="info-nik">NIK: ${nikValue}</div>`
    : ''

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ID Card - ${user.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page {
      size: 85.6mm 135mm;
      margin: 0;
    }
    body {
      width: 85.6mm;
      height: 135mm;
      font-family: Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      overflow: hidden;
    }
    .card {
      width: 85.6mm;
      height: 135mm;
      position: relative;
      background: #ffffff;
      overflow: hidden;
    }

    /* ── Geometric background shapes ── */
    .bg-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 0;
    }

    /* ── Content layer ── */
    .card-content {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    /* ── Header: logo top, company name below ── */
    .card-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
      padding: 6mm 7mm 3mm;
    }
    .card-logo {
      height: 14mm;
      width: auto;
      object-fit: contain;
    }
    .company-name {
      font-size: 16pt;
      font-weight: 900;
      color: #0a0a0a;
      letter-spacing: -0.3px;
      line-height: 1;
      white-space: nowrap;
    }

    /* ── Photo section ── */
    .photo-section {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 2mm 8mm 0;
    }
    .photo-backdrop {
      width: 62mm;
      height: 68mm;
      background: #ffffff;
      border-radius: 4mm;
      box-shadow: 0 2px 10px rgba(0,0,0,0.12);
      overflow: hidden;
    }

    /* ── Info: name, divider, role, NIK ── */
    .info-section {
      padding: 4mm 7mm 6mm;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .info-name {
      font-size: 13pt;
      font-weight: 900;
      color: #0a0a0a;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      text-align: center;
    }
    .info-divider {
      width: 100%;
      height: 1px;
      background: #1a1a6e;
      margin: 3mm 0;
    }
    .info-role {
      font-size: 10pt;
      font-weight: 700;
      color: #1a1a6e;
      text-transform: uppercase;
      letter-spacing: 1px;
      text-align: center;
    }
    .info-nik {
      font-size: 8.5pt;
      color: #334155;
      margin-top: 2mm;
      text-align: center;
    }
  </style>
</head>
<body>
<div class="card">

  <!-- Geometric background SVG -->
  <svg class="bg-svg" viewBox="0 0 242 382" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
    <!-- Top-right cluster -->
    <polygon points="165,0 260,0 260,150 150,60" fill="#f0b8c4" opacity="0.85"/>
    <polygon points="185,0 260,0 260,110 175,30" fill="#a8d5e2" opacity="0.82"/>
    <polygon points="208,0 260,0 260,80 200,8"  fill="#8a8fa8" opacity="0.75"/>
    <!-- Bottom-left cluster -->
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
<script>window.onload = () => setTimeout(() => window.print(), 400);<\/script>
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

  const handlePrint = async (user) => {
    setPrinting(user.id)
    try {
      await printIDCard(user)
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
          💡 Setelah klik <strong>Cetak</strong>, dialog print akan muncul. Pilih <strong>"Save as PDF"</strong> untuk simpan, atau pilih printer untuk langsung cetak. Pastikan ukuran kertas diatur ke <strong>85,6 × 135mm</strong> (portrait) dan margin <strong>None</strong>.
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
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                >
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
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{user.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant={roleBadge(user.role)} className="text-xs py-0">
                        {roleLabel(user.role)}
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
                      : <><Printer className="h-3.5 w-3.5 mr-1" />Cetak</>
                    }
                  </Button>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Users className="h-10 w-10 opacity-30" />
                  <p>Tidak ada pengguna ditemukan</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
