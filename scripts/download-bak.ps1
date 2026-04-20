# Download remaining .bak files from server via Tailscale
$files = @('Ecas2672.bak','Ecas2673.bak')
foreach ($f in $files) {
    $url = "http://100.114.106.110:8899/$f"
    $out = "d:\almham\imports\$f"
    if (Test-Path $out) { Write-Host "SKIP $f (exists)"; continue }
    Write-Host "Downloading $f..."
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $wc = New-Object System.Net.WebClient
    $wc.DownloadFile($url, $out)
    $sw.Stop()
    $mb = [math]::Round((Get-Item $out).Length / 1MB, 1)
    $sec = [math]::Round($sw.Elapsed.TotalSeconds, 1)
    $mbps = [math]::Round(($mb * 8) / $sec, 2)
    Write-Host "Done: $f = $mb MB in ${sec}s = $mbps Mbps"
}
Write-Host "ALL DONE!"
