$cn = New-Object System.Data.SqlClient.SqlConnection
$cn.ConnectionString = "Server=.\ECASDEV;Database=Ecas2673;Integrated Security=True;"
$cn.Open()

Write-Host "=== BEFORE FIX ===" -ForegroundColor Yellow

$befCmd = $cn.CreateCommand()
$befCmd.CommandText = "SELECT Cshr_ID, Cshr_Name, Dev_Serl, NewDev_Serl FROM CashierData WHERE Cshr_ID = 9"
$befRdr = $befCmd.ExecuteReader()
if ($befRdr.Read()) {
    Write-Host ("  Cshr=9 Dev_Serl=[" + $befRdr["Dev_Serl"].ToString() + "] NewDev_Serl=[" + $befRdr["NewDev_Serl"].ToString() + "]")
}
$befRdr.Close()

$countBefCmd = $cn.CreateCommand()
$countBefCmd.CommandText = "SELECT COUNT(*) FROM CashierData WHERE ISNULL(Dev_Serl,'') <> ''"
Write-Host ("  Dev_Serl count = " + $countBefCmd.ExecuteScalar().ToString())

$noalBefCmd = $cn.CreateCommand()
$noalBefCmd.CommandText = "SELECT noal FROM DB_And_Sys_Info"
Write-Host ("  noal stored = " + $noalBefCmd.ExecuteScalar().ToString())

# FIX: Promote NewDev_Serl to Dev_Serl for Cshr=9
Write-Host ""
Write-Host "=== APPLYING FIX ===" -ForegroundColor Cyan
Write-Host "  Copying NewDev_Serl -> Dev_Serl for Cshr_ID=9..."

$fixCmd = $cn.CreateCommand()
$fixCmd.CommandText = "UPDATE CashierData SET Dev_Serl = NewDev_Serl WHERE Cshr_ID = 9 AND (Dev_Serl IS NULL OR Dev_Serl = '') AND NewDev_Serl IS NOT NULL AND NewDev_Serl <> ''"
$affected = $fixCmd.ExecuteNonQuery()
Write-Host ("  Rows updated: " + $affected.ToString()) -ForegroundColor Green

Write-Host ""
Write-Host "=== AFTER FIX ===" -ForegroundColor Yellow

$aftCmd = $cn.CreateCommand()
$aftCmd.CommandText = "SELECT Cshr_ID, Cshr_Name, Dev_Serl, NewDev_Serl FROM CashierData WHERE Cshr_ID = 9"
$aftRdr = $aftCmd.ExecuteReader()
if ($aftRdr.Read()) {
    Write-Host ("  Cshr=9 Dev_Serl=[" + $aftRdr["Dev_Serl"].ToString() + "] NewDev_Serl=[" + $aftRdr["NewDev_Serl"].ToString() + "]")
}
$aftRdr.Close()

$countAftCmd = $cn.CreateCommand()
$countAftCmd.CommandText = "SELECT COUNT(*) FROM CashierData WHERE ISNULL(Dev_Serl,'') <> ''"
$newCount = $countAftCmd.ExecuteScalar()
Write-Host ("  Dev_Serl count = " + $newCount.ToString())

$noalAftCmd = $cn.CreateCommand()
$noalAftCmd.CommandText = "SELECT noal FROM DB_And_Sys_Info"
$noalVal = $noalAftCmd.ExecuteScalar()
Write-Host ("  noal stored = " + $noalVal.ToString())

if ($newCount.ToString() -eq $noalVal.ToString()) {
    Write-Host ""
    Write-Host "  ✅ Dev_Serl count now MATCHES noal! Spy detection should be resolved." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "  ⚠ Still mismatch: count=$newCount vs noal=$noalVal" -ForegroundColor Red
}

$cn.Close()
