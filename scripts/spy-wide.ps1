$exe = "d:\almham\imports\ECAS-App\Electricity Customers Accounts System\Electricity Customers Accounts System.exe"
$bytes = [System.IO.File]::ReadAllBytes($exe)
$regBytes = $bytes[0x2F5000..0x2F8FFF]
$regText = [System.Text.Encoding]::Unicode.GetString($regBytes)
$pattern = "[\u0020-\u007E\u0600-\u06FF]{6,}"
$found = [regex]::Matches($regText, $pattern)
$lines = @()
foreach ($m in $found) {
    $abs = 0x2F5000 + $m.Index * 2
    $v = $m.Value.Trim()
    if ($v.Length -ge 6) {
        $lines += "[0x$('{0:X}' -f $abs)] $v"
    }
}
$lines | Out-File "d:\almham\imports\spy-wide.txt" -Encoding UTF8
Write-Host ("Found " + $lines.Count + " strings")
