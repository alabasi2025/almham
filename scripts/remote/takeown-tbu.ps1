# Take ownership of tbu files and read them
$paths = @(
    'C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_2668_Mrany_NewSabalieah_Ref\tbu',
    'C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_2672_Mrany_Gholeeil_Ref\tbu',
    'C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_2673_Mrany_Dohmyah_Ref\tbu'
)

foreach ($p in $paths) {
    if (Test-Path $p) {
        Write-Output "=== $p ==="
        # Take ownership and grant full access
        $cmd1 = "takeown /F `"$p`" /A 2>&1"
        $r1 = cmd /c $cmd1
        Write-Output ("TakeOwn: " + ($r1 -join ' | '))
        
        $cmd2 = "icacls `"$p`" /grant Administrators:F 2>&1"
        $r2 = cmd /c $cmd2
        Write-Output ("Grant: " + ($r2 -join ' | '))
        
        try {
            $bytes = [System.IO.File]::ReadAllBytes($p)
            Write-Output ("Size: " + $bytes.Length + " bytes")
            $hex = ($bytes | ForEach-Object { '{0:X2}' -f $_ }) -join ' '
            Write-Output "HEX: $hex"
            $asc = ($bytes | ForEach-Object { if ($_ -ge 32 -and $_ -lt 127) { [char]$_ } else { '.' } }) -join ''
            Write-Output "ASCII: $asc"
        } catch {
            Write-Output ("Read FAIL: " + $_.Exception.Message)
        }
        Write-Output ""
    }
}
