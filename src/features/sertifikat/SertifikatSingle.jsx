import { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { Download, UploadCloud, FileType2, Save } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useToast } from '../../components/ui/toast';
import { supabaseCert } from '../../lib/supabaseCert';
import {
    preProcessSVG, parseSVG, patchFonts,
    replacePlaceholders, injectPhoto, assignAdjIds, applyStoredAdjustments
} from './utils/svgHelpers';

// Helper: fetch image URL → base64 data URL
async function toDataURL(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        return await new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

// Patch all non-photo <image> elements to base64 so SVG becomes self-contained
async function patchSVGImages(svgDoc, imageFolder, filenamePrefix) {
    const NS = 'http://www.w3.org/1999/xlink';
    const els = Array.from(svgDoc.querySelectorAll('image'));
    await Promise.all(els.map(async el => {
        // Skip the passenger photo placeholder
        const href = el.getAttributeNS(NS, 'href') || el.getAttribute('xlink:href') || el.getAttribute('href') || '';
        if (href.startsWith('data:')) return;
        if (href.includes('ImgID3') || el.id === 'photo-placeholder') return;

        let filename = href.replace(/\\/g, '/').split('/').pop();
        if (filenamePrefix) {
            filename = filename.replace(new RegExp('^' + filenamePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '');
        }
        const fullPath = imageFolder + filename;
        const dataUrl = await toDataURL(fullPath);
        if (dataUrl) {
            el.setAttributeNS(NS, 'xlink:href', dataUrl);
            el.setAttribute('href', dataUrl);
        }
    }));
}

// Render an SVG element to a canvas
async function svgToCanvas(svgEl, W, H) {
    // Clear inline CSS width/height (set by preview display) so the attribute takes precedence
    svgEl.style.width = '';
    svgEl.style.height = '';
    // Set explicit pixel dimensions — required so browser renders SVG at correct size
    svgEl.setAttribute('width', W);
    svgEl.setAttribute('height', H);
    const ser = new XMLSerializer();
    const svgStr = ser.serializeToString(svgEl);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = W; canvas.height = H;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, W, H);
            ctx.drawImage(img, 0, 0, W, H);
            URL.revokeObjectURL(url);
            resolve(canvas);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gagal render SVG ke canvas')); };
        img.src = url;
    });
}

// Format tanggal Indonesia
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
function fmtDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${BULAN[m - 1]} ${y}`;
}

export default function SertifikatSingle() {
    const [formData, setFormData] = useState({
        nama: '', nomor: '', lahir: '', level: '', predikat: '',
        lama: '', lulus: '', selesai: '', terbit: '',
        n1: '', n2: '', n3: '', n4: '', n5: ''
    });
    const [photoDataURL, setPhotoDataURL] = useState(null);
    const [previewState, setPreviewState] = useState('idle'); // idle | loading | done | error
    const [isSaving, setIsSaving] = useState(false);

    const { toast } = useToast();
    const frontRef = useRef(null);
    const backRef = useRef(null);

    // Dimensi foto frame (SVG viewBox units)
    const PHOTO_W = 1600.96, PHOTO_H = 2001.59, PHOTO_RATIO = PHOTO_W / PHOTO_H;

    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handlePhotoUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const img = new Image();
            img.onload = () => {
                const OUT_W = 960, OUT_H = Math.round(OUT_W / PHOTO_RATIO);
                const canvas = document.createElement('canvas');
                canvas.width = OUT_W; canvas.height = OUT_H;
                const ctx = canvas.getContext('2d');
                const imgR = img.width / img.height;
                let sx = 0, sy = 0, sw = img.width, sh = img.height;
                if (imgR > PHOTO_RATIO) { sw = img.height * PHOTO_RATIO; sx = (img.width - sw) / 2; }
                else { sh = img.width / PHOTO_RATIO; sy = (img.height - sh) / 2; }
                ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H);
                setPhotoDataURL(canvas.toDataURL('image/jpeg', 0.92));
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    };

    const handleFillTest = () => setFormData({
        nama: 'Kresna Wirawan', nomor: 'ICH-2026-001', lahir: 'Jakarta, 4 Juni 2000',
        level: 'N5 (Dasar)', predikat: 'Amat Baik', lama: '6 Bulan', lulus: 'LULUS',
        selesai: '2026-06-20', terbit: '2026-06-25',
        n1: '22', n2: '20', n3: '23', n4: '24', n5: '21'
    });

    // Build the placeholder map
    const buildMap = () => ({
        'NAMA PESERTA': formData.nama || '-',
        'NAMA': formData.nama || '-',
        'Nomor Sertifikat 2': formData.nomor || '-',
        'Nomor Sertifikat 1': 'No.DK.01.03/278/IX/2024',
        'Tempat dan Tanggal Lahir Peserta': formData.lahir || '-',
        'Level Bahasa Jepang': formData.level || '-',
        'predikat': formData.predikat || '-',
        'lama Waktu Belajar': formData.lama || '-',
        'lulus/ tidak lulus': formData.lulus || '-',
        'lulus/tidak': formData.lulus || '-',
        'Tanggal Selesai Kursus': fmtDate(formData.selesai) || '-',
        'Tanggal terbit sertifikat': fmtDate(formData.terbit) || '-',
        'Tanggal terbit Sertifikat': fmtDate(formData.terbit) || '-',
        'N_25': formData.n1 || '-',
        'N_12': formData.n2 || '-',
        'N_13': formData.n3 || '-',
        'N_15': formData.n4 || '-',
        'N_16': formData.n5 || '-',
    });

    // Core: fetch & process SVG docs; returns { frontDoc, backDoc }
    const processSVGs = async () => {
        const [frontRes, backRes] = await Promise.all([
            fetch('/sertifikat/front.svg'),
            fetch('/sertifikat/back.svg'),
        ]);
        if (!frontRes.ok) throw new Error(`Gagal muat front.svg (${frontRes.status}). Pastikan file ada di public/sertifikat/`);
        if (!backRes.ok) throw new Error(`Gagal muat back.svg (${backRes.status}). Pastikan file ada di public/sertifikat/`);

        const [frontRaw, backRaw] = await Promise.all([frontRes.text(), backRes.text()]);

        const frontDoc = parseSVG(preProcessSVG(frontRaw));
        const backDoc = parseSVG(preProcessSVG(backRaw));

        // Check for SVG parse errors
        const frontErr = frontDoc.querySelector('parsererror');
        const backErr = backDoc.querySelector('parsererror');
        if (frontErr) throw new Error('SVG front.svg gagal diparse: ' + frontErr.textContent.slice(0, 100));
        if (backErr) throw new Error('SVG back.svg gagal diparse: ' + backErr.textContent.slice(0, 100));

        patchFonts(frontDoc); patchFonts(backDoc);
        assignAdjIds(frontDoc); assignAdjIds(backDoc);

        // Patch embedded images to base64 (so SVG is self-contained for canvas rendering)
        await patchSVGImages(frontDoc, '/sertifikat/front_images/', 'Backup_of_1. Bani_');
        await patchSVGImages(backDoc, '/sertifikat/back_images/', 'Belakang_');

        const map = buildMap();
        replacePlaceholders(frontDoc, map);
        replacePlaceholders(backDoc, map);
        injectPhoto(frontDoc, photoDataURL);

        return { frontDoc, backDoc };
    };

    const appendSVGToRef = (svgEl, label, targetRef) => {
        if (!targetRef.current) return;
        targetRef.current.innerHTML = `
            <div class="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">${label}</div>
            <div class="bg-white rounded-md shadow p-2 mb-6 svg-preview-container"></div>
        `;
        const container = targetRef.current.querySelector('.svg-preview-container');
        svgEl.removeAttribute('width');
        svgEl.removeAttribute('height');
        svgEl.style.width = '100%';
        svgEl.style.height = 'auto';
        container.appendChild(svgEl);
    };

    const handleGeneratePreview = async () => {
        setPreviewState('loading');
        try {
            const { frontDoc, backDoc } = await processSVGs();

            const frontEl = document.importNode(frontDoc.documentElement, true);
            const backEl = document.importNode(backDoc.documentElement, true);

            setPreviewState('done');
            // Defer so React renders the containers first, then inject SVG + apply adjustments
            setTimeout(async () => {
                appendSVGToRef(frontEl, 'Halaman Depan', frontRef);
                appendSVGToRef(backEl, 'Halaman Belakang', backRef);
                // Apply stored layout adjustments AFTER SVGs are attached to the DOM (getBBox needs DOM context)
                const frontSvg = frontRef.current?.querySelector('svg');
                const backSvg = backRef.current?.querySelector('svg');
                if (frontSvg) await applyStoredAdjustments(frontSvg, 'front');
                if (backSvg) await applyStoredAdjustments(backSvg, 'back');
            }, 50);
        } catch (e) {
            console.error(e);
            toast({ title: 'Gagal generate preview', description: e.message, variant: 'destructive' });
            setPreviewState('error');
        }
    };

    const handleDownload = async () => {
        const frontSvg = frontRef.current?.querySelector('svg');
        const backSvg = backRef.current?.querySelector('svg');
        if (!frontSvg || !backSvg) {
            toast({ title: 'Generate preview terlebih dahulu', variant: 'destructive' });
            return;
        }
        toast({ title: 'Menyiapkan PDF...' });
        try {
            // A4 Landscape @ 300 DPI
            const W = 3508, H = 2480;
            const [c1, c2] = await Promise.all([
                svgToCanvas(frontSvg.cloneNode(true), W, H),
                svgToCanvas(backSvg.cloneNode(true), W, H),
            ]);
            const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
            doc.addImage(c1.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 297, 210);
            doc.addPage();
            doc.addImage(c2.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 297, 210);
            const safeName = (formData.nama || 'sertifikat').replace(/[^a-zA-Z0-9]/g, '_');
            doc.save(`Sertifikat_${safeName}.pdf`);
            toast({ title: 'Download Selesai!' });
        } catch (e) {
            console.error(e);
            toast({ title: 'Gagal Download PDF', description: e.message, variant: 'destructive' });
        }
    };

    const handleSaveToArchive = async () => {
        if (!formData.nama || !formData.nomor) {
            toast({ title: 'Nama dan Nomor Sertifikat wajib diisi', variant: 'destructive' });
            return;
        }
        setIsSaving(true);
        try {
            const payload = {
                nomor: formData.nomor,
                nama_peserta: formData.nama,
                ttl: formData.lahir,
                level: formData.level,
                lama: formData.lama,
                predikat: formData.predikat,
                lulus: formData.lulus,
                tgl_selesai: formData.selesai || null,
                tgl_terbit: formData.terbit || null,
                n1: formData.n1, n2: formData.n2, n3: formData.n3,
                n4: formData.n4, n5: formData.n5,
            };
            const { error } = await supabaseCert.from('sertifikat').upsert(payload, { onConflict: 'nomor' });
            if (error) throw error;
            toast({ title: 'Tersimpan ke Arsip!', description: `Nomor: ${formData.nomor}` });
        } catch (e) {
            toast({ title: 'Gagal simpan arsip', description: e.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 max-w-7xl mx-auto">
            {/* === Left Panel: Form === */}
            <div className="w-full md:w-[400px] flex-shrink-0 space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex justify-between items-center">
                            <span>Data Peserta</span>
                            <Button variant="outline" size="sm" onClick={handleFillTest} className="h-7 text-xs">Isi Contoh</Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-1">
                            <Label>Nama Peserta *</Label>
                            <Input name="nama" value={formData.nama} onChange={handleChange} placeholder="Kresna Wirawan" />
                        </div>
                        <div className="space-y-1">
                            <Label>Nomor Sertifikat *</Label>
                            <Input name="nomor" value={formData.nomor} onChange={handleChange} placeholder="ICH-2026-001" />
                        </div>
                        <div className="space-y-1">
                            <Label>Tempat &amp; Tanggal Lahir</Label>
                            <Input name="lahir" value={formData.lahir} onChange={handleChange} placeholder="Jakarta, 1 Januari 2000" />
                        </div>
                        <div className="space-y-1">
                            <Label>Level Bahasa Jepang</Label>
                            <Input name="level" value={formData.level} onChange={handleChange} placeholder="N5 (Dasar)" />
                        </div>
                        <div className="space-y-1">
                            <Label>Predikat</Label>
                            <Select value={formData.predikat} onChange={e => setFormData(p => ({ ...p, predikat: e.target.value }))}>
                                <option value="" disabled>— Pilih Predikat —</option>
                                <option value="Sempurna">Sempurna</option>
                                <option value="Amat Sangat Baik">Amat Sangat Baik</option>
                                <option value="Amat Baik">Amat Baik</option>
                                <option value="Baik">Baik</option>
                                <option value="Cukup">Cukup</option>
                                <option value="Kurang">Kurang</option>
                            </Select>
                        </div>

                        <div className="border-t pt-3 grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label>Lama Belajar</Label>
                                <Input name="lama" value={formData.lama} onChange={handleChange} placeholder="3 Bulan" />
                            </div>
                            <div className="space-y-1">
                                <Label>Status Kelulusan</Label>
                                <Select value={formData.lulus} onChange={e => setFormData(p => ({ ...p, lulus: e.target.value }))}>
                                    <option value="" disabled>Pilih...</option>
                                    <option value="LULUS">Lulus</option>
                                    <option value="TIDAK LULUS">Tidak Lulus</option>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Tgl Selesai</Label>
                                <Input type="date" name="selesai" value={formData.selesai} onChange={handleChange} />
                            </div>
                            <div className="space-y-1">
                                <Label>Tgl Terbit</Label>
                                <Input type="date" name="terbit" value={formData.terbit} onChange={handleChange} />
                            </div>
                        </div>

                        <div className="border-t pt-3 space-y-1">
                            <Label>Nilai per Kategori (maks 25)</Label>
                            <div className="grid grid-cols-5 gap-2">
                                {['n1', 'n2', 'n3', 'n4', 'n5'].map((k, i) => (
                                    <Input key={k} name={k} value={formData[k]} onChange={handleChange}
                                        placeholder={`N${i + 1}`} className="text-center px-1" />
                                ))}
                            </div>
                        </div>

                        <div className="border-t pt-3 space-y-1">
                            <Label>Foto Peserta</Label>
                            <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-accent transition-colors relative">
                                <input type="file" accept="image/*" onChange={handlePhotoUpload}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                                {!photoDataURL ? (
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <UploadCloud className="h-6 w-6" />
                                        <span className="text-sm">Klik atau Seret Foto</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <img src={photoDataURL} alt="Preview" className="w-16 h-20 object-cover border rounded shadow-sm" />
                                        <span className="text-xs text-primary font-medium">Foto Dimuat ✓ (Klik untuk Ganti)</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <Button className="w-full" onClick={handleGeneratePreview} disabled={previewState === 'loading' || !formData.nama}>
                            {previewState === 'loading' ? 'Memproses...' : 'Generate Preview'}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* === Right Panel: Preview === */}
            <div className="flex-1 min-w-0">
                <Card className="h-full bg-muted/30">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2 flex-wrap">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <FileType2 className="w-5 h-5 text-primary" /> Preview Sertifikat
                        </CardTitle>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleSaveToArchive}
                                disabled={previewState !== 'done' || isSaving}>
                                <Save className="w-4 h-4 mr-2" /> {isSaving ? 'Menyimpan...' : 'Simpan Arsip'}
                            </Button>
                            <Button variant="default" size="sm" onClick={handleDownload}
                                disabled={previewState !== 'done'}>
                                <Download className="w-4 h-4 mr-2" /> Download PDF
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {previewState === 'idle' && (
                            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                                <p>Isi data peserta lalu klik <strong className="text-primary">Generate Preview</strong></p>
                            </div>
                        )}
                        {previewState === 'loading' && (
                            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
                                <p>Merender template sertifikat...</p>
                            </div>
                        )}
                        {previewState === 'error' && (
                            <div className="h-64 flex flex-col items-center justify-center text-destructive border-2 border-dashed border-destructive/40 rounded-lg gap-2">
                                <p className="font-semibold">Gagal Generate Preview</p>
                                <p className="text-xs text-muted-foreground">Periksa konsol browser untuk detail error</p>
                            </div>
                        )}
                        <div className={previewState === 'done' ? 'block' : 'hidden'}>
                            <div ref={frontRef} />
                            <div ref={backRef} />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
