# OH Installer for Windows
Write-Host "Installing OH (Open Hermes)..." -ForegroundColor Cyan

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js detected: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found. Download from: https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

# Build
Write-Host "Building..." -ForegroundColor Yellow
npm run build

# Add to PATH
$ohPath = (Get-Location).Path
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$ohPath*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$ohPath", "User")
    Write-Host "✓ Added to PATH" -ForegroundColor Green
}

Write-Host "`n✓ OH installed successfully!" -ForegroundColor Green
Write-Host "Run 'npm run oh' to start" -ForegroundColor Cyan
