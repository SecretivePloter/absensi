// ============================================================
// Tab "Galeri" — grid thumbnail + filter + preview.
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { ImageOff, Calendar, Tag } from 'lucide-react'
import { Card, CardContent } from '../../../components/ui/card'
import { Select } from '../../../components/ui/select'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'
import { Spinner } from '../../../components/ui/spinner'
import { Dialog, DialogContent } from '../../../components/ui/dialog'
import { listCategories, listMedia, listWeeks } from '../lib/galleryApi'

export default function GalleryGrid() {
  const [categories, setCategories] = useState([])
  const [weeks, setWeeks] = useState([])
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ categoryId: '', weekLabel: '', date: '' })
  const [preview, setPreview] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await listMedia({
        categoryId: filters.categoryId || undefined,
        weekLabel: filters.weekLabel || undefined,
        date: filters.date || undefined,
      })
      setMedia(rows)
    } catch {
      setMedia([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    listCategories().then(setCategories).catch(() => {})
    listWeeks().then(setWeeks).catch(() => {})
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const resetFilters = () => setFilters({ categoryId: '', weekLabel: '', date: '' })
  const hasFilter = filters.categoryId || filters.weekLabel || filters.date

  return (
    <div className="space-y-4">
      {/* Filter */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Kategori</Label>
              <Select
                value={filters.categoryId}
                onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}
              >
                <option value="">Semua kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Minggu</Label>
              <Select
                value={filters.weekLabel}
                onChange={(e) => setFilters((f) => ({ ...f, weekLabel: e.target.value }))}
              >
                <option value="">Semua minggu</option>
                {weeks.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tanggal</Label>
              <Input
                type="date"
                value={filters.date}
                onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
          </div>
          {hasFilter && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={resetFilters}>
              Reset filter
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : media.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground">
          <ImageOff className="h-10 w-10 mb-3 opacity-50" />
          <p>Belum ada foto{hasFilter ? ' untuk filter ini' : ''}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {media.map((m) => (
            <button
              key={m.id}
              onClick={() => setPreview(m)}
              className="group relative aspect-square rounded-lg overflow-hidden border bg-muted hover:ring-2 hover:ring-primary transition"
            >
              <img
                src={m.drive_thumb_url}
                alt={m.caption || m.file_name || 'Foto'}
                loading="lazy"
                className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                referrerPolicy="no-referrer"
              />
              {m.caption && (
                <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[10px] px-2 py-1 truncate text-left">
                  {m.caption}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Preview */}
      <Dialog open={!!preview} onClose={() => setPreview(null)}>
        <DialogContent onClose={() => setPreview(null)} className="max-w-2xl">
          {preview && (
            <div className="p-2">
              <div className="rounded-lg overflow-hidden bg-black flex items-center justify-center">
                <img
                  src={`https://drive.google.com/thumbnail?id=${preview.drive_file_id}&sz=w1600`}
                  alt={preview.caption || 'Foto'}
                  className="max-h-[70vh] w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="p-4 space-y-2">
                {preview.caption && <p className="font-medium">{preview.caption}</p>}
                <div className="flex flex-wrap gap-2 text-xs">
                  {preview.gallery_categories?.name && (
                    <Badge variant="secondary" className="gap-1">
                      <Tag className="h-3 w-3" />{preview.gallery_categories.name}
                    </Badge>
                  )}
                  {preview.taken_at && (
                    <Badge variant="outline" className="gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(preview.taken_at + 'T12:00:00'), 'd MMM yyyy', { locale: localeId })}
                    </Badge>
                  )}
                  {preview.week_label && <Badge variant="outline">{preview.week_label}</Badge>}
                  <Badge variant={preview.source === 'wa' ? 'warning' : 'default'}>
                    {preview.source === 'wa' ? 'WhatsApp' : 'Web'}
                  </Badge>
                </div>
                <a
                  href={`https://drive.google.com/file/d/${preview.drive_file_id}/view`}
                  target="_blank" rel="noreferrer"
                  className="inline-block text-xs text-primary hover:underline"
                >
                  Buka di Google Drive ↗
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
