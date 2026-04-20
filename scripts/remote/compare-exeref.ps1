# Compare ExeRef folder contents between working and broken DBs
$paths = @(
    'C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_2668_Mrany_NewSabalieah_Ref\ExeRef',
    'C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_2672_Mrany_Gholeeil_Ref\ExeRef',
    'C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_2673_Mrany_Dohmyah_Ref\ExeRef'
)

foreach ($p in $paths) {
    Write-Output ""
    Write-Output "=== $p ==="
    if (Test-Path $p) {
        Get-ChildItem $p -Force -Recurse -EA SilentlyContinue | ForEach-Object {
            Write-Output ("  " + $_.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss') + "  " + $_.Length.ToString().PadLeft(12) + "  " + $_.FullName.Replace($p, ''))
        }
    } else {
        Write-Output "  NOT FOUND"
    }
}
