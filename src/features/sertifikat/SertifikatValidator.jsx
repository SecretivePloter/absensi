import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { supabaseCert } from '../../lib/supabaseCert';
import { Search, CheckCircle, XCircle, Loader } from 'lucide-react';
import { useToast } from '../../components/ui/toast';

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

function DetailRow({ label, value }) {
    return (
        <div className="flex flex-col sm:flex-row py-2 border-b last:border-0">
            <span className="text-sm font-medium text-muted-foreground w-52 flex-shrink-0">{label}</span>
            <span className="text-sm font-semibold">{value || '-'}</span>
        </div>
    );
}

export default function SertifikatValidator() {
    const [nomorInput, setNomorInput] = useState('');
    const [status, setStatus] = useState('idle'); // idle | loading | found | notfound | error
    const [result, setResult] = useState(null);
    const { toast } = useToast();

    const handleValidate = async () => {
        const nomor = nomorInput.trim();
        if (!nomor) { toast({ title: 'Masukkan nomor sertifikat', variant: 'destructive' }); return; }
        setStatus('loading');
        setResult(null);
        try {
            const { data, error } = await supabaseCert
                .from('sertifikat')
                .select('*')
                .eq('nomor', nomor)
                .maybeSingle();
            if (error) throw error;
            if (data) { setResult(data); setStatus('found'); }
            else setStatus('notfound');
        } catch (e) {
            console.error(e);
            toast({ title: 'Gagal validasi', description: e.message, variant: 'destructive' });
            setStatus('error');
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Search className="w-5 h-5 text-primary" />
                        Validasi Nomor Sertifikat
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Masukkan nomor sertifikat untuk memverifikasi keaslian dan melihat detail data pemilik.
                    </p>
                    <div className="flex gap-2">
                        <div className="flex-1 space-y-1">
                            <Label>Nomor Sertifikat</Label>
                            <Input
                                value={nomorInput}
                                onChange={e => { setNomorInput(e.target.value); setStatus('idle'); }}
                                onKeyDown={e => e.key === 'Enter' && handleValidate()}
                                placeholder="Contoh: ICH-2026-001"
                            />
                        </div>
                        <div className="flex items-end">
                            <Button onClick={handleValidate} disabled={status === 'loading'}>
                                {status === 'loading'
                                    ? <Loader className="w-4 h-4 animate-spin" />
                                    : <><Search className="w-4 h-4 mr-2" /> Cek</>}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* State: Not Found */}
            {status === 'notfound' && (
                <Card className="border-destructive/40">
                    <CardContent className="pt-6 flex flex-col items-center gap-3 text-center">
                        <XCircle className="w-12 h-12 text-destructive" />
                        <div>
                            <p className="font-semibold text-destructive">Sertifikat Tidak Ditemukan</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Nomor <strong>{nomorInput}</strong> tidak tercatat di sistem kami.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* State: Error */}
            {status === 'error' && (
                <Card className="border-destructive/40">
                    <CardContent className="pt-6 flex flex-col items-center gap-3 text-center">
                        <XCircle className="w-12 h-12 text-destructive" />
                        <p className="font-semibold text-destructive">Terjadi Kesalahan</p>
                        <p className="text-xs text-muted-foreground">Periksa koneksi internet dan coba lagi.</p>
                    </CardContent>
                </Card>
            )}

            {/* State: Found */}
            {status === 'found' && result && (
                <Card className="border-green-500/50">
                    <CardHeader className="pb-3 bg-green-50 dark:bg-green-950/30 rounded-t-lg">
                        <div className="flex items-center gap-3">
                            <CheckCircle className="w-7 h-7 text-green-600 flex-shrink-0" />
                            <div>
                                <p className="font-bold text-green-700 dark:text-green-400">Sertifikat VALID</p>
                                <p className="text-xs text-muted-foreground">Nomor: {result.nomor}</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <DetailRow label="Nama Peserta" value={result.nama_peserta} />
                        <DetailRow label="Tempat & Tgl Lahir" value={result.ttl} />
                        <DetailRow label="Level Bahasa Jepang" value={result.level} />
                        <DetailRow label="Lama Belajar" value={result.lama} />
                        <DetailRow label="Status Kelulusan" value={result.lulus} />
                        <DetailRow label="Predikat" value={result.predikat} />
                        <DetailRow label="Tanggal Selesai" value={fmtDate(result.tgl_selesai)} />
                        <DetailRow label="Tanggal Terbit" value={fmtDate(result.tgl_terbit)} />
                        {(result.n1 || result.n2 || result.n3 || result.n4 || result.n5) && (
                            <div className="py-2 border-b last:border-0">
                                <p className="text-sm font-medium text-muted-foreground mb-1">Nilai</p>
                                <div className="flex gap-4 flex-wrap">
                                    {[result.n1, result.n2, result.n3, result.n4, result.n5].map((n, i) =>
                                        n ? <span key={i} className="text-sm font-semibold bg-muted px-2 py-0.5 rounded">N{i + 1}: {n}</span> : null
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
