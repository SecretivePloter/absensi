import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import SertifikatSingle from '../features/sertifikat/SertifikatSingle';
import SertifikatMass from '../features/sertifikat/SertifikatMass';
import SertifikatValidator from '../features/sertifikat/SertifikatValidator';
import SertifikatGallery from '../features/sertifikat/SertifikatGallery';

export default function Sertifikat() {
    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Generator Sertifikat</h1>
                <p className="text-muted-foreground mt-1">Buat, sinkronisasi, validasi, dan kelola sertifikat presensi acara Ichikara.</p>
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
