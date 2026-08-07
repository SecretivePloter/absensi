import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import SertifikatSingle from '../features/sertifikat/SertifikatSingle';
import SertifikatMass from '../features/sertifikat/SertifikatMass';

export default function Sertifikat() {
    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Generator Sertifikat</h1>
                <p className="text-muted-foreground mt-1">Buat sertifikat presensi acara Ichikara secara tunggal atau massal.</p>
            </div>

            <Tabs defaultValue="single" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="single">Sertifikat Tunggal</TabsTrigger>
                    <TabsTrigger value="massal">Sinkronisasi Massal (Excel)</TabsTrigger>
                </TabsList>
                <TabsContent value="single" className="border-none p-0">
                    <SertifikatSingle />
                </TabsContent>
                <TabsContent value="massal" className="border-none p-0 mt-4">
                    <SertifikatMass />
                </TabsContent>
            </Tabs>
        </div>
    );
}
