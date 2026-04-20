$out = @()

# ODBC DSNs (32-bit for VB6)
$out += "=== ODBC DSNs (WOW6432) ==="
$dsnKey = "HKLM:\SOFTWARE\WOW6432Node\ODBC\ODBC.INI\ODBC Data Sources"
if (Test-Path $dsnKey) {
    $dsns = Get-ItemProperty $dsnKey
    $dsns.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' } | ForEach-Object {
        $out += ("  " + $_.Name + " = " + $_.Value)
    }
}

# ECAS DSN details
$out += ""
$out += "=== ECAS DSN Details ==="
foreach ($name in @("Ecas2668","Ecas2672","Ecas2673")) {
    $k = "HKLM:\SOFTWARE\WOW6432Node\ODBC\ODBC.INI\$name"
    if (Test-Path $k) {
        $out += "  DSN: $name"
        $p = Get-ItemProperty $k
        $p.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' } | ForEach-Object {
            $out += ("    " + $_.Name + " = " + $_.Value)
        }
    } else {
        $out += "  DSN: $name -> NOT FOUND in WOW6432"
    }
}

# Also check user DSNs
$out += ""
$out += "=== User DSNs ==="
$udsnKey = "HKCU:\SOFTWARE\ODBC\ODBC.INI\ODBC Data Sources"
if (Test-Path $udsnKey) {
    $dsns = Get-ItemProperty $udsnKey
    $dsns.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' } | ForEach-Object {
        $out += ("  " + $_.Name + " = " + $_.Value)
    }
}

# INI files in ECAS dir
$out += ""
$out += "=== Config files in ECAS dir ==="
$ecasDir = "C:\Program Files (x86)\Electricity Customers Accounts System"
Get-ChildItem $ecasDir -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -in @('.ini','.cfg','.lic','.key','.dat','.bin','.txt') -or $_.Name -like "*license*" } |
    ForEach-Object { $out += ("  " + $_.Name + " | " + $_.Length + " bytes | " + $_.LastWriteTime) }

# Check shortcuts for command line
$out += ""
$out += "=== ECAS shortcuts command lines ==="
$shell = New-Object -ComObject WScript.Shell
Get-ChildItem "C:\Users\Public\Desktop","C:\ProgramData\Microsoft\Windows\Start Menu\Programs" -Filter "*.lnk" -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "*ECAS*" -or $_.Name -like "*Electric*" -or $_.Name -like "*2668*" -or $_.Name -like "*2672*" -or $_.Name -like "*2673*" } |
    ForEach-Object {
        try {
            $lnk = $shell.CreateShortcut($_.FullName)
            $out += ("  " + $_.Name + " -> " + $lnk.TargetPath + " " + $lnk.Arguments)
        } catch {}
    }

$out -join "`n" | Out-File "C:\odbc_check_out.txt" -Encoding UTF8
Write-Host "Done"
