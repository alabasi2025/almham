# Extract wider context around spy message - all readable strings
$exe = 'd:\almham\imports\ECAS-App\Electricity Customers Accounts System\Electricity Customers Accounts System.exe'
$bytes = [System.IO.File]::ReadAllBytes($exe)
$uni = [System.Text.Encoding]::Unicode.GetString($bytes)
$out = 'd:\almham\imports\wider-context.txt'

# Region: 0x17A000 - 0x17C500 (wider range around spy message at 0x17B9EE)
$startChar = 0x17A000 / 2
$endChar = 0x17C500 / 2
Write-Host "Extracting strings from 0x17A000 to 0x17C500..." -ForegroundColor Cyan

$region = $uni.Substring($startChar, $endChar - $startChar)
# Match any readable string 5+ chars (includes SQL keywords, short conditions)
$pattern = '[\u0020-\u007E\u0600-\u06FF]{5,}'
$regexMatches = [regex]::Matches($region, $pattern)

$lines = @()
foreach ($m in $regexMatches) {
    $absOffset = $startChar * 2 + $m.Index * 2
    $v = $m.Value.Trim()
    if ($v.Length -ge 5) {
        $lines += "[0x$('{0:X}' -f $absOffset)] $v"
    }
}

$lines | Out-File $out -Encoding UTF8
Write-Host "Found $($lines.Count) strings, saved to $out"
