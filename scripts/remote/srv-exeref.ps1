$refs = @('2668_Mrany_NewSabalieah','2672_Mrany_Gholeeil','2673_Mrany_Dohmyah')
foreach($ref in $refs) {
    $p = "C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_" + $ref + "_Ref\ExeRef"
    Write-Host ("=== " + $ref + " ===")
    Get-ChildItem $p -ErrorAction SilentlyContinue | ForEach-Object {
        $hash = (Get-FileHash $_.FullName -Algorithm MD5 -ErrorAction SilentlyContinue).Hash
        Write-Host ("  " + $_.Name + " | " + $_.Length + " | " + $_.LastWriteTime.ToString("yyyy-MM-dd") + " | " + $hash)
    }
}
