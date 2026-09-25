@echo off
SETLOCAL ENABLEDELAYEDEXPANSION

echo Run this script outside of WSL and when WSL is running.
SET "CERT_TMP=docker-certs\automa.lcl.crt"

echo Installing certificate: %CERT_TMP%
certutil -addstore -f "Root" "%CERT_TMP%"
if %ERRORLEVEL% EQU 0 (
    echo Certificate installed successfully!
    echo Check it in your Certmgr.msc
    echo       Certificates / Current User / Trusted Root Certification Authorities / Certificates
	start "" mmc.exe /s certmgr.msc /c "Root"
) else (
    echo ERROR: Failed to install certificate. Run as Administrator.
    pause
    exit /b 1
)

echo Done. Certificate is trusted system-wide.
pause
exit /b 1
ENDLOCAL
