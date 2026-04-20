$srv = "100.114.106.110,1433"
$uid = "cascade"
$pass = "Alham@Cascade2026!"
$dbs = @("Ecas2668","Ecas2672","Ecas2673")

foreach ($db in $dbs) {
    try {
        $cn = New-Object System.Data.SqlClient.SqlConnection
        $cn.ConnectionString = "Server=$srv;Database=$db;User Id=$uid;Password=$pass;Connect Timeout=10;"
        $cn.Open()
        Write-Host ""
        Write-Host "===== $db (SERVER) =====" -ForegroundColor Cyan

        # noal from DB_And_Sys_Info
        $q1 = $cn.CreateCommand()
        $q1.CommandText = "SELECT noal, adbc, bdbc, DB_PassWord FROM DB_And_Sys_Info"
        $r1 = $q1.ExecuteReader()
        if ($r1.Read()) {
            Write-Host ("  noal=" + $r1["noal"].ToString() + "  adbc=" + $r1["adbc"].ToString() + "  bdbc=" + $r1["bdbc"].ToString())
        }
        $r1.Close()

        # Dev_Serl count
        $q2 = $cn.CreateCommand()
        $q2.CommandText = "SELECT COUNT(*) FROM CashierData WHERE ISNULL(Dev_Serl,'') <> ''"
        $devCount = $q2.ExecuteScalar()
        Write-Host ("  Dev_Serl_Count=" + $devCount.ToString())

        # Cashiers with empty Dev_Serl but filled NewDev_Serl
        $q3 = $cn.CreateCommand()
        $q3.CommandText = "SELECT Cshr_ID, Cshr_Name, Dev_Serl, NewDev_Serl FROM CashierData WHERE (ISNULL(Dev_Serl,'')='') AND ISNULL(NewDev_Serl,'')<>''"
        $r3 = $q3.ExecuteReader()
        $pending = @()
        while ($r3.Read()) {
            $pending += ("    Cshr=" + $r3["Cshr_ID"].ToString() + " [" + $r3["Cshr_Name"].ToString() + "] NewDev=[" + $r3["NewDev_Serl"].ToString() + "]")
        }
        $r3.Close()

        # All cashiers with devices
        $q4 = $cn.CreateCommand()
        $q4.CommandText = "SELECT Cshr_ID, Cshr_Name, Dev_Serl, NewDev_Serl FROM CashierData WHERE ISNULL(Dev_Serl,'')<>'' OR ISNULL(NewDev_Serl,'')<>'' ORDER BY Cshr_ID"
        $r4 = $q4.ExecuteReader()
        Write-Host "  Device registrations:"
        while ($r4.Read()) {
            $dev = $r4["Dev_Serl"].ToString()
            $newdev = $r4["NewDev_Serl"].ToString()
            $flag = if ($dev -eq '') { " *** Dev_Serl EMPTY!" } else { "" }
            Write-Host ("    Cshr=" + $r4["Cshr_ID"].ToString() + " [" + $r4["Cshr_Name"].ToString() + "] Dev=[" + $dev + "] NewDev=[" + $newdev + "]" + $flag) 
        }
        $r4.Close()

        if ($pending.Count -gt 0) {
            Write-Host "  --> Cashiers with empty Dev_Serl but pending NewDev_Serl:" -ForegroundColor Yellow
            $pending | ForEach-Object { Write-Host $_ -ForegroundColor Yellow }
        }

        # UserData admin
        $q5 = $cn.CreateCommand()
        $q5.CommandText = "SELECT Us_ID, Us_Name, Us_PassWord, Us_UpDateDate FROM UserData WHERE RU_ID <= 2 ORDER BY RU_ID"
        $r5 = $q5.ExecuteReader()
        Write-Host "  UserData (admin):"
        while ($r5.Read()) {
            Write-Host ("    Us_ID=" + $r5["Us_ID"].ToString() + " [" + $r5["Us_Name"].ToString() + "] Pass=[" + $r5["Us_PassWord"].ToString() + "] Date=" + $r5["Us_UpDateDate"].ToString())
        }
        $r5.Close()

        $cn.Close()
    } catch {
        Write-Host ("ERROR connecting to $db on server: " + $_.Exception.Message.Substring(0,[Math]::Min(120,$_.Exception.Message.Length))) -ForegroundColor Red
    }
}
