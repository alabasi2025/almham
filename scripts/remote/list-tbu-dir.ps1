# List contents of hidden tbu directories
$paths = @(
    'C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_2664_Mrany_Saddam_Ref\tbu',
    'C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_2668_Mrany_NewSabalieah_Ref\tbu',
    'C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_2670_Mrany_ALTofieq_Ref\tbu',
    'C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_2672_Mrany_Gholeeil_Ref\tbu',
    'C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_2673_Mrany_Dohmyah_Ref\tbu'
)

foreach ($p in $paths) {
    Write-Output ""
    Write-Output "=== $p ==="
    Write-Output "Contents:"
    Get-ChildItem $p -Force -EA SilentlyContinue | ForEach-Object {
        Write-Output ("  " + $_.LastWriteTime.ToString('HH:mm:ss') + "  " + $_.Length.ToString().PadLeft(10) + "  " + $_.Name)
    }
}
