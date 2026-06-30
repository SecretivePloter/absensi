// ============================================================
// Tab "Upload" — multi-file upload ke Google Drive + metadata.
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { UploadCloud, X, CheckCircle2, AlertCircle, Plus } from 'lucide-react'
import { Card, CardContent } from '../../../components/ui/card'
import { Select } from '../../../components/ui/select'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Button } from '../../../components/ui/button'
import { Spinner } from '../../../components/ui/spinner'
import { useToast } from '../../../components/ui/toast'
import { listCategories, createCategory, uploadMedia } from '../lib/galleryApi'

export default function GalleryUpload({ onUploaded }) {
  const toast = useToast()
  const fileInputRef = useRef(null)
  const [categories, setCategories] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [takenAt, setTakenAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [caption, setCaption] = useState('')
  const [files, setFiles] = useState([]) // { file, status:'idle'|'uploading'|'done'|'error', error }
  const [uploading, setUploading] = useState(false)

  const loadCategories = () => listCategories().then(setCategories).catch(() => {})
  useEffect(() => { loadCategories() }, [])

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList)
      .filter((f) => f.type.startsWith('image/'))
      .map((file) => ({ file, status: 'idle', error: null }))
    setFiles((prev) => [...prev, ...incoming])
  }

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx))

  const handleCreateCategory = async () => {
    if (!newCategory.trim()) return
    try {
      const cat = await createCategory(newCategory)
      await loadCategories()
      setCategoryId(cat.id)
      setNewCategory('')
      toast({ title: 'Kategori dibuat', variant: 'success' })
    } catch (err) {
      toast({ title: 'Gagal membuat kategori', description: err.message, variant: 'error' })
    }
  }

  const handleUpload = async () => {
    const pending = files.filter((f) => f.status !== 'done')
    if (pending.length === 0) {
      toast({ title: 'Tidak ada file untuk diupload', variant: 'error' })
      return
    }
    setUploading(true)
    let success = 0
    for (let i = 0; i < files.length; i++) {
      if (files[i].status === 'done') continue
      setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: 'uploading', error: null } : f)))
      try {
        await uploadMedia(files[i].file, { categoryId: categoryId || null, caption, takenAt })
        setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: 'done' } : f)))
        success++
      } catch (err) {
        setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: 'error', error: err.message } : f)))
      }
    }
    setUploading(false)
    if (success > 0) {
      toast({ title: `${success} foto berhasil diupload`, variant: 'success' })
      onUploaded?.()
    }
  }

  const allDone = files.length > 0 && files.every((f) => f.status === 'done')

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 pb-4 space-y-4">
          {/* Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Kategori</Label>
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">(Tanpa kategori)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              <div className="flex gap-2 pt-1">
                <Input
                  placeholder="Kategori baru..."
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCategory() } }}
                  className="h-8 text-xs"
                />
                <Button variant="outline" size="sm" onClick={handleCreateCategory} disabled={!newCategory.trim()}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tanggal foto</Label>
              <Input type="date" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Caption (opsional, berlaku untuk semua foto kali ini)</Label>
            <Input placeholder="mis. Kegiatan kelas N4 minggu ini" value={caption} onChange={(e) => setCaption(e.target.value)} />
          </div>

          {/* Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-accent/30 transition"
          >
            <UploadCloud className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Klik atau seret foto ke sini (bisa banyak sekaligus)
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Foto otomatis dikompres sebelum diupload ke Google Drive.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
            />
          </div>

          {/* Daftar file */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm border rounded-md px-3 py-2">
                  <span className="flex-1 truncate">{f.file.name}</span>
                  {f.status === 'uploading' && <Spinner size="sm" />}
                  {f.status === 'done' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  {f.status === 'error' && (
                    <span title={f.error}><AlertCircle className="h-4 w-4 text-destructive" /></span>
                  )}
                  {f.status === 'idle' && !uploading && (
                    <button onClick={() => removeFile(idx)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2">
            {allDone && (
              <Button variant="outline" onClick={() => setFiles([])}>Bersihkan</Button>
            )}
            <Button onClick={handleUpload} disabled={uploading || files.length === 0}>
              {uploading ? <Spinner size="sm" className="mr-2" /> : <UploadCloud className="h-4 w-4 mr-2" />}
              {uploading ? 'Mengupload...' : `Upload ${files.filter((f) => f.status !== 'done').length || ''} foto`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
