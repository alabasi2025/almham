# Test download speed from server via Tailscale
$baseUrl = 'http://100.114.106.110:8899'
$outDir = 'd:\almham\imports'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

# 1. Test list endpoint
Write-Host "=== Test connection ===" -ForegroundColor Cyan
try {
    $r = Invoke-WebRequest "$baseUrl/list" -UseBasicParsing -TimeoutSec 10
    Write-Host $r.Content
} catch {
    Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. Download smallest .bak (Ecas2670 = 146 MB) as speed test
Write-Host "`n=== Download Ecas2670.bak (146 MB) ===" -ForegroundColor Cyan
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    Invoke-WebRequest "$baseUrl/Ecas2670.bak" -OutFile "$outDir\Ecas2670.bak" -UseBasicParsing -TimeoutSec 600
    $sw.Stop()
    $size = (Get-Item "$outDir\Ecas2670.bak").Length
    $sec = $sw.Elapsed.TotalSeconds
    $mbps = [math]::Round(($size * 8 / 1MB) / $sec, 2)
    Write-Host ("OK: {0} MB in {1}s = {2} Mbps" -f [math]::Round($size/1MB,1), [math]::Round($sec,1), $mbps) -ForegroundColor Green
} catch {
    Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red
}
