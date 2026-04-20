$src = "C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_2668_Mrany_NewSabalieah_Ref\ExeRef\esy.exe"
$targets = @(
    "C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_2672_Mrany_Gholeeil_Ref\ExeRef\esy.exe",
    "C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_2673_Mrany_Dohmyah_Ref\ExeRef\esy.exe"
)

Write-Host "Source esy.exe (2668 - working):"
$srcHash = (Get-FileHash $src -Algorithm MD5).Hash
$srcInfo = Get-Item $src
Write-Host ("  Size=" + $srcInfo.Length + " Date=" + $srcInfo.LastWriteTime.ToString("yyyy-MM-dd") + " MD5=" + $srcHash)
Write-Host ""

foreach ($tgt in $targets) {
    $branch = (Split-Path (Split-Path $tgt -Parent) -Parent | Split-Path -Leaf)
    Write-Host ("Fixing: $branch") -ForegroundColor Cyan

    # Backup original
    $bak = $tgt + ".bak_" + (Get-Date -f "yyyyMMdd_HHmmss")
    try {
        Copy-Item $tgt $bak -Force
        Write-Host ("  Backup created: " + (Split-Path $bak -Leaf))
    } catch {
        Write-Host ("  Could not backup: " + $_.Exception.Message) -ForegroundColor Yellow
    }

    # Take ownership and grant access
    try { takeown /f $tgt /a | Out-Null } catch {}
    try { icacls $tgt /grant "Everyone:F" | Out-Null } catch {}

    # Copy new esy.exe
    try {
        Copy-Item $src $tgt -Force
        $newHash = (Get-FileHash $tgt -Algorithm MD5).Hash
        $newInfo = Get-Item $tgt
        Write-Host ("  Copied OK: Size=" + $newInfo.Length + " Date=" + $newInfo.LastWriteTime.ToString("yyyy-MM-dd") + " MD5=" + $newHash)
        if ($newHash -eq $srcHash) {
            Write-Host ("  Hash matches source - COPY VERIFIED") -ForegroundColor Green
        } else {
            Write-Host ("  WARNING: Hash mismatch!") -ForegroundColor Red
        }
    } catch {
        Write-Host ("  COPY FAILED: " + $_.Exception.Message) -ForegroundColor Red
    }
    Write-Host ""
}
