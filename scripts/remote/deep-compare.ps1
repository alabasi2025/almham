# Deep compare: find ANY file that differs between 2668 Ref (works) and 2672 Ref (broken)
$base = 'C:\Program Files (x86)\Electricity Customers Accounts System'
$working = 'ECAS_2668_Mrany_NewSabalieah_Ref'
$broken1 = 'ECAS_2672_Mrany_Gholeeil_Ref'
$broken2 = 'ECAS_2673_Mrany_Dohmyah_Ref'

function Get-FolderSig ($path) {
    $sig = @{}
    Get-ChildItem $path -Recurse -Force -File -EA SilentlyContinue | ForEach-Object {
        $rel = $_.FullName.Replace($path, '')
        try {
            $h = (Get-FileHash $_.FullName -Algorithm MD5 -EA SilentlyContinue).Hash
        } catch { $h = 'ACCESS_DENIED' }
        $sig[$rel] = @{ Size = $_.Length; Hash = $h; Modified = $_.LastWriteTime }
    }
    return $sig
}

Write-Output "=== Computing signatures ==="
$w = Get-FolderSig (Join-Path $base $working)
$b1 = Get-FolderSig (Join-Path $base $broken1)
$b2 = Get-FolderSig (Join-Path $base $broken2)

Write-Output ""
Write-Output "Working 2668 files: $($w.Count)"
Write-Output "Broken 2672 files: $($b1.Count)"
Write-Output "Broken 2673 files: $($b2.Count)"

Write-Output ""
Write-Output "=== Files in 2668 but NOT in 2672 ==="
foreach ($k in $w.Keys) {
    if (-not $b1.ContainsKey($k)) {
        Write-Output "  MISSING in 2672: $k"
    }
}

Write-Output ""
Write-Output "=== Files in 2672 but NOT in 2668 ==="
foreach ($k in $b1.Keys) {
    if (-not $w.ContainsKey($k)) {
        Write-Output "  EXTRA in 2672: $k"
    }
}

Write-Output ""
Write-Output "=== Files with DIFFERENT hash between 2668 and 2672 ==="
foreach ($k in $w.Keys) {
    if ($b1.ContainsKey($k) -and $w[$k].Hash -ne $b1[$k].Hash) {
        Write-Output "  DIFFERENT: $k"
        Write-Output "    2668 : $($w[$k].Size)B, $($w[$k].Hash), $($w[$k].Modified)"
        Write-Output "    2672 : $($b1[$k].Size)B, $($b1[$k].Hash), $($b1[$k].Modified)"
    }
}

Write-Output ""
Write-Output "=== Summary: What EXACTLY differs ==="
Write-Output "2672 vs 2668:"
$diffFiles = @()
foreach ($k in $w.Keys) {
    if ($b1.ContainsKey($k) -and $w[$k].Hash -ne $b1[$k].Hash) { $diffFiles += $k }
}
Write-Output "  $($diffFiles.Count) file(s) differ by hash"
