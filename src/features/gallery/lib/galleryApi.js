// ============================================================
// Lapisan akses data modul galeri (terisolasi).
// Semua query Supabase tabel gallery_* + pemanggilan API Drive.
// TIDAK menyentuh tabel absensi existing.
// ============================================================
import { supabase } from '../../../lib/supabase'
import { slugify, isoWeekLabel, compressImage, blobToBase64 } from './galleryUtils'

// ---------------- Kategori ----------------
export async function listCategories() {
  const { data, error } = await supabase
    .from('gallery_categories')
    .select('*')
    .order('name')
  if (error) throw error
  return data || []
}

export async function createCategory(name) {
  const { data, error } = await supabase
    .from('gallery_categories')
    .insert({ name: name.trim(), slug: slugify(name) })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCategory(id, name) {
  const { error } = await supabase
    .from('gallery_categories')
    .update({ name: name.trim(), slug: slugify(name) })
    .eq('id', id)
  if (error) throw error
}

export async function deleteCategory(id) {
  const { error } = await supabase.from('gallery_categories').delete().eq('id', id)
  if (error) throw error
}

// ---------------- Media ----------------
export async function listMedia({ categoryId, weekLabel, date } = {}) {
  let q = supabase
    .from('gallery_media')
    .select('*, gallery_categories(name)')
    .order('taken_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (categoryId) q = q.eq('category_id', categoryId)
  if (weekLabel) q = q.eq('week_label', weekLabel)
  if (date) q = q.eq('taken_at', date)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

/** Daftar week_label unik (untuk filter). */
export async function listWeeks() {
  const { data, error } = await supabase
    .from('gallery_media')
    .select('week_label')
    .not('week_label', 'is', null)
  if (error) throw error
  return [...new Set((data || []).map((r) => r.week_label))].sort().reverse()
}

export async function insertMedia(row) {
  const { error } = await supabase.from('gallery_media').insert(row)
  if (error) throw error
}

export async function updateMedia(id, patch) {
  const { error } = await supabase.from('gallery_media').update(patch).eq('id', id)
  if (error) throw error
}

/** Hapus media: hapus file di Drive (best-effort) lalu baris metadata. */
export async function deleteMedia(media) {
  const { data: { session } } = await supabase.auth.getSession()
  if (media.drive_file_id) {
    await fetch('/api/gallery/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify({ driveFileId: media.drive_file_id }),
    }).catch(() => {}) // best-effort; tetap lanjut hapus metadata
  }
  const { error } = await supabase.from('gallery_media').delete().eq('id', media.id)
  if (error) throw error
}

/**
 * Upload 1 file foto: kompres -> kirim ke /api/gallery/upload (Drive) -> simpan metadata.
 * @returns metadata yang tersimpan
 */
export async function uploadMedia(file, { categoryId, caption, takenAt }) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sesi login tidak ditemukan')

  // 1. Kompres di browser
  const blob = await compressImage(file)
  const dataBase64 = await blobToBase64(blob)

  // 2. Upload ke Google Drive lewat serverless function
  const resp = await fetch('/api/gallery/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      fileName: file.name?.replace(/\.[^.]+$/, '.jpg') || `galeri-${Date.now()}.jpg`,
      mimeType: 'image/jpeg',
      dataBase64,
    }),
  })
  if (!resp.ok) {
    const e = await resp.json().catch(() => ({}))
    throw new Error(e.error || 'Upload ke Google Drive gagal')
  }
  const { driveFileId, thumbUrl } = await resp.json()

  // 3. Simpan metadata ke Supabase
  const row = {
    drive_file_id: driveFileId,
    drive_thumb_url: thumbUrl,
    file_name: file.name || null,
    mime_type: 'image/jpeg',
    category_id: categoryId || null,
    caption: caption || null,
    taken_at: takenAt || null,
    week_label: takenAt ? isoWeekLabel(takenAt) : null,
    uploaded_by: session.user?.id || null,
    source: 'web',
  }
  await insertMedia(row)
  return row
}

// ---------------- Admin WA ----------------
export async function listWaAdmins() {
  const { data, error } = await supabase
    .from('gallery_wa_admins')
    .select('*')
    .order('is_super_admin', { ascending: false })
    .order('created_at')
  if (error) throw error
  return data || []
}

export async function createWaAdmin({ phone, name, is_super_admin }) {
  const { error } = await supabase.from('gallery_wa_admins').insert({
    phone: phone.trim(),
    name: name?.trim() || null,
    is_super_admin: !!is_super_admin,
  })
  if (error) throw error
}

export async function deleteWaAdmin(id) {
  const { error } = await supabase.from('gallery_wa_admins').delete().eq('id', id)
  if (error) throw error
}
