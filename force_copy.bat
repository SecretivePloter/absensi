mkdir "A:\PERSONAL PROJECT\APPabsensi\absensi-qr\public\sertifikat"
copy "A:\PERSONAL PROJECT\APPabsensi\absensi-qr\sertifikat\front.svg" "A:\PERSONAL PROJECT\APPabsensi\absensi-qr\public\sertifikat\" /Y
copy "A:\PERSONAL PROJECT\APPabsensi\absensi-qr\sertifikat\back.svg" "A:\PERSONAL PROJECT\APPabsensi\absensi-qr\public\sertifikat\" /Y
xcopy "A:\PERSONAL PROJECT\APPabsensi\absensi-qr\sertifikat\front_images" "A:\PERSONAL PROJECT\APPabsensi\absensi-qr\public\sertifikat\front_images\" /E /I /Y
xcopy "A:\PERSONAL PROJECT\APPabsensi\absensi-qr\sertifikat\back_images" "A:\PERSONAL PROJECT\APPabsensi\absensi-qr\public\sertifikat\back_images\" /E /I /Y
echo "ALL COPIED"
