$exe = "d:\almham\imports\ECAS-App\Electricity Customers Accounts System\Electricity Customers Accounts System.exe"
$bytes = [System.IO.File]::ReadAllBytes($exe)

# Look at EVERYTHING in region 0x2F5000 to 0x2F8000
$regBytes = $bytes[0x2F5000..0x2F7FFF]
$regText = [System.Text.Encoding]::Unicode.GetString($regBytes)
$pattern = "[\u0020-\u007E\u0600-\u06FF]{4,}"
$found = [regex]::Matches($regText, $pattern)
$lines = @()
foreach ($m in $found) {
    $abs = 0x2F5000 + $m.Index * 2
    $v = $m.Value.Trim()
    if ($v.Length -ge 4) {
        $lines += "[0x$('{0:X}' -f $abs)] $v"
    }
}
$lines | Out-File "d:\almham\imports\spy-full-region.txt" -Encoding UTF8
Write-Host ("Saved " + $lines.Count + " strings")
