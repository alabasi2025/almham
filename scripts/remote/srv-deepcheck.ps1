$dbs = @('Ecas2668','Ecas2672','Ecas2673')
foreach($db in $dbs) {
    $cn = New-Object System.Data.SqlClient.SqlConnection("Server=localhost;Database=$db;Integrated Security=True;")
    $cn.Open()
    Write-Host ""
    Write-Host "========= $db =========" -ForegroundColor Cyan

    # 1. DB_And_Sys_Info full
    $q = $cn.CreateCommand(); $q.CommandText = "SELECT * FROM DB_And_Sys_Info"
    $r = $q.ExecuteReader()
    if($r.Read()) {
        Write-Host "  DB_And_Sys_Info:"
        for($i=0;$i -lt $r.FieldCount;$i++) {
            Write-Host ("    [" + $r.GetName($i) + "] = [" + $r.GetValue($i).ToString() + "]")
        }
    }
    $r.Close()

    # 2. UserData - all users
    $q2 = $cn.CreateCommand(); $q2.CommandText = "SELECT RU_ID, Us_ID, Us_Name, Us_PassWord, Us_UpDateDate FROM UserData ORDER BY RU_ID"
    $r2 = $q2.ExecuteReader()
    Write-Host "  UserData:"
    while($r2.Read()) {
        Write-Host ("    RU=" + $r2["RU_ID"] + " Us_ID=" + $r2["Us_ID"] + " [" + $r2["Us_Name"] + "] Pass=[" + $r2["Us_PassWord"] + "] Date=" + $r2["Us_UpDateDate"])
    }
    $r2.Close()

    # 3. RankUser SFID/SEID vs UserPrivileg sums
    $q3 = $cn.CreateCommand()
    $q3.CommandText = "SELECT r.RU_ID, r.RU_Name, r.SFID, r.SEID, SUM(u.Frm_ID) AS CalcSFID, SUM(u.Evn_ID) AS CalcSEID FROM RankUser r LEFT JOIN UserPrivileg u ON r.RU_ID=u.RU_ID WHERE r.RU_ID>1 GROUP BY r.RU_ID,r.RU_Name,r.SFID,r.SEID"
    $r3 = $q3.ExecuteReader()
    Write-Host "  RankUser SFID/SEID check:"
    while($r3.Read()) {
        $sfOk = if([string]$r3["SFID"] -eq [string]$r3["CalcSFID"]) {"OK"} else {"MISMATCH!"}
        $seOk = if([string]$r3["SEID"] -eq [string]$r3["CalcSEID"]) {"OK"} else {"MISMATCH!"}
        Write-Host ("    RU=" + $r3["RU_ID"] + " [" + $r3["RU_Name"] + "] SFID=" + $r3["SFID"] + " vs " + $r3["CalcSFID"] + " (" + $sfOk + ")  SEID=" + $r3["SEID"] + " vs " + $r3["CalcSEID"] + " (" + $seOk + ")")
    }
    $r3.Close()

    # 4. noal vs Dev_Serl
    $q4 = $cn.CreateCommand(); $q4.CommandText = "SELECT noal FROM DB_And_Sys_Info"
    $noal = $q4.ExecuteScalar()
    $q5 = $cn.CreateCommand(); $q5.CommandText = "SELECT COUNT(*) FROM CashierData WHERE ISNULL(Dev_Serl,'')<>''"
    $cnt = $q5.ExecuteScalar()
    $match = if([string]$noal -eq [string]$cnt) {"MATCH"} else {"MISMATCH noal=$noal vs count=$cnt"}
    Write-Host ("  noal check: " + $match)

    $cn.Close()
}

# 5. Check ExeRef folder esy.exe files
Write-Host ""
Write-Host "========= esy.exe versions =========" -ForegroundColor Yellow
$refs = @(
    "C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_2668_Mrany_NewSabalieah_Ref",
    "C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_2672_Mrany_Gholeeil_Ref",
    "C:\Program Files (x86)\Electricity Customers Accounts System\ECAS_2673_Mrany_Dohmyah_Ref"
)
foreach($ref in $refs) {
    $esy = Join-Path $ref "ExeRef\esy.exe"
    if(Test-Path $esy) {
        $fi = Get-Item $esy
        $md5 = (Get-FileHash $esy -Algorithm MD5).Hash
        Write-Host ("  " + (Split-Path $ref -Leaf) + " -> size=" + $fi.Length + " modified=" + $fi.LastWriteTime.ToString("yyyy-MM-dd") + " md5=" + $md5)
    } else {
        Write-Host ("  " + (Split-Path $ref -Leaf) + " -> esy.exe NOT FOUND")
    }
}
