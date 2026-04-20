# Take ownership of tbu directories fully and list contents
$refs = @('ECAS_2664_Mrany_Saddam_Ref', 'ECAS_2668_Mrany_NewSabalieah_Ref', 'ECAS_2670_Mrany_ALTofieq_Ref', 'ECAS_2672_Mrany_Gholeeil_Ref', 'ECAS_2673_Mrany_Dohmyah_Ref')
$base = 'C:\Program Files (x86)\Electricity Customers Accounts System'

foreach ($r in $refs) {
    $tbu = Join-Path $base "$r\tbu"
    Write-Output ""
    Write-Output "=== $r\tbu ==="
    if (Test-Path $tbu) {
        # Take ownership recursively
        cmd /c "takeown /F `"$tbu`" /R /D Y" | Out-Null
        cmd /c "icacls `"$tbu`" /grant Administrators:F /T" | Out-Null

        # Now list contents with full access
        cmd /c "dir /A `"$tbu`""
    }
}
