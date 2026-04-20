# Inspect esy.exe in each Ref folder
$refs = @('ECAS_2664_Mrany_Saddam_Ref', 'ECAS_2668_Mrany_NewSabalieah_Ref', 'ECAS_2670_Mrany_ALTofieq_Ref', 'ECAS_2672_Mrany_Gholeeil_Ref', 'ECAS_2673_Mrany_Dohmyah_Ref')
$base = 'C:\Program Files (x86)\Electricity Customers Accounts System'

foreach ($r in $refs) {
    $esy = Join-Path $base "$r\ExeRef\esy.exe"
    if (Test-Path $esy) {
        Write-Output ""
        Write-Output "=== $r\ExeRef\esy.exe ==="
        $fi = Get-Item $esy
        Write-Output "Modified: $($fi.LastWriteTime)"
        Write-Output "Size: $($fi.Length)"

        # Hash
        $hash = (Get-FileHash $esy -Algorithm MD5).Hash
        Write-Output "MD5: $hash"

        # Extract strings from binary
        $bytes = [System.IO.File]::ReadAllBytes($esy)
        $uni = [System.Text.Encoding]::Unicode.GetString($bytes)
        $asc = [System.Text.Encoding]::ASCII.GetString($bytes)

        # Find station-specific strings
        $pattern = '[A-Za-z0-9_\-\.]{6,}'
        $unMatches = [regex]::Matches($uni, $pattern) | Select-Object -First 20
        Write-Output "Sample UNICODE strings:"
        foreach ($m in $unMatches) {
            if ($m.Value.Length -ge 8 -and $m.Value -match '[a-zA-Z]') {
                Write-Output "  $($m.Value)"
            }
        }

        # Find key keywords
        foreach ($kw in @('2664','2668','2670','2672','2673','Saddam','Sabali','Gholeeil','Dohmyah','Tofieq','Mrany','esy_')) {
            if ($uni.Contains($kw) -or $asc.Contains($kw)) {
                Write-Output "  Contains: '$kw'"
            }
        }
    }
}
