import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { SlidersHorizontal, Upload } from 'lucide-react';
import SertifikatSingle from '../features/sertifikat/SertifikatSingle';
import SertifikatMass from '../features/sertifikat/SertifikatMass';
import SertifikatValidator from '../features/sertifikat/SertifikatValidator';
import SertifikatGallery from '../features/sertifikat/SertifikatGallery';

const LS_KEY = 'ich_adj';

function ImportKalibrasiModal({ onClose }) {
    const [text, setText] = useState('');
    const [msg, setMsg] = useState(null);

    const handleImport = () => {
        try {
            const parsed = JSON.parse(text.trim());
            if (typeof parsed !== 'object' || parsed === null || (!parsed.front && !parsed.back)) {
                setMsg({ type: 'err', text: 'Format salah — JSON harus punya field "front" dan/atau "back".' });
                return;
            }
            const toSave = { front: parsed.front || {}, back: parsed.back || {} };
            localStorage.setItem(LS_KEY, JSON.stringify(toSave));
            setMsg({ type: 'ok', text: `✅ Berhasil! ${Object.keys(toSave.front).length} adj depan, ${Object.keys(toSave.back).length} adj belakang tersimpan.` });
        } catch (e) {
            setMsg({ type: 'err', text: 'JSON tidak valid: ' + e.message });
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-card border rounded-xl shadow-2xl w-full max-w-lg flex flex-col gap-4 p-5">
                <div>
                    <h2 className="font-bold text-base">Import JSON Kalibrasi Tata Letak</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                        Tempel JSON kalibrasi dari alat adjust.html. Data akan disimpan ke localStorage browser ini
                        sehingga Generator Preview akan menerapkan tata letak yang benar.
                    </p>
                </div>

                <textarea
                    className="w-full h-56 bg-muted/50 border rounded-lg p-3 font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={'{\n  "front": { ... },\n  "back": { ... }\n}'}
                    value={text}
                    onChange={e => { setText(e.target.value); setMsg(null); }}
                    spellCheck={false}
                />

                {msg && (
                    <p className={`text-xs px-3 py-2 rounded ${msg.type === 'ok' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                        {msg.text}
                    </p>
                )}

                <div className="flex gap-2 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 text-sm rounded border hover:bg-muted transition-colors">
                        {msg?.type === 'ok' ? 'Tutup' : 'Batal'}
                    </button>
                    {msg?.type !== 'ok' && (
                        <button
                            onClick={handleImport}
                            disabled={!text.trim()}
                            className="px-4 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                            Simpan ke Browser
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function Sertifikat() {
    const [showImport, setShowImport] = useState(false);

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            {showImport && <ImportKalibrasiModal onClose={() => setShowImport(false)} />}

            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Generator Sertifikat</h1>
                    <p className="text-muted-foreground mt-1">Buat, sinkronisasi, validasi, dan kelola sertifikat presensi acara Ichikara.</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                    <button
                        onClick={() => setShowImport(true)}
                        className="inline-flex items-center gap-1.5 text-xs border border-dashed rounded px-2.5 py-1.5 hover:text-primary hover:border-primary transition-colors text-muted-foreground"
                        title="Import JSON kalibrasi ke localStorage browser ini">
                        <Upload className="w-3.5 h-3.5" />
                        Import Kalibrasi
                    </button>
                    <a
                        href="/sertifikat/adjust.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs border border-dashed rounded px-2.5 py-1.5 hover:text-primary hover:border-primary transition-colors text-muted-foreground"
                        title="Buka alat kalibrasi tata letak sertifikat">
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        Buka Alat Kalibrasi
                    </a>
                </div>
            </div>

            <Tabs defaultValue="single" className="w-full">
                <TabsList className="mb-4 h-auto flex-wrap gap-1">
                    <TabsTrigger value="single">Generator Tunggal</TabsTrigger>
                    <TabsTrigger value="massal">Sinkronisasi Massal</TabsTrigger>
                    <TabsTrigger value="validasi">Validasi Sertifikat</TabsTrigger>
                    <TabsTrigger value="arsip">Arsip &amp; Galeri</TabsTrigger>
                </TabsList>
                <TabsContent value="single" className="border-none p-0">
                    <SertifikatSingle />
                </TabsContent>
                <TabsContent value="massal" className="border-none p-0 mt-4">
                    <SertifikatMass />
                </TabsContent>
                <TabsContent value="validasi" className="border-none p-0 mt-4">
                    <SertifikatValidator />
                </TabsContent>
                <TabsContent value="arsip" className="border-none p-0 mt-4">
                    <SertifikatGallery />
                </TabsContent>
            </Tabs>
        </div>
    );
}
