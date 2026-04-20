try {
    $r = Invoke-WebRequest -Uri 'http://100.114.106.110' -UseBasicParsing -TimeoutSec 5
    Write-Host "Status: $($r.StatusCode)"
    Write-Host "Server: $($r.Headers.Server)"
    Write-Host "Content (first 1000 chars):"
    Write-Host ($r.Content.Substring(0, [Math]::Min(1000, $r.Content.Length)))
} catch {
    Write-Host "HTTP Error: $($_.Exception.Message)"
}
