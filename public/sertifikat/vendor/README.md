# Dependensi lokal sertifikat

Bundel digunakan langsung oleh halaman statis, sehingga preview, PDF, dan pembacaan Excel tidak perlu CDN saat dijalankan.

| Bundel | Versi / sumber | Lisensi |
| --- | --- | --- |
| jsPDF | 4.2.1, disalin dari dependency proyek | jspdf-LICENSE |
| Supabase JS | 2.107.0, disalin dari dependency proyek | supabase-LICENSE |
| SheetJS | 0.20.3, https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js | xlsx-LICENSE |
| Barlow Condensed 600 | Google Fonts | barlowcondensed-OFL.txt |
| Barlow Semi Condensed 400/700 | Google Fonts | barlowsemicondensed-OFL.txt |
| Libre Bodoni 400 | Google Fonts | librebodoni-OFL.txt |

`fonts.json` digunakan untuk menyematkan font ke SVG sebelum rasterisasi. `fonts.css` menyediakan font yang sama untuk pengukuran teks di DOM. `SHA256.json` mencatat integritas aset. Saat memperbarui bundel, perbarui versi, lisensi, checksum, dan jalankan regresi sertifikat. Jangan mengubah package.json/lockfile hanya untuk menjalankan halaman statis ini.
