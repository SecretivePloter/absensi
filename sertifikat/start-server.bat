@echo off
echo ===================================================
echo   Generator Sertifikat - Server Lokal
echo ===================================================
echo.
echo Memulai server di http://localhost:3456 ...
echo.

:: Coba jalankan server Node
node "%~dp0server.js"

:: Kalau Node gagal, coba Python
if errorlevel 1 (
  echo [Node.js tidak ditemukan, mencoba Python...]
  cd /d "%~dp0"
  python -m http.server 3456
)

if errorlevel 1 (
  echo.
  echo [ERROR] Tidak ada Node.js maupun Python yang ditemukan.
  echo Silakan install Node.js dari: https://nodejs.org/
  echo.
  pause
)
