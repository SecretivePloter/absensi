import { useState, useEffect } from 'react'
import { Search, Printer, Users } from 'lucide-react'
import QRCodeLib from 'qrcode'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/Layout'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Spinner } from '../components/ui/spinner'

const ROLE_LABEL = {
  student: 'Murid',
  sensei: 'Sensei',
  asisten_sensei: 'Asisten Sensei',
  staff: 'Staff',
  employee: 'Staff',
}

const roleLabel = (role) => ROLE_LABEL[role] ?? 'Staff'

const roleBadge = (role) => {
  if (role === 'student') return 'default'
  if (role === 'sensei' || role === 'asisten_sensei') return 'warning'
  return 'secondary'
}

async function printIDCard(user) {
  const qrDataUrl = await QRCodeLib.toDataURL(user.qr_code, {
    width: 400, margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  })

  const logoUrl = window.location.origin + '/logo.png'
  const label = roleLabel(user.role)
  const initial = user.name.charAt(0).toUpperCase()
  const photoTag = user.photo_url
    ? `<img src="${user.photo_url}" style="width:100%;height:100%;object-fit:cover;" />`
    : `<span style="font-size:18pt;font-weight:bold;color:#1d4ed8;">${initial}</span>`

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>ID Card — ${user.name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page {
    size: 55mm 87mm;
    margin: 0;
  }
  body {
    width: 55mm;
    font-family: 'Arial', sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ===== CARD WRAPPER ===== */
  .card {
    width: 55mm;
    height: 87mm;
    overflow: hidden;
    page-break-after: always;
    position: relative;
    border: 0.4mm solid #1d4ed8;
    border-radius: 3mm;
  }

  /* ===== FRONT ===== */
  .front {
    background: #ffffff;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .front-header {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1mm;
    padding: 6mm 4mm 4mm;
  }
  .front-header-logo {
    height: 8mm;
    width: auto;
    object-fit: contain;
  }
  .front-header-name {
    color: #1e3a8a;
    font-size: 6pt;
    font-weight: bold;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }

  .front-accent {
    width: 14mm;
    height: 0.6mm;
    background: #1d4ed8;
    border-radius: 1mm;
    margin-top: 1mm;
  }

  .front-body {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3mm 0;
  }
  .photo-box {
    width: 32mm;
    height: 38mm;
    border-radius: 2.5mm;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f1f5f9;
  }

  .front-footer {
    width: 100%;
    padding: 4mm 4mm 6mm;
    text-align: center;
  }
  .footer-name {
    color: #0f172a;
    font-size: 11pt;
    font-weight: bold;
    letter-spacing: 0.2px;
  }
  .footer-role {
    color: #1d4ed8;
    font-size: 7pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-top: 1mm;
  }

  /* ===== BACK ===== */
  .back {
    background: #ffffff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2.5mm;
    padding: 5mm 4mm;
  }
  .back-logo-row {
    display: flex;
    align-items: center;
    gap: 2mm;
  }
  .back-logo {
    height: 6mm;
    width: auto;
    object-fit: contain;
  }
  .back-company {
    font-size: 6pt;
    font-weight: bold;
    color: #1e3a8a;
    letter-spacing: 0.5px;
  }

  .qr-box {
    border: 0.5mm solid #e2e8f0;
    border-radius: 2mm;
    padding: 2mm;
    background: #fff;
  }
  .qr-box img {
    width: 34mm;
    height: 34mm;
    display: block;
  }

  .back-divider {
    width: 36mm;
    height: 0.3mm;
    background: #e2e8f0;
  }
  .back-name {
    font-size: 8.5pt;
    font-weight: bold;
    color: #0f172a;
    text-align: center;
  }
  .back-role {
    font-size: 6pt;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    text-align: center;
  }
</style>
</head>
<body>

<!-- HALAMAN DEPAN -->
<div class="card front">
  <div class="front-header">
    <img class="front-header-logo" src="${logoUrl}" onerror="this.style.display='none'" />
    <div class="front-header-name">PT. Ichikara</div>
    <div class="front-accent"></div>
  </div>
  <div class="front-body">
    <div class="photo-box">${photoTag}</div>
  </div>
  <div class="front-footer">
    <div class="footer-name">${user.name}</div>
    <div class="footer-role">${label}</div>
  </div>
</div>

<!-- HALAMAN BELAKANG -->
<div class="card back">
  <div class="back-logo-row">
    <img class="back-logo" src="${logoUrl}" onerror="this.style.display='none'" />
    <div class="back-company">PT. Ichikara</div>
  </div>
  <div class="qr-box">
    <img src="${qrDataUrl}" />
  </div>
  <div class="back-divider"></div>
  <div class="back-name">${user.name}</div>
  <div class="back-role">${label}</div>
</div>

<script>window.onload = () => setTimeout(() => window.print(), 300)</script>
</body>
</html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
}

export default function IDCard() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [printing, setPrinting] = useState(null)

  useEffect(() => {
    supabase
      .from('users')
      .select('id, name, role, photo_url, qr_code, is_active, classes(name)')
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
            <option value="student">Murid</option>
            <option value="staff">Staff</option>
            <option value="sensei">Sensei</option>
            <option value="asisten_sensei">Asisten Sensei</option>
          </select>
        </div>

        {/* Info tip */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
          💡 Setelah klik <strong>Cetak</strong>, dialog print akan muncul. Pilih <strong>"Save as PDF"</strong> untuk simpan, atau pilih printer untuk langsung cetak. Pastikan ukuran kertas diatur ke <strong>55 × 87mm</strong> dan margin <strong>None</strong>.
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
