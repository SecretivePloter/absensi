import { useEffect } from 'react'
import { create } from 'zustand'
import { supabase } from '../lib/supabase'

// ============================================================
// Sumber tunggal daftar role. Dimuat dari tabel `roles` (migration 008),
// dengan fallback ke role bawaan bila tabel belum ada / belum termuat —
// sehingga aplikasi tetap jalan meski migration belum dijalankan.
// ============================================================

export const BUILTIN_ROLES = [
  { value: 'student', label: 'Murid', is_staff: false, sort_order: 1 },
  { value: 'staff', label: 'Staff', is_staff: true, sort_order: 2 },
  { value: 'sensei', label: 'Sensei', is_staff: true, sort_order: 3 },
  { value: 'asisten_sensei', label: 'Asisten Sensei', is_staff: true, sort_order: 4 },
  { value: 'employee', label: 'Karyawan (lama)', is_staff: true, sort_order: 5 },
]

// Cache modul agar helper sinkron (roleLabel dsb) bisa dipakai di luar komponen
// React (mis. exportExcel). Diperbarui setiap store memuat/menambah role.
let cache = BUILTIN_ROLES
let inflight = null

const sortRoles = (list) =>
  [...list].sort((a, b) => (a.sort_order - b.sort_order) || a.label.localeCompare(b.label))

export const useRolesStore = create((set, get) => ({
  roles: BUILTIN_ROLES,
  loaded: false,

  // Muat daftar role dari DB sekali (idempotent, dedup lewat `inflight`).
  async load(force = false) {
    if (get().loaded && !force) return
    if (inflight) return inflight
    inflight = (async () => {
      const { data, error } = await supabase
        .from('roles')
        .select('value,label,is_staff,sort_order')
        .order('sort_order')
      if (!error && data && data.length) {
        cache = sortRoles(data)
        set({ roles: cache, loaded: true })
      } else {
        // Tabel belum ada / kosong → tetap pakai bawaan, tandai loaded agar tak loop.
        set({ loaded: true })
      }
      inflight = null
    })()
    return inflight
  },

  // Tambah role baru (selalu tipe staff/karyawan). Mengembalikan baris tersimpan.
  async addRole({ value, label }) {
    const { data, error } = await supabase
      .from('roles')
      .insert({ value, label, is_staff: true, sort_order: 100 })
      .select('value,label,is_staff,sort_order')
      .single()
    if (error) throw error
    cache = sortRoles([...get().roles.filter((r) => r.value !== value), data])
    set({ roles: cache })
    return data
  },
}))

// ---- Helper sinkron (baca cache modul; bisa diberi list eksplisit) ----
export const roleLabel = (value, list = cache) =>
  list.find((r) => r.value === value)?.label ??
  BUILTIN_ROLES.find((r) => r.value === value)?.label ??
  'Staff'

export const isStaffRole = (value, list = cache) => {
  const r = list.find((x) => x.value === value) ?? BUILTIN_ROLES.find((x) => x.value === value)
  return r ? r.is_staff : value !== 'student'
}

export const staffRoleValues = (list = cache) =>
  list.filter((r) => r.is_staff).map((r) => r.value)

export const roleBadgeVariant = (value) => {
  if (value === 'student') return 'default'
  if (value === 'sensei' || value === 'asisten_sensei') return 'warning'
  return 'secondary'
}

// Ubah label bebas menjadi `value` role yang aman (slug): huruf kecil, _, angka.
export const slugifyRole = (label) =>
  String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

// Hook: pastikan role termuat, kembalikan daftar role (reaktif).
export function useRoles() {
  const roles = useRolesStore((s) => s.roles)
  const load = useRolesStore((s) => s.load)
  useEffect(() => { load() }, [load])
  return roles
}
