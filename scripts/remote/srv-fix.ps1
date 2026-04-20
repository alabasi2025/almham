$ErrorActionPreference = 'Stop'
$cs2672 = 'Server=localhost;Database=Ecas2672;Integrated Security=True;'
$cs2673 = 'Server=localhost;Database=Ecas2673;Integrated Security=True;'

Write-Host "========== FIX Ecas2672 (Gholeeil) ==========" -ForegroundColor Cyan
try {
    $cn = New-Object System.Data.SqlClient.SqlConnection($cs2672); $cn.Open()
    # Before
    $q = $cn.CreateCommand(); $q.CommandText = "SELECT noal FROM DB_And_Sys_Info"; $noalBefore = $q.ExecuteScalar()
    $q2 = $cn.CreateCommand(); $q2.CommandText = "SELECT COUNT(*) FROM CashierData WHERE ISNULL(Dev_Serl,'')<>''"; $cntBefore = $q2.ExecuteScalar()
    Write-Host ("  BEFORE: noal=" + $noalBefore + " Dev_Serl_Count=" + $cntBefore)

    # Fix: set noal = actual Dev_Serl count (9)
    $fix = $cn.CreateCommand()
    $fix.CommandText = "UPDATE DB_And_Sys_Info SET noal = (SELECT COUNT(*) FROM CashierData WHERE ISNULL(Dev_Serl,'') <> '')"
    $rows = $fix.ExecuteNonQuery()
    Write-Host ("  Fixed noal -> " + $cntBefore.ToString()) -ForegroundColor Green

    # Verify
    $qv = $cn.CreateCommand(); $qv.CommandText = "SELECT noal FROM DB_And_Sys_Info"; $noalAfter = $qv.ExecuteScalar()
    $q2v = $cn.CreateCommand(); $q2v.CommandText = "SELECT COUNT(*) FROM CashierData WHERE ISNULL(Dev_Serl,'')<>''"; $cntAfter = $q2v.ExecuteScalar()
    Write-Host ("  AFTER:  noal=" + $noalAfter + " Dev_Serl_Count=" + $cntAfter)
    if ([string]$noalAfter -eq [string]$cntAfter) {
        Write-Host "  *** Ecas2672 FIXED - Spy detection should be GONE ***" -ForegroundColor Green
    }
    $cn.Close()
} catch { Write-Host ("  ERROR: " + $_.Exception.Message) -ForegroundColor Red }

Write-Host ""
Write-Host "========== FIX Ecas2673 (Dohmyah) ==========" -ForegroundColor Cyan
try {
    $cn = New-Object System.Data.SqlClient.SqlConnection($cs2673); $cn.Open()
    # Before
    $q = $cn.CreateCommand(); $q.CommandText = "SELECT noal FROM DB_And_Sys_Info"; $noalBefore = $q.ExecuteScalar()
    $q2 = $cn.CreateCommand(); $q2.CommandText = "SELECT COUNT(*) FROM CashierData WHERE ISNULL(Dev_Serl,'')<>''"; $cntBefore = $q2.ExecuteScalar()
    Write-Host ("  BEFORE: noal=" + $noalBefore + " Dev_Serl_Count=" + $cntBefore)

    # Fix: promote NewDev_Serl -> Dev_Serl for Cshr=9
    $fix = $cn.CreateCommand()
    $fix.CommandText = "UPDATE CashierData SET Dev_Serl = NewDev_Serl WHERE Cshr_ID = 9 AND ISNULL(Dev_Serl,'') = '' AND ISNULL(NewDev_Serl,'') <> ''"
    $rows = $fix.ExecuteNonQuery()
    Write-Host ("  Fixed Cshr=9: promoted NewDev_Serl -> Dev_Serl (" + $rows + " rows)") -ForegroundColor Green

    # Verify
    $qv = $cn.CreateCommand(); $qv.CommandText = "SELECT noal FROM DB_And_Sys_Info"; $noalAfter = $qv.ExecuteScalar()
    $q2v = $cn.CreateCommand(); $q2v.CommandText = "SELECT COUNT(*) FROM CashierData WHERE ISNULL(Dev_Serl,'')<>''"; $cntAfter = $q2v.ExecuteScalar()
    Write-Host ("  AFTER:  noal=" + $noalAfter + " Dev_Serl_Count=" + $cntAfter)
    if ([string]$noalAfter -eq [string]$cntAfter) {
        Write-Host "  *** Ecas2673 FIXED - Spy detection should be GONE ***" -ForegroundColor Green
    }
    $cn.Close()
} catch { Write-Host ("  ERROR: " + $_.Exception.Message) -ForegroundColor Red }

Write-Host ""
Write-Host "========== FINAL VERIFICATION ==========" -ForegroundColor Yellow
foreach ($db in @('Ecas2668','Ecas2672','Ecas2673')) {
    try {
        $cn = New-Object System.Data.SqlClient.SqlConnection("Server=localhost;Database=$db;Integrated Security=True;")
        $cn.Open()
        $q1 = $cn.CreateCommand(); $q1.CommandText = "SELECT noal FROM DB_And_Sys_Info"; $noal = $q1.ExecuteScalar()
        $q2 = $cn.CreateCommand(); $q2.CommandText = "SELECT COUNT(*) FROM CashierData WHERE ISNULL(Dev_Serl,'')<>''"; $cnt = $q2.ExecuteScalar()
        $status = if([string]$noal -eq [string]$cnt) { "OK - NO SPY" } else { "STILL BROKEN!" }
        Write-Host ("  $db -> noal=$noal  count=$cnt  --> $status")
        $cn.Close()
    } catch { Write-Host ("  $db ERROR: " + $_.Exception.Message) }
}
