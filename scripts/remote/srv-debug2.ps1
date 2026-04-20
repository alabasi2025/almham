$ErrorActionPreference = 'Stop'
$dbs = @('Ecas2668','Ecas2672','Ecas2673')
foreach($db in $dbs) {
    Write-Host "--- $db ---"
    try {
        $cn = New-Object System.Data.SqlClient.SqlConnection
        $cn.ConnectionString = 'Server=localhost;Database=' + $db + ';User Id=cascade;Password=Alham@Cascade2026!;Connect Timeout=5;'
        $cn.Open()
        Write-Host "  Connected OK"
        $q1 = $cn.CreateCommand()
        $q1.CommandText = 'SELECT noal FROM DB_And_Sys_Info'
        $noal = $q1.ExecuteScalar()
        Write-Host ("  noal = " + $noal)
        $q2 = $cn.CreateCommand()
        $q2.CommandText = "SELECT COUNT(*) FROM CashierData WHERE ISNULL(Dev_Serl,'') <> ''"
        $cnt = $q2.ExecuteScalar()
        Write-Host ("  Dev_Serl_Count = " + $cnt)
        if ([string]$noal -ne [string]$cnt) {
            Write-Host ("  *** MISMATCH - SPY DETECTION! ***")
            $q3 = $cn.CreateCommand()
            $q3.CommandText = "SELECT Cshr_ID, Cshr_Name, Dev_Serl, NewDev_Serl FROM CashierData WHERE ISNULL(Dev_Serl,'')='' AND ISNULL(NewDev_Serl,'')<>'' ORDER BY Cshr_ID"
            $r3 = $q3.ExecuteReader()
            while($r3.Read()) { Write-Host ("    FIX-CANDIDATE: Cshr=" + $r3['Cshr_ID'] + " [" + $r3['Cshr_Name'] + "] NewDev=[" + $r3['NewDev_Serl'] + "]") }
            $r3.Close()
            $q4 = $cn.CreateCommand()
            $q4.CommandText = "SELECT Cshr_ID, Cshr_Name, Dev_Serl, NewDev_Serl FROM CashierData WHERE ISNULL(Dev_Serl,'')<>'' OR ISNULL(NewDev_Serl,'')<>'' ORDER BY Cshr_ID"
            $r4 = $q4.ExecuteReader()
            while($r4.Read()) {
                $flag = if($r4['Dev_Serl'].ToString() -eq '') { ' *** EMPTY Dev_Serl' } else { '' }
                Write-Host ("    Cshr=" + $r4['Cshr_ID'] + " [" + $r4['Cshr_Name'] + "] Dev=[" + $r4['Dev_Serl'] + "] NewDev=[" + $r4['NewDev_Serl'] + "]" + $flag)
            }
            $r4.Close()
        } else {
            Write-Host "  Match OK - No spy issue"
        }
        $cn.Close()
    } catch {
        Write-Host ("  ERROR: " + $_.Exception.Message)
    }
}
