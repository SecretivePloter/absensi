import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { supabaseCert } from '../../lib/supabaseCert';
import { Archive, Download, Trash2, RefreshCcw, Search, Loader } from 'lucide-react';
import { useToast } from '../../components/ui/toast';
import { jsPDF } from 'jspdf';
import { preProcessSVG, parseSVG, patchFonts, replacePlaceholders, assignAdjIds, applyStoredAdjustments } from './utils/svgHelpers';

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
function fmtDate(str) {
    if (!str) return '-';
    if (str.includes(' ') && /\d{4}$/.test(str.trim())) return str.trim();
    const parts = str.split('-');
    if (parts.length === 3) {
        const [y, m, d] = parts.map(Number);
        return `${d} ${BULAN[m - 1]} ${y}`;
    }
    return str;
}

// Convert URL to base64
async function toDataURL(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        return await new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsDataURL(blob); });
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
        if (dataUrl) { el.setAttributeNS(NS, 'xlink:href', dataUrl); el.setAttribute('href', dataUrl); }
    }));
}

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
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
            ctx.drawImage(img, 0, 0, W, H);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.92));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG render gagal')); };
        img.src = url;
    });
}

export default function SertifikatGallery() {
    const [records, setRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [downloadingId, setDownloadingId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [svgCache, setSvgCache] = useState(null);
    const { toast } = useToast();

    const fetchRecords = useCallback(async () => {
        setIsLoading(true);
        const { data, error } = await supabaseCert
            .from('sertifikat')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) toast({ title: 'Gagal muat arsip', description: error.message, variant: 'destructive' });
        else setRecords(data || []);
        setIsLoading(false);
    }, [toast]);

    const loadSvgCache = useCallback(async () => {
        if (svgCache) return svgCache;
        const [fr, br] = await Promise.all([fetch('/sertifikat/front.svg'), fetch('/sertifikat/back.svg')]);
        const cache = { front: await fr.text(), back: await br.text() };
        setSvgCache(cache);
        return cache;
    }, [svgCache]);

    useEffect(() => { fetchRecords(); }, [fetchRecords]);

    const filtered = records.filter(r =>
        r.nama_peserta?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.nomor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.level?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDownload = async (rec) => {
        setDownloadingId(rec.id);
        toast({ title: `Menyiapkan PDF: ${rec.nama_peserta}...` });
        try {
            const cache = await loadSvgCache();
            const map = {
                'NAMA PESERTA': rec.nama_peserta, 'NAMA': rec.nama_peserta,
                'Nomor Sertifikat 2': rec.nomor || '-',
                'Nomor Sertifikat 1': 'No.DK.01.03/278/IX/2024',
                'Tempat dan Tanggal Lahir Peserta': rec.ttl || '-',
                'Level Bahasa Jepang': rec.level || '-',
                'predikat': rec.predikat || '-',
                'lama Waktu Belajar': rec.lama || '-',
                'lulus/ tidak lulus': rec.lulus || '-',
                'lulus/tidak': rec.lulus || '-',
                'Tanggal Selesai Kursus': fmtDate(rec.tgl_selesai),
                'Tanggal terbit sertifikat': fmtDate(rec.tgl_terbit),
                'Tanggal terbit Sertifikat': fmtDate(rec.tgl_terbit),
                'N_25': rec.n1 || '-', 'N_12': rec.n2 || '-',
                'N_13': rec.n3 || '-', 'N_15': rec.n4 || '-', 'N_16': rec.n5 || '-',
            };

            const frontDoc = parseSVG(preProcessSVG(cache.front));
            const backDoc = parseSVG(preProcessSVG(cache.back));
            patchFonts(frontDoc); patchFonts(backDoc);
            assignAdjIds(frontDoc); assignAdjIds(backDoc);
            await patchSVGImages(frontDoc, '/sertifikat/front_images/', 'Backup_of_1. Bani_');
            await patchSVGImages(backDoc, '/sertifikat/back_images/', 'Belakang_');
            replacePlaceholders(frontDoc, map);
            replacePlaceholders(backDoc, map);

            // Apply stored layout adjustments before rendering to canvas
            await applyStoredAdjustments(frontDoc, 'front');
            await applyStoredAdjustments(backDoc, 'back');

            const W = 3508, H = 2480;
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
            const safeName = rec.nama_peserta.replace(/[^a-zA-Z0-9]/g, '_');
            doc.save(`Sertifikat_${safeName}.pdf`);
            toast({ title: 'Download Selesai!' });
        } catch (e) {
            toast({ title: 'Gagal download', description: e.message, variant: 'destructive' });
        } finally {
            setDownloadingId(null);
        }
    };

    const handleDelete = async (rec) => {
        if (!confirm(`Hapus sertifikat "${rec.nama_peserta}" (${rec.nomor})? Tindakan ini tidak bisa dibatalkan.`)) return;
        setDeletingId(rec.id);
        try {
            const { error } = await supabaseCert.from('sertifikat').delete().eq('id', rec.id);
            if (error) throw error;
            setRecords(prev => prev.filter(r => r.id !== rec.id));
            toast({ title: 'Sertifikat dihapus.' });
        } catch (e) {
            toast({ title: 'Gagal hapus', description: e.message, variant: 'destructive' });
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="flex items-center gap-2">
                    <Archive className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold text-lg">Arsip Sertifikat</h2>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{records.length} data</span>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari nama atau nomor..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                    <Button variant="outline" size="icon" onClick={fetchRecords} disabled={isLoading}>
                        <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {isLoading && (
                <div className="h-48 flex items-center justify-center text-muted-foreground gap-3">
                    <Loader className="w-5 h-5 animate-spin" /> Memuat arsip...
                </div>
            )}

            {!isLoading && filtered.length === 0 && (
                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg gap-2">
                    <Archive className="w-10 h-10 opacity-30" />
                    <p>{searchTerm ? 'Tidak ada hasil pencarian.' : 'Belum ada sertifikat tersimpan.'}</p>
                </div>
            )}

            {!isLoading && filtered.length > 0 && (
                <Card>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">No. Sertifikat</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nama Peserta</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Level</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Predikat</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Tgl Terbit</th>
                                        <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Status</th>
                                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(rec => (
                                        <tr key={rec.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs text-primary">{rec.nomor || '-'}</td>
                                            <td className="px-4 py-3 font-medium">{rec.nama_peserta}</td>
                                            <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{rec.level || '-'}</td>
                                            <td className="px-4 py-3 hidden lg:table-cell">
                                                {rec.predikat ? (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                                        {rec.predikat}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{fmtDate(rec.tgl_terbit)}</td>
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rec.lulus === 'LULUS' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                    {rec.lulus || '-'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex gap-1 justify-end">
                                                    <Button variant="outline" size="sm"
                                                        onClick={() => handleDownload(rec)}
                                                        disabled={downloadingId === rec.id || deletingId === rec.id}
                                                        title="Download PDF">
                                                        {downloadingId === rec.id
                                                            ? <Loader className="w-3.5 h-3.5 animate-spin" />
                                                            : <Download className="w-3.5 h-3.5" />}
                                                    </Button>
                                                    <Button variant="outline" size="sm"
                                                        onClick={() => handleDelete(rec)}
                                                        disabled={downloadingId === rec.id || deletingId === rec.id}
                                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        title="Hapus">
                                                        {deletingId === rec.id
                                                            ? <Loader className="w-3.5 h-3.5 animate-spin" />
                                                            : <Trash2 className="w-3.5 h-3.5" />}
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
