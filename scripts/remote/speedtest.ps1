# Quick internet speed test on server
$urls = @(
    @{Name='Cloudflare 10MB'; Url='https://speed.cloudflare.com/__down?bytes=10000000'}
    @{Name='Hetzner 100MB';   Url='https://speed.hetzner.de/100MB.bin'}
)

foreach ($u in $urls) {
    $tmp = "$env:TEMP\spdtest.bin"
    try {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        Invoke-WebRequest $u.Url -OutFile $tmp -UseBasicParsing -TimeoutSec 60
        $sw.Stop()
        $size = (Get-Item $tmp).Length
        $sec = $sw.Elapsed.TotalSeconds
        $mbps = [math]::Round(($size * 8 / 1MB) / $sec, 2)
        Write-Output "$($u.Name): $([math]::Round($size/1MB,1)) MB in $([math]::Round($sec,1))s = $mbps Mbps"
        Remove-Item $tmp -Force -EA SilentlyContinue
    } catch {
        Write-Output "$($u.Name): FAIL - $($_.Exception.Message)"
    }
}
