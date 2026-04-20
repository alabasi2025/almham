# Search for Alternate Data Streams and hidden items
$base = 'C:\Program Files (x86)\Electricity Customers Accounts System'

Write-Output "=== Files with Alternate Data Streams ==="
Get-ChildItem $base -Recurse -Force -File -EA SilentlyContinue | ForEach-Object {
    $streams = Get-Item $_.FullName -Stream * -EA SilentlyContinue | Where-Object { $_.Stream -ne ':$DATA' }
    if ($streams) {
        Write-Output ""
        Write-Output "FILE: $($_.FullName)"
        foreach ($s in $streams) {
            Write-Output "  Stream: $($s.Stream) (Length: $($s.Length))"
            if ($s.Length -lt 500) {
                try {
                    $content = Get-Content $_.FullName -Stream $s.Stream -Raw -EA SilentlyContinue
                    Write-Output "  Content: $content"
                } catch {}
            }
        }
    }
}

Write-Output ""
Write-Output "=== Files in root of ECAS folder with very small size (potential flags) ==="
Get-ChildItem $base -Force -File -EA SilentlyContinue | Where-Object { $_.Length -lt 1024 } | Select-Object Name, Length, LastWriteTime, Attributes

Write-Output ""
Write-Output "=== Recently modified files in ECAS folder (last 24h) ==="
Get-ChildItem $base -Force -Recurse -File -EA SilentlyContinue | Where-Object { $_.LastWriteTime -gt (Get-Date).AddHours(-24) } | Select-Object FullName, LastWriteTime, Length
