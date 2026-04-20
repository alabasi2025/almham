# Check ODBC DSNs
Write-Host "=== ODBC System DSNs ===" -ForegroundColor Cyan
Get-ItemProperty "HKLM:\SOFTWARE\ODBC\ODBC.INI\ODBC Data Sources" -ErrorAction SilentlyContinue | Format-List | Out-String | Write-Host
Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\ODBC\ODBC.INI\ODBC Data Sources" -ErrorAction SilentlyContinue | Format-List | Out-String | Write-Host

Write-Host ""
Write-Host "=== ODBC Details for ECAS DSNs ===" -ForegroundColor Cyan
@("Ecas2668","Ecas2672","Ecas2673","ECAS2668","ECAS2672","ECAS2673") | ForEach-Object {
    $dsn = $_
    $key32 = "HKLM:\SOFTWARE\ODBC\ODBC.INI\$dsn"
    $key64 = "HKLM:\SOFTWARE\WOW6432Node\ODBC\ODBC.INI\$dsn"
    if (Test-Path $key32) {
        Write-Host ("  [32-bit] $dsn:")
        Get-ItemProperty $key32 | Format-List | Out-String | Write-Host
    }
    if (Test-Path $key64) {
        Write-Host ("  [64-bit] $dsn:")
        Get-ItemProperty $key64 | Format-List | Out-String | Write-Host
    }
}

# Check all .ini files in ECAS directory
Write-Host ""
Write-Host "=== INI/config files in ECAS dir ===" -ForegroundColor Cyan
$ecasDir = "C:\Program Files (x86)\Electricity Customers Accounts System"
Get-ChildItem $ecasDir -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in @('.ini','.cfg','.lic','.key','.dat','.bin') } | ForEach-Object {
    Write-Host ("  " + $_.Name + " | " + $_.Length + " bytes | " + $_.LastWriteTime)
}

# Check shortcut / lnk files that launch ECAS (to see the command line)
Write-Host ""
Write-Host "=== ECAS shortcuts on Desktop/StartMenu ===" -ForegroundColor Cyan
$shell = New-Object -ComObject WScript.Shell
Get-ChildItem "C:\Users\Public\Desktop","C:\ProgramData\Microsoft\Windows\Start Menu\Programs" -Filter "*.lnk" -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "*ECAS*" -or $_.Name -like "*Electric*" } | ForEach-Object {
        $lnk = $shell.CreateShortcut($_.FullName)
        Write-Host ("  " + $_.Name)
        Write-Host ("    Target: " + $lnk.TargetPath)
        Write-Host ("    Args: " + $lnk.Arguments)
    }

# List ECAS Ref folder main contents (non-ExeRef)
Write-Host ""
Write-Host "=== Ref folder files (outside ExeRef) ===" -ForegroundColor Cyan
@("2668_Mrany_NewSabalieah","2672_Mrany_Gholeeil","2673_Mrany_Dohmyah") | ForEach-Object {
    $ref = "C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_" + $_ + "_Ref"
    Write-Host ("  " + $_)
    Get-ChildItem $ref -File -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host ("    " + $_.Name + " | " + $_.Length)
    }
}
