# Safely try replacing esy.exe with working version
$base = 'C:\Program Files (x86)\Electricity Customers Accounts System'
$source = Join-Path $base 'ECAS_2668_Mrany_NewSabalieah_Ref\ExeRef\esy.exe'
$targets = @(
    Join-Path $base 'ECAS_2672_Mrany_Gholeeil_Ref\ExeRef\esy.exe',
    Join-Path $base 'ECAS_2673_Mrany_Dohmyah_Ref\ExeRef\esy.exe'
)

Write-Output "Source (working 2668): $source"
Write-Output "Source modified: $((Get-Item $source).LastWriteTime)"
Write-Output ""

foreach ($t in $targets) {
    Write-Output "=== $t ==="

    # Backup original
    $bak = "$t.BAK_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    try {
        Copy-Item $t $bak -Force
        Write-Output "  BACKUP: $bak"
    } catch {
        Write-Output "  BACKUP FAIL: $($_.Exception.Message)"
    }

    # Take ownership before overwrite
    cmd /c "takeown /F `"$t`" /A" | Out-Null
    cmd /c "icacls `"$t`" /grant Administrators:F" | Out-Null

    # Copy new version
    try {
        Copy-Item $source $t -Force
        $newDate = (Get-Item $t).LastWriteTime
        Write-Output "  COPIED: new modified = $newDate"
    } catch {
        Write-Output "  COPY FAIL: $($_.Exception.Message)"
    }
}

Write-Output ""
Write-Output "DONE. Now user should test ECAS login for الدهمية and غليل"
Write-Output "If still broken, restore from .BAK files"
