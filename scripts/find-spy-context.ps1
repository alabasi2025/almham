# Extract SQL queries and code around spy message at 0x17B9EE
$exe = 'd:\almham\imports\ECAS-App\Electricity Customers Accounts System\Electricity Customers Accounts System.exe'
$bytes = [System.IO.File]::ReadAllBytes($exe)
$uni = [System.Text.Encoding]::Unicode.GetString($bytes)

# Extract region: 0x17B000 - 0x17C500 (before and after spy message)
$startOffset = 0x17B000 / 2  # Unicode char offset
$endOffset = 0x17C500 / 2

Write-Host "Extracting region around spy message..." -ForegroundColor Cyan
$region = $uni.Substring($startOffset, $endOffset - $startOffset)

# Split by null/control chars and save readable parts
$cleaned = $region -replace '[\x00-\x08\x0E-\x1F]', '|'
$parts = $cleaned -split '\|{2,}' | Where-Object { $_.Length -ge 10 }

$out = 'd:\almham\imports\spy-context.txt'
$lines = @()
$i = 0
foreach ($p in $parts) {
    $i++
    $lines += "--- String $i ---"
    $lines += $p.Trim()
    $lines += ""
}
$lines | Out-File $out -Encoding UTF8
Write-Host "Found $i strings in region" -ForegroundColor Green
Write-Host "Saved to $out" -ForegroundColor Green
