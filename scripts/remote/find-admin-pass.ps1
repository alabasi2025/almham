# Search EXE for admin password logic
$exe = 'C:\Program Files (x86)\Electricity Customers Accounts System\Electricity Customers Accounts System.exe'
$bytes = [System.IO.File]::ReadAllBytes($exe)
$uni = [System.Text.Encoding]::Unicode.GetString($bytes)

# Find strings near "nullandnotempty"
Write-Output "=== Strings near 'nullandnotempty' ==="
$idx = $uni.IndexOf('nullandnotempty')
if ($idx -ge 0) {
    $start = [Math]::Max(0, $idx - 200)
    $len = [Math]::Min(500, $uni.Length - $start)
    $context = $uni.Substring($start, $len) -replace '[^\x20-\x7E\u0600-\u06FF]', '.'
    Write-Output $context
}

# Find strings near "Administrator"
Write-Output ""
Write-Output "=== Strings near 'Administrator' ==="
$idx2 = $uni.IndexOf('Administrator')
if ($idx2 -ge 0) {
    $start = [Math]::Max(0, $idx2 - 200)
    $len = [Math]::Min(500, $uni.Length - $start)
    $context = $uni.Substring($start, $len) -replace '[^\x20-\x7E\u0600-\u06FF]', '.'
    Write-Output $context
}

# Search for password-related strings
Write-Output ""
Write-Output "=== Password candidates ==="
$ascii = [System.Text.Encoding]::ASCII.GetString($bytes)
$patterns = @('nullandnotempty', 'SystemPassWord', 'AdminPass', 'DBAPass', 'masterpass', 'superpass')
foreach ($p in $patterns) {
    $i = $ascii.IndexOf($p)
    if ($i -ge 0) {
        $s = [Math]::Max(0, $i - 50)
        $e = [Math]::Min($ascii.Length, $i + $p.Length + 50)
        $ctx = $ascii.Substring($s, $e - $s) -replace '[^\x20-\x7E]', '.'
        Write-Output "Found '$p' at $i : $ctx"
    }
}

# All strings containing 'pass' (case insensitive) 
Write-Output ""
Write-Output "=== All 'pass' strings ==="
$allMatches = [regex]::Matches($uni, '[A-Za-z0-9@#!_]{3,30}[Pp]ass[A-Za-z0-9@#!_]{0,30}')
$seen = @{}
foreach ($m in $allMatches) {
    if (-not $seen.ContainsKey($m.Value)) {
        Write-Output "  $($m.Value)"
        $seen[$m.Value] = $true
    }
}
