const fs = require('fs');
const path = require('path');

const src = 'A:/PERSONAL PROJECT/APPabsensi/absensi-qr/sertifikat';
const dest = 'A:/PERSONAL PROJECT/APPabsensi/absensi-qr/public/sertifikat';

try {
    let log = "";
    fs.mkdirSync(dest, { recursive: true });
    log += "created dir\n";

    if (fs.existsSync(path.join(src, 'front.svg'))) {
        fs.copyFileSync(path.join(src, 'front.svg'), path.join(dest, 'front.svg'));
        log += "copied front.svg\n";
    } else { log += "front.svg NOT FOUND\n"; }

    if (fs.existsSync(path.join(src, 'back.svg'))) {
        fs.copyFileSync(path.join(src, 'back.svg'), path.join(dest, 'back.svg'));
        log += "copied back.svg\n";
    } else { log += "back.svg NOT FOUND\n"; }

    fs.cpSync(path.join(src, 'front_images'), path.join(dest, 'front_images'), { recursive: true });
    log += "copied front_images\n";

    fs.cpSync(path.join(src, 'back_images'), path.join(dest, 'back_images'), { recursive: true });
    log += "copied back_images\n";

    fs.writeFileSync('copy_log.txt', log);
    console.log("DONE");
} catch (e) {
    fs.writeFileSync('copy_log.txt', "ERROR: " + e.message + "\n" + e.stack);
    console.error("FAIL");
}
