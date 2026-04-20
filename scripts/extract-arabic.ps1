# Fast Arabic string extraction from EXE with progress
$exe = 'd:\almham\imports\ECAS-App\Electricity Customers Accounts System\Electricity Customers Accounts System.exe'
$out = 'd:\almham\imports\arabic-strings.txt'

Write-Host "Step 1: Reading $([math]::Round((Get-Item $exe).Length/1MB,1)) MB..." -ForegroundColor Cyan
$bytes = [System.IO.File]::ReadAllBytes($exe)
Write-Host "  Loaded $($bytes.Length) bytes" -ForegroundColor Green

Write-Host "Step 2: Converting to UTF-16..." -ForegroundColor Cyan
$uni = [System.Text.Encoding]::Unicode.GetString($bytes)
Write-Host "  Converted to $($uni.Length) chars" -ForegroundColor Green

Write-Host "Step 3: Finding Arabic strings..." -ForegroundColor Cyan
# Regex for runs of Arabic chars + spaces + ASCII (min 20 chars)
$pattern = '[\u0600-\u06FF][\u0600-\u06FF\s\u0020-\u007E]{19,500}'
$regexMatches = [regex]::Matches($uni, $pattern)
Write-Host "  Found $($regexMatches.Count) Arabic strings" -ForegroundColor Green

Write-Host "Step 4: Saving to file..." -ForegroundColor Cyan
$lines = @()
foreach ($m in $regexMatches) {
    $lines += "[0x$('{0:X}' -f $m.Index)] $($m.Value)"
}
$lines | Out-File $out -Encoding UTF8
Write-Host "  Saved to $out" -ForegroundColor Green
Write-Host "  File size: $((Get-Item $out).Length) bytes" -ForegroundColor Green
