import { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { supabase } from '../../lib/supabase';
import { UploadCloud, FileSpreadsheet, Download, RefreshCcw } from 'lucide-react';
import { useToast } from '../../components/ui/toast';

const PREDIKAT_RANGES = [
    { min: 100, label: 'Sempurna' },
    { min: 91, label: 'Amat Sangat Baik' },
    { min: 86, label: 'Amat Baik' },
    { min: 71, label: 'Baik' },
    { min: 60, label: 'Cukup' },
    { min: 0, label: 'Kurang' }
];

export default function SertifikatMass() {
    const [excelData, setExcelData] = useState([]);
    const [photoFiles, setPhotoFiles] = useState({});
    const [isProcessing, setIsProcessing] = useState(false);
    const [logs, setLogs] = useState([]);

    const { toast } = useToast();
    // Using dynamic import so xlsx is only loaded when mass generation is used
    const xlsxRef = useRef(null);

    const addLog = (msg) => {
        setLogs(prev => [...prev, msg]);
    };

    const loadXlsx = async () => {
        if (!xlsxRef.current) {
            // dynamically import xlsx
            xlsxRef.current = await import('xlsx-js-style');
        }
        return xlsxRef.current;
    };

    const handleExcelUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const XLSX = await loadXlsx();
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const parsed = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

            setExcelData(parsed);
            addLog(`[Excel] Berhasil memuat ${parsed.length} baris data dari ${file.name}`);
        } catch (err) {
            toast({ title: 'Gagal membaca Excel', description: err.message, variant: 'destructive' });
        }
    };

    const handlePhotosUpload = (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newPhotos = {};
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const basename = file.name.replace(/\.[^/.]+$/, "").trim().toLowerCase();
            newPhotos[basename] = file;
        }
        setPhotoFiles(newPhotos);
        addLog(`[Foto] ${Object.keys(newPhotos).length} foto disiapkan.`);
    };

    const downloadTemplate = async () => {
        const data = [
            ["Nama", "No Sertifikat", "TTL", "Level", "Lama Belajar", "Lulus/Tidak", "Tanggal Selesai", "Tanggal Terbit", "Nilai 1", "Nilai 2", "Nilai 3", "Nilai 4", "Nilai 5", "Predikat"],
            ["Dimas Pratama", "ICH-2026-001", "Jakarta, 1 Januari 2000", "N5", "3 Bulan", "LULUS", "30 Juni 2026", "25 Juni 2026", "85", "90", "75", "80", "95", ""],
        ];
        const XLSX = await loadXlsx();
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [
            { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 10 }, { wch: 12 },
            { wch: 12 }, { wch: 15 }, { wch: 15 },
            { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 12 }
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data_Siswa");
        XLSX.writeFile(wb, "Template_Sertifikat.xlsx");
    };

    const calculatePredikat = (scoresArray) => {
        const scores = scoresArray.map(v => parseFloat(v)).filter(v => !isNaN(v));
        if (scores.length === 0) return "";
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        for (const p of PREDIKAT_RANGES) {
            if (avg >= p.min) return p.label;
        }
        return "Kurang";
    };

    const startMassGeneration = async () => {
        if (excelData.length === 0) return;
        setIsProcessing(true);
        addLog('\n--- Memulai Sinkronisasi Database ---');

        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < excelData.length; i++) {
            const row = excelData[i];

            const getVal = (keys) => {
                for (const k of keys) {
                    if (row[k] !== undefined) return String(row[k]);
                }
                return "";
            };

            const nama = getVal(['Nama', 'Nama_Siswa']);
            if (!nama) continue;

            const nomor = getVal(['No Sertifikat', 'No_Sertifikat', 'Nomor Sertifikat']);
            const n1 = getVal(['Nilai 1', 'N1']);
            const n2 = getVal(['Nilai 2', 'N2']);
            const n3 = getVal(['Nilai 3', 'N3']);
            const n4 = getVal(['Nilai 4', 'N4']);
            const n5 = getVal(['Nilai 5', 'N5']);

            let predikat = getVal(['Predikat']);
            if (!predikat) {
                predikat = calculatePredikat([n1, n2, n3, n4, n5]);
            }

            const payload = {
                nomor: nomor,
                nama_peserta: nama,
                ttl: getVal(['TTL', 'Tempat Tanggal Lahir']),
                level: getVal(['Level']),
                lama: getVal(['Lama Belajar']),
                predikat: predikat,
                lulus: getVal(['Lulus/Tidak']),
                tgl_selesai: getVal(['Tanggal Selesai']),
                tgl_terbit: getVal(['Tanggal Terbit']),
                n1, n2, n3, n4, n5
            };

            addLog(`[${i + 1}/${excelData.length}] Memproses: ${nama}`);

            const { error } = await supabase.from('sertifikat').upsert(payload, { onConflict: 'nomor' });

            if (error) {
                addLog(`  ❌ Gagal simpan data DB: ${error.message}`);
                failedCount++;
            } else {
                successCount++;

                // Photo upload
                const pkey = nama.trim().toLowerCase();
                if (photoFiles[pkey]) {
                    const file = photoFiles[pkey];
                    const ext = file.name.split('.').pop();
                    const safeName = nama.replace(/[^\w\s-]/g, '_').trim();
                    const filePath = `${safeName}_${nomor}.${ext}`;

                    const { error: storageErr } = await supabase.storage.from('sertifikat_photos').upload(filePath, file, { upsert: true });
                    if (storageErr) addLog(`  ⚠️ Gagal upload foto: ${storageErr.message}`);
                    else addLog(`  📸 Foto terunggah.`);
                } else {
                    addLog(`  ℹ️ Tidak ada file foto ditemukan untuk "${nama}"`);
                }
            }
        }

        addLog('\n--- Selesai Sinkronisasi ---');
        addLog(`✅ Sukses: ${successCount} data`);
        if (failedCount > 0) addLog(`❌ Gagal: ${failedCount} data`);

        setIsProcessing(false);
        toast({ title: 'Sinkronisasi Selesai', description: 'Lihat daftar terminal log untuk detail.' });
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
                                {excelData.length > 0 ? `${excelData.length} Baris Data Tersimpan` : 'Format baku tabel siswa'}
                            </span>
                            <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleExcelUpload} />
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
                                {Object.keys(photoFiles).length > 0 ? `${Object.keys(photoFiles).length} Foto Tersimpan` : 'Nama file = Nama siswa di Excel'}
                            </span>
                            <input type="file" className="hidden" multiple accept="image/*" onChange={handlePhotosUpload} />
                        </label>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="bg-primary/5 py-4 border-b">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">3. Sinkronisasi Database (Supabase)</CardTitle>
                        <Button onClick={startMassGeneration} disabled={isProcessing || excelData.length === 0}>
                            {isProcessing ? <RefreshCcw className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
                            Kirim Data
                        </Button>
                    </div>
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
