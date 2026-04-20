# Read the temp<DB>.html files and examine
$base = 'C:\Program Files (x86)\Electricity Customers Accounts System'
foreach ($f in @('temp22668.html','temp22672.html','temp22673.html')) {
    $p = Join-Path $base $f
    if (Test-Path $p) {
        Write-Output ""
        Write-Output "===================================="
        Write-Output "=== $f ==="
        Write-Output "===================================="
        $fi = Get-Item $p
        Write-Output "Size: $($fi.Length) bytes"
        Write-Output "Modified: $($fi.LastWriteTime)"
        Write-Output ""
        # Show first 3000 chars
        $content = Get-Content $p -Raw -Encoding UTF8
        Write-Output "--- First 3000 chars ---"
        Write-Output ($content.Substring(0, [Math]::Min(3000, $content.Length)))
        Write-Output ""
        Write-Output "--- Last 1500 chars ---"
        Write-Output ($content.Substring([Math]::Max(0, $content.Length - 1500)))
    }
}
