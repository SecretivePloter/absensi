const { execSync } = require('child_process');
try {
    console.log("Installing jspdf...");
    execSync('npm install jspdf', { stdio: 'inherit' });
    console.log("INSTALL SUCCESS");

    console.log("Running build...");
    execSync('npm run build', { stdio: 'inherit' });
    console.log("BUILD SUCCESS");
} catch (e) {
    console.log("FAILED");
    console.error(e);
}
