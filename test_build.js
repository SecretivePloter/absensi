const { execSync } = require('child_process');
try {
    console.log("Starting build...");
    const msg = execSync('npm run build', { stdio: 'pipe' }).toString();
    console.log("BUILD SUCCESS");
    console.log(msg);
} catch (e) {
    console.log("BUILD FAILED");
    console.log(e.stdout ? e.stdout.toString() : '');
    console.log(e.stderr ? e.stderr.toString() : '');
    console.error(e);
}
