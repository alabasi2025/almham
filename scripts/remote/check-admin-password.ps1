$srv = "100.114.106.110,1433"
$uid = "cascade"
$pass = "Alham@Cascade2026!"

$dbs = @("Ecas2668","Ecas2672","Ecas2673")

foreach ($db in $dbs) {
    $cn = New-Object System.Data.SqlClient.SqlConnection
    $cn.ConnectionString = "Server=$srv;Database=$db;User Id=$uid;Password=$pass;"
    $cn.Open()

    Write-Host ""
    Write-Host "========== $db ==========" -ForegroundColor Cyan

    # 1. كلمة سر Administrator في UserData
    $cmd = $cn.CreateCommand()
    $cmd.CommandText = "SELECT Us_ID, Us_Name, Us_PassWord, Us_UpDateDate FROM UserData WHERE Us_ID <= 3 ORDER BY Us_ID"
    $rdr = $cmd.ExecuteReader()
    Write-Host "--- UserData (Admin users) ---"
    while ($rdr.Read()) {
        $line = "  ID=" + $rdr[0].ToString() + " Name=" + $rdr[1].ToString() + " Pass=" + $rdr[2].ToString() + " Updated=" + $rdr[3].ToString()
        Write-Host $line
    }
    $rdr.Close()

    # 2. فحص CompInfoAndSysOption لأي عمود يشبه كلمة سر أو مفتاح أمان
    $cmd2 = $cn.CreateCommand()
    $cmd2.CommandText = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='CompInfoAndSysOption' AND (COLUMN_NAME LIKE '%Pass%' OR COLUMN_NAME LIKE '%Key%' OR COLUMN_NAME LIKE '%Sec%' OR COLUMN_NAME LIKE '%Hash%' OR COLUMN_NAME LIKE '%Code%' OR COLUMN_NAME LIKE '%Lic%' OR COLUMN_NAME LIKE '%Reg%' OR COLUMN_NAME LIKE '%Serial%' OR COLUMN_NAME LIKE '%Token%' OR COLUMN_NAME LIKE '%Adm%' OR COLUMN_NAME LIKE '%Auth%')"
    $rdr2 = $cmd2.ExecuteReader()
    $secCols = @()
    while ($rdr2.Read()) { $secCols += $rdr2[0].ToString() }
    $rdr2.Close()

    if ($secCols.Count -gt 0) {
        Write-Host ("--- CompInfoAndSysOption security columns: " + ($secCols -join ", ") + " ---")
        $colList = ($secCols | ForEach-Object { "[" + $_ + "]" }) -join ","
        $cmd3 = $cn.CreateCommand()
        $cmd3.CommandText = "SELECT TOP 1 $colList FROM CompInfoAndSysOption"
        $rdr3 = $cmd3.ExecuteReader()
        if ($rdr3.Read()) {
            foreach ($col in $secCols) {
                Write-Host ("  " + $col + " = " + $rdr3[$col].ToString())
            }
        }
        $rdr3.Close()
    } else {
        Write-Host "--- CompInfoAndSysOption: no obvious security columns ---"
    }

    # 3. جميع أعمدة CompInfoAndSysOption مع قيمها للمقارنة
    $cmd4 = $cn.CreateCommand()
    $cmd4.CommandText = "SELECT TOP 1 * FROM CompInfoAndSysOption"
    $rdr4 = $cmd4.ExecuteReader()
    if ($rdr4.Read()) {
        Write-Host "--- CompInfoAndSysOption (ALL non-empty columns) ---"
        for ($i = 0; $i -lt $rdr4.FieldCount; $i++) {
            $val = $rdr4.GetValue($i)
            if (($null -ne $val) -and ($val.ToString().Trim() -ne "")) {
                Write-Host ("  [" + $rdr4.GetName($i) + "] = " + $val.ToString())
            }
        }
    }
    $rdr4.Close()

    $cn.Close()
}
