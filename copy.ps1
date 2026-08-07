$ErrorActionPreference = "Stop"
try {
    $src = "A:\PERSONAL PROJECT\APPabsensi\absensi-qr\sertifikat"
    $dest = "A:\PERSONAL PROJECT\APPabsensi\absensi-qr\public\sertifikat"
    
    if (-not (Test-Path $dest)) {
        New-Item -ItemType Directory -Force -Path $dest | Out-Null
        Write-Host "Created public\sertifikat directory"
    }

    Copy-Item "$src\front.svg" -Destination $dest -Force
    Write-Host "Copied front.svg"
    
    Copy-Item "$src\back.svg" -Destination $dest -Force
    Write-Host "Copied back.svg"
    
    Copy-Item "$src\front_images\*.*" -Destination "$dest\front_images\" -Recurse -Force
    Write-Host "Copied front_images"
    
    Copy-Item "$src\back_images\*.*" -Destination "$dest\back_images\" -Recurse -Force
    Write-Host "Copied back_images"
    
    Write-Host "ALL COPIED SUCCESSFULLY"
    
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
}
