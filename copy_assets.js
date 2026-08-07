const fs = require('fs');
const path = require('path');

const src = 'A:/PERSONAL PROJECT/APPabsensi/absensi-qr/sertifikat';
const dest = 'A:/PERSONAL PROJECT/APPabsensi/absensi-qr/public/sertifikat';

fs.mkdirSync(dest, { recursive: true });
fs.copyFileSync(path.join(src, 'front.svg'), path.join(dest, 'front.svg'));
fs.copyFileSync(path.join(src, 'back.svg'), path.join(dest, 'back.svg'));

fs.cpSync(path.join(src, 'front_images'), path.join(dest, 'front_images'), { recursive: true });
fs.cpSync(path.join(src, 'back_images'), path.join(dest, 'back_images'), { recursive: true });

console.log('Copy complete!');
