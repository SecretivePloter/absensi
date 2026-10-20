import { ExternalLink, RefreshCcw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/ui/button'

const GENERATOR_URL = '/sertifikat/index.html'

export default function SertifikatGeneratorEmbed() {
  const [frameKey, setFrameKey] = useState(0)

  return (
    <section className="space-y-3" aria-labelledby="generator-title">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="generator-title" className="font-semibold">Generator Sertifikat</h2>
          <p className="text-sm text-muted-foreground">
            Buat preview dua halaman, pasang foto peserta, lalu unduh PDF langsung dari browser.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setFrameKey((value) => value + 1)}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Muat Ulang
          </Button>
          <a
            href={GENERATOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Buka Penuh
          </a>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
        <iframe
          key={frameKey}
          src={GENERATOR_URL}
          title="Generator Sertifikat Ichikara"
          className="block h-[980px] w-full bg-white sm:h-[920px]"
          allow="clipboard-write"
        />
      </div>
    </section>
  )
}
