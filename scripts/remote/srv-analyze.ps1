$dbs = @('Ecas2668','Ecas2672','Ecas2673')
foreach($db in $dbs) {
    $cn = New-Object System.Data.SqlClient.SqlConnection
    $cn.ConnectionString = 'Server=localhost;Database=' + $db + ';Integrated Security=True;'
    $cn.Open()
    $q1 = $cn.CreateCommand()
    $q1.CommandText = 'SELECT noal FROM DB_And_Sys_Info'
    $noal = $q1.ExecuteScalar()
    $q2 = $cn.CreateCommand()
    $q2.CommandText = "SELECT COUNT(*) FROM CashierData WHERE ISNULL(Dev_Serl,'') <> ''"
    $cnt = $q2.ExecuteScalar()
    $q3 = $cn.CreateCommand()
    $q3.CommandText = "SELECT Cshr_ID, Cshr_Name, Dev_Serl, NewDev_Serl FROM CashierData WHERE ISNULL(Dev_Serl,'')='' AND ISNULL(NewDev_Serl,'')<>'' ORDER BY Cshr_ID"
    $r3 = $q3.ExecuteReader()
    $pending = @()
    while($r3.Read()) { $pending += ('  Cshr=' + $r3['Cshr_ID'] + ' [' + $r3['Cshr_Name'] + '] NewDev=[' + $r3['NewDev_Serl'] + ']') }
    $r3.Close()
    $q4 = $cn.CreateCommand()
    $q4.CommandText = "SELECT Cshr_ID, Cshr_Name, Dev_Serl, NewDev_Serl FROM CashierData WHERE ISNULL(Dev_Serl,'')<>'' OR ISNULL(NewDev_Serl,'')<>'' ORDER BY Cshr_ID"
    $r4 = $q4.ExecuteReader()
    $devList = @()
    while($r4.Read()) {
        $flag = if($r4['Dev_Serl'].ToString() -eq '') { ' <<< Dev_Serl EMPTY' } else { '' }
        $devList += ('  Cshr=' + $r4['Cshr_ID'] + ' [' + $r4['Cshr_Name'] + '] Dev=[' + $r4['Dev_Serl'] + '] NewDev=[' + $r4['NewDev_Serl'] + ']' + $flag)
    }
    $r4.Close()
    $status = if([string]$noal -eq [string]$cnt) { 'MATCH OK' } else { '*** MISMATCH - SPY DETECTION! ***' }
    Write-Host ''
    Write-Host ('=== ' + $db + ' ===')
    Write-Host ('  noal=' + $noal + '  Dev_Serl_Count=' + $cnt + '  --> ' + $status)
    $devList | ForEach-Object { Write-Host $_ }
    if($pending.Count -gt 0) {
        Write-Host '  [FIX AVAILABLE] Cashiers with empty Dev_Serl but pending NewDev_Serl:'
        $pending | ForEach-Object { Write-Host $_ }
    }
    $cn.Close()
}
