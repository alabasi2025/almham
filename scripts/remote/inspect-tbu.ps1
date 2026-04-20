# Inspect tbu files in Ref folders
$refs = @('ECAS_2664_Mrany_Saddam_Ref', 'ECAS_2668_Mrany_NewSabalieah_Ref', 'ECAS_2670_Mrany_ALTofieq_Ref', 'ECAS_2672_Mrany_Gholeeil_Ref', 'ECAS_2673_Mrany_Dohmyah_Ref')
$base = 'C:\Program Files (x86)\Electricity Customers Accounts System'

foreach ($r in $refs) {
    $tbuPath = Join-Path $base "$r\tbu"
    if (Test-Path $tbuPath) {
        $fi = Get-Item $tbuPath
        Write-Output "=== $r\tbu ==="
        Write-Output "  Size: $($fi.Length) bytes"
        Write-Output "  Modified: $($fi.LastWriteTime)"
        if ($fi.Length -lt 10000) {
            $bytes = [System.IO.File]::ReadAllBytes($tbuPath)
            $asc = [System.Text.Encoding]::ASCII.GetString($bytes)
            $uni = [System.Text.Encoding]::Unicode.GetString($bytes)
            Write-Output "  First 200 bytes (ASCII): $(if ($bytes.Length -ge 200) { $asc.Substring(0, 200) } else { $asc })"
            Write-Output "  First 50 bytes HEX: $(($bytes[0..49] | ForEach-Object { $_.ToString('X2') }) -join ' ')"
        }
    }
    # Also check ExeRef folder
    $exePath = Join-Path $base "$r\ExeRef"
    if (Test-Path $exePath) {
        Write-Output "--- $r\ExeRef contents ---"
        Get-ChildItem $exePath -Force -EA SilentlyContinue | ForEach-Object {
            Write-Output "  $($_.Name) ($($_.Length) bytes, $($_.LastWriteTime))"
        }
    }
}
