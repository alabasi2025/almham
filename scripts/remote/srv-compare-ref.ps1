$base = "C:\Program Files (x86)\Electricity Customers Accounts System"
$ref68 = Join-Path $base "ECAS_2668_Mrany_NewSabalieah_Ref"
$ref72 = Join-Path $base "ECAS_2672_Mrany_Gholeeil_Ref"
$ref73 = Join-Path $base "ECAS_2673_Mrany_Dohmyah_Ref"

Write-Host "=== Files in 2668 (reference/working) ==="
Get-ChildItem $ref68 -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($ref68.Length)
    $hash = (Get-FileHash $_.FullName -Algorithm MD5).Hash
    Write-Host ("  " + $rel + " | " + $_.Length + " | " + $_.LastWriteTime.ToString("yyyy-MM-dd") + " | " + $hash)
}

Write-Host ""
Write-Host "=== Differences in 2672 vs 2668 ==="
Get-ChildItem $ref68 -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($ref68.Length)
    $hash68 = (Get-FileHash $_.FullName -Algorithm MD5).Hash
    $file72 = $ref72 + $rel
    if (Test-Path $file72) {
        $hash72 = (Get-FileHash $file72 -Algorithm MD5).Hash
        if ($hash68 -ne $hash72) {
            Write-Host ("  DIFF: " + $rel + " (2668:" + $hash68.Substring(0,8) + "... vs 2672:" + $hash72.Substring(0,8) + "...)")
        }
    } else {
        Write-Host ("  MISSING in 2672: " + $rel)
    }
}

Write-Host ""
Write-Host "=== Differences in 2673 vs 2668 ==="
Get-ChildItem $ref68 -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($ref68.Length)
    $hash68 = (Get-FileHash $_.FullName -Algorithm MD5).Hash
    $file73 = $ref73 + $rel
    if (Test-Path $file73) {
        $hash73 = (Get-FileHash $file73 -Algorithm MD5).Hash
        if ($hash68 -ne $hash73) {
            Write-Host ("  DIFF: " + $rel + " (2668:" + $hash68.Substring(0,8) + "... vs 2673:" + $hash73.Substring(0,8) + "...)")
        }
    } else {
        Write-Host ("  MISSING in 2673: " + $rel)
    }
}
