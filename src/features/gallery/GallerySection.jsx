// ============================================================
// Halaman utama modul Galeri — berisi tab navigasi internal.
// Dibungkus Layout existing agar seamless dgn portal.
// ============================================================
import { useState } from 'react'
import { clsx } from 'clsx'
import { Images, UploadCloud, Settings, Tag, MessageCircle } from 'lucide-react'
import { Layout } from '../../components/Layout'
import GalleryGrid from './tabs/GalleryGrid'
import GalleryUpload from './tabs/GalleryUpload'
import GalleryManage from './tabs/GalleryManage'
import GalleryCategories from './tabs/GalleryCategories'
import GalleryWaAdmins from './tabs/GalleryWaAdmins'

const TABS = [
  { key: 'galeri', label: 'Galeri', icon: Images },
  { key: 'upload', label: 'Upload', icon: UploadCloud },
  { key: 'kelola', label: 'Kelola', icon: Settings },
  { key: 'kategori', label: 'Kategori', icon: Tag },
  { key: 'wa', label: 'WA Admin', icon: MessageCircle },
]

export default function GallerySection() {
  const [tab, setTab] = useState('galeri')
  // dipakai untuk memaksa refresh grid/kelola setelah upload/perubahan
  const [refreshKey, setRefreshKey] = useState(0)
  const bump = () => setRefreshKey((k) => k + 1)

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Galeri Ichikara</h1>
          <p className="text-sm text-muted-foreground">Dokumentasi foto kegiatan - tersimpan di Google Drive.</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 border-b overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
                tab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Konten tab */}
        {tab === 'galeri' && <GalleryGrid key={`grid-${refreshKey}`} />}
        {tab === 'upload' && <GalleryUpload onUploaded={() => { bump(); setTab('galeri') }} />}
        {tab === 'kelola' && <GalleryManage refreshKey={refreshKey} onChanged={bump} />}
        {tab === 'kategori' && <GalleryCategories onChanged={bump} />}
        {tab === 'wa' && <GalleryWaAdmins />}
      </div>
    </Layout>
  )
}
