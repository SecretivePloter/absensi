import { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { supabaseCert } from '../../lib/supabaseCert';
import { UploadCloud, FileSpreadsheet, Download, RefreshCcw, FileDown } from 'lucide-react';
import { useToast } from '../../components/ui/toast';
import { jsPDF } from 'jspdf';
import { preProcessSVG, parseSVG, patchFonts, replacePlaceholders, injectPhoto, assignAdjIds } from './utils/svgHelpers';

const PREDIKAT_RANGES = [
    { min: 100, label: 'Sempurna' },
    { min: 91, label: 'Amat Sangat Baik' },
    { min: 86, label: 'Amat Baik' },
    { min: 71, label: 'Baik' },
    { min: 60, label: 'Cukup' },
    { min: 0, label: 'Kurang' },
];

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
function fmtDate(str) {
    if (!str) return '';
    // Sudah dalam format Indonesia (misal: "30 Juni 2026") — biarkan
    if (/\d{4}$/.test(str.trim()) && str.includes(' ')) return str.trim();
    // ISO format (YYYY-MM-DD)
    const parts = str.split('-');
    if (parts.length === 3) {
        const [y, m, d] = parts.map(Number);
        return `${d} ${BULAN[m - 1]} ${y}`;
    }
    return str;
}

// Convert image URL to base64
async function toDataURL(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        return await new Promise(r => {
            const reader = new FileReader();
            reader.onload = e => r(e.target.result);
            reader.readAsDataURL(blob);
        });
    } catch { return null; }
}

// Patch embedded images in SVG doc to base64
async function patchSVGImages(svgDoc, folder, prefix) {
    const NS = 'http://www.w3.org/1999/xlink';
    await Promise.all(Array.from(svgDoc.querySelectorAll('image')).map(async el => {
        const href = el.getAttributeNS(NS, 'href') || el.getAttribute('xlink:href') || el.getAttribute('href') || '';
        if (href.startsWith('data:') || href.includes('ImgID3')) return;
        let filename = href.replace(/\\/g, '/').split('/').pop();
        if (prefix) filename = filename.replace(new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '');
        const dataUrl = await toDataURL(folder + filename);
        if (dataUrl) {
            el.setAttributeNS(NS, 'xlink:href', dataUrl);
            el.setAttribute('href', dataUrl);
        }
    }));
}

// Render SVG element → canvas → JPEG data URL
async function svgToDataURL(svgEl, W, H) {
    // Set explicit pixel dimensions so browser renders SVG at the correct size (prevents blank output)
    svgEl.style.width = '';
    svgEl.style.height = '';
    svgEl.setAttribute('width', W);
    svgEl.setAttribute('height', H);
    const svgStr = new XMLSerializer().serializeToString(svgEl);
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
            resolve(canvas.toDataURL('image/jpeg', 0.92));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG render gagal')); };
        img.src = url;
    });
}

export default function SertifikatMass() {
    const [excelData, setExcelData] = useState([]);
    const [photoFiles, setPhotoFiles] = useState({});
    const [isProcessing, setIsProcessing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [logs, setLogs] = useState([]);
    const [, setSyncDone] = useState(false);

    const { toast } = useToast();
    const xlsxRef = useRef(null);
    // Cache SVG text so we don't re-fetch for each row
    const svgCacheRef = useRef(null);

    const addLog = (msg) => setLogs(prev => [...prev, msg]);

    const loadXlsx = async () => {
        if (!xlsxRef.current) xlsxRef.current = await import('xlsx-js-style');
        return xlsxRef.current;
    };

    const handleExcelUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSyncDone(false);
        try {
            const XLSX = await loadXlsx();
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const parsed = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
            setExcelData(parsed);
            setLogs([`[Excel] Berhasil memuat ${parsed.length} baris dari "${file.name}"`]);
        } catch (err) {
            toast({ title: 'Gagal membaca Excel', description: err.message, variant: 'destructive' });
        }
    };

    const handlePhotosUpload = (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const newPhotos = {};
        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            const basename = f.name.replace(/\.[^/.]+$/, '').trim().toLowerCase();
            newPhotos[basename] = f;
        }
        setPhotoFiles(newPhotos);
        addLog(`[Foto] ${Object.keys(newPhotos).length} foto disiapkan.`);
    };

    const downloadTemplate = async () => {
        const data = [
            ['Nama', 'No Sertifikat', 'TTL', 'Level', 'Lama Belajar', 'Lulus/Tidak', 'Tanggal Selesai', 'Tanggal Terbit', 'Nilai 1', 'Nilai 2', 'Nilai 3', 'Nilai 4', 'Nilai 5', 'Predikat'],
            ['Dimas Pratama', 'ICH-2026-001', 'Jakarta, 1 Januari 2000', 'N5', '3 Bulan', 'LULUS', '30 Juni 2026', '25 Juni 2026', '85', '90', '75', '80', '95', ''],
        ];
        const XLSX = await loadXlsx();
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [15, 15, 25, 10, 12, 12, 15, 15, 8, 8, 8, 8, 8, 12].map(wch => ({ wch }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Data_Siswa');
        XLSX.writeFile(wb, 'Template_Sertifikat.xlsx');
    };

    const calculatePredikat = (scores) => {
        const vals = scores.map(v => parseFloat(v)).filter(v => !isNaN(v));
        if (!vals.length) return '';
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        return PREDIKAT_RANGES.find(p => avg >= p.min)?.label || 'Kurang';
    };

    const buildRowPayload = (row) => {
        const getVal = (...keys) => {
            for (const k of keys) { if (row[k] !== undefined && row[k] !== '') return String(row[k]); }
            return '';
        };
        const nama = getVal('Nama', 'Nama_Siswa');
        if (!nama) return null;
        const n1 = getVal('Nilai 1', 'N1');
        const n2 = getVal('Nilai 2', 'N2');
        const n3 = getVal('Nilai 3', 'N3');
        const n4 = getVal('Nilai 4', 'N4');
        const n5 = getVal('Nilai 5', 'N5');
        const predikat = getVal('Predikat') || calculatePredikat([n1, n2, n3, n4, n5]);
        const nomor = getVal('No Sertifikat', 'No_Sertifikat', 'Nomor Sertifikat');
        return {
            nomor, nama_peserta: nama,
            ttl: getVal('TTL', 'Tempat Tanggal Lahir'),
            level: getVal('Level'),
            lama: getVal('Lama Belajar'),
            predikat, lulus: getVal('Lulus/Tidak'),
            tgl_selesai: getVal('Tanggal Selesai') || null,
            tgl_terbit: getVal('Tanggal Terbit') || null,
            n1, n2, n3, n4, n5,
        };
    };

    const startSync = async () => {
        if (excelData.length === 0) return;
        setIsProcessing(true);
        setSyncDone(false);
        addLog('\n--- Memulai Sinkronisasi Database ---');
        let ok = 0, fail = 0;

        for (let i = 0; i < excelData.length; i++) {
            const payload = buildRowPayload(excelData[i]);
            if (!payload) { addLog(`[${i + 1}] ⚠️ Baris kosong, dilewati.`); continue; }
            addLog(`[${i + 1}/${excelData.length}] Memproses: ${payload.nama_peserta}`);

            const { error } = await supabaseCert.from('sertifikat').upsert(payload, { onConflict: 'nomor' });
            if (error) { addLog(`  ❌ Gagal DB: ${error.message}`); fail++; continue; }
            ok++;

            // Upload foto jika ada
            const pkey = payload.nama_peserta.trim().toLowerCase();
            if (photoFiles[pkey]) {
                const file = photoFiles[pkey];
                const ext = file.name.split('.').pop();
                const safeName = payload.nama_peserta.replace(/[^\w\s-]/g, '_').trim();
                const filePath = `${safeName}_${payload.nomor}.${ext}`;
                const { error: se } = await supabaseCert.storage.from('sertifikat_photos').upload(filePath, file, { upsert: true });
                addLog(se ? `  ⚠️ Gagal upload foto: ${se.message}` : `  📸 Foto terunggah.`);
            } else {
                addLog(`  ℹ️ Tidak ada foto untuk "${payload.nama_peserta}"`);
            }
        }

        addLog('\n--- Selesai Sinkronisasi ---');
        addLog(`✅ Sukses: ${ok} | ❌ Gagal: ${fail}`);
        setIsProcessing(false);
        setSyncDone(ok > 0);
        toast({ title: 'Sinkronisasi Selesai', description: `${ok} data berhasil disimpan.` });
    };

    const generateAllPDFs = async () => {
        if (excelData.length === 0) return;
        setIsGenerating(true);
        addLog('\n--- Memulai Generate PDF Massal ---');

        try {
            // Fetch & cache SVG templates once
            if (!svgCacheRef.current) {
                addLog('[SVG] Memuat template front.svg dan back.svg...');
                const [fr, br] = await Promise.all([fetch('/sertifikat/front.svg'), fetch('/sertifikat/back.svg')]);
                if (!fr.ok) throw new Error('Gagal muat front.svg dari /public/sertifikat/');
                if (!br.ok) throw new Error('Gagal muat back.svg dari /public/sertifikat/');
                svgCacheRef.current = { front: await fr.text(), back: await br.text() };
                addLog('[SVG] Template dimuat.');
            }

            // Dynamically import fflate for ZIP
            const { zipSync } = await import('fflate');
            const zipEntries = {};
            const W = 3508, H = 2480;

            for (let i = 0; i < excelData.length; i++) {
                const payload = buildRowPayload(excelData[i]);
                if (!payload) continue;
                addLog(`[${i + 1}/${excelData.length}] Render: ${payload.nama_peserta}`);

                const map = {
                    'NAMA PESERTA': payload.nama_peserta,
                    'NAMA': payload.nama_peserta,
                    'Nomor Sertifikat 2': payload.nomor || '-',
                    'Nomor Sertifikat 1': 'No.DK.01.03/278/IX/2024',
                    'Tempat dan Tanggal Lahir Peserta': payload.ttl || '-',
                    'Level Bahasa Jepang': payload.level || '-',
                    'predikat': payload.predikat || '-',
                    'lama Waktu Belajar': payload.lama || '-',
                    'lulus/ tidak lulus': payload.lulus || '-',
                    'lulus/tidak': payload.lulus || '-',
                    'Tanggal Selesai Kursus': fmtDate(payload.tgl_selesai) || '-',
                    'Tanggal terbit sertifikat': fmtDate(payload.tgl_terbit) || '-',
                    'Tanggal terbit Sertifikat': fmtDate(payload.tgl_terbit) || '-',
                    'N_25': payload.n1 || '-',
                    'N_12': payload.n2 || '-',
                    'N_13': payload.n3 || '-',
                    'N_15': payload.n4 || '-',
                    'N_16': payload.n5 || '-',
                };

                try {
                    const frontDoc = parseSVG(preProcessSVG(svgCacheRef.current.front));
                    const backDoc = parseSVG(preProcessSVG(svgCacheRef.current.back));
                    patchFonts(frontDoc); patchFonts(backDoc);
                    assignAdjIds(frontDoc); assignAdjIds(backDoc);
                    await patchSVGImages(frontDoc, '/sertifikat/front_images/', 'Backup_of_1. Bani_');
                    await patchSVGImages(backDoc, '/sertifikat/back_images/', 'Belakang_');
                    replacePlaceholders(frontDoc, map);
                    replacePlaceholders(backDoc, map);

                    // Inject photo if available
                    const pkey = payload.nama_peserta.trim().toLowerCase();
                    if (photoFiles[pkey]) {
                        const photoB64 = await new Promise(r => {
                            const reader = new FileReader();
                            reader.onload = e => r(e.target.result);
                            reader.readAsDataURL(photoFiles[pkey]);
                        });
                        injectPhoto(frontDoc, photoB64);
                    }

                    const frontEl = document.importNode(frontDoc.documentElement, true);
                    const backEl = document.importNode(backDoc.documentElement, true);

                    const [j1, j2] = await Promise.all([
                        svgToDataURL(frontEl, W, H),
                        svgToDataURL(backEl, W, H),
                    ]);

                    const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
                    doc.addImage(j1, 'JPEG', 0, 0, 297, 210);
                    doc.addPage();
                    doc.addImage(j2, 'JPEG', 0, 0, 297, 210);

                    const pdfBytes = doc.output('arraybuffer');
                    const safeName = payload.nama_peserta.replace(/[^a-zA-Z0-9]/g, '_');
                    zipEntries[`Sertifikat_${safeName}.pdf`] = new Uint8Array(pdfBytes);
                    addLog(`  ✅ PDF dibuat.`);
                } catch (rowErr) {
                    addLog(`  ❌ Gagal render: ${rowErr.message}`);
                }
            }

            if (Object.keys(zipEntries).length === 0) throw new Error('Tidak ada PDF yang berhasil dibuat.');

            addLog('[ZIP] Mengemas semua PDF...');
            const zipped = zipSync(zipEntries, { level: 1 });
            const blob = new Blob([zipped], { type: 'application/zip' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'Sertifikat_Massal.zip';
            link.click();
            URL.revokeObjectURL(link.href);

            addLog(`\n✅ Download ZIP selesai! (${Object.keys(zipEntries).length} PDF)`);
            toast({ title: 'Generate Massal Selesai!', description: `${Object.keys(zipEntries).length} sertifikat PDF dikemas dalam ZIP.` });
        } catch (e) {
            addLog(`\n❌ Error: ${e.message}`);
            toast({ title: 'Gagal Generate PDF', description: e.message, variant: 'destructive' });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex justify-between items-center">
                            <span>1. Data Peserta (Excel)</span>
                            <Button variant="outline" size="sm" onClick={downloadTemplate}>
                                <Download className="w-3 h-3 mr-2" /> Template
                            </Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <label className="border-2 border-dashed border-primary/40 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-accent/50 transition-colors">
                            <FileSpreadsheet className="w-8 h-8 text-primary mb-3" />
                            <span className="font-medium text-sm">Upload File Excel / CSV</span>
                            <span className="text-xs text-muted-foreground mt-1">
                                {excelData.length > 0 ? `✅ ${excelData.length} Baris Data Tersimpan` : 'Format baku tabel siswa'}
                            </span>
                            <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleExcelUpload} />
                        </label>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">2. Pas Foto Sekaligus</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <label className="border-2 border-dashed border-primary/40 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-accent/50 transition-colors">
                            <UploadCloud className="w-8 h-8 text-primary mb-3" />
                            <span className="font-medium text-sm">Upload Semua Foto</span>
                            <span className="text-xs text-muted-foreground mt-1">
                                {Object.keys(photoFiles).length > 0 ? `✅ ${Object.keys(photoFiles).length} Foto Tersimpan` : 'Nama file = Nama siswa di Excel'}
                            </span>
                            <input type="file" className="hidden" multiple accept="image/*" onChange={handlePhotosUpload} />
                        </label>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="bg-primary/5 py-4 border-b">
                    <div className="flex justify-between items-center gap-3 flex-wrap">
                        <CardTitle className="text-lg">3. Proses</CardTitle>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={startSync} disabled={isProcessing || isGenerating || excelData.length === 0}>
                                {isProcessing ? <RefreshCcw className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
                                Simpan ke DB
                            </Button>
                            <Button onClick={generateAllPDFs} disabled={isProcessing || isGenerating || excelData.length === 0}>
                                {isGenerating ? <RefreshCcw className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
                                Generate & Download ZIP
                            </Button>
                        </div>
                    </div>
                    {excelData.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                            {excelData.length} baris data. "Simpan ke DB" → sinkronisasi database. "Generate &amp; Download ZIP" → buat PDF semua sertifikat.
                        </p>
                    )}
                </CardHeader>
                <CardContent className="p-0">
                    <div className="bg-black text-green-400 font-mono text-xs p-4 h-64 overflow-y-auto whitespace-pre-wrap rounded-b-lg">
                        {logs.length === 0 ? '> Menunggu file dimasukkan...' : logs.join('\n')}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
