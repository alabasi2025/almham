$dbs = @("Ecas2664","Ecas2668","Ecas2670","Ecas2673")

foreach ($db in $dbs) {
    $cn = New-Object System.Data.SqlClient.SqlConnection
    $cn.ConnectionString = "Server=.\ECASDEV;Database=$db;Integrated Security=True;"
    $cn.Open()

    Write-Host "" 
    Write-Host "=== $db ===" -ForegroundColor Cyan

    # DB_And_Sys_Info
    $cmd = $cn.CreateCommand()
    $cmd.CommandText = "SELECT adbc,bdbc,noal,DB_PassWord FROM DB_And_Sys_Info"
    $rdr = $cmd.ExecuteReader()
    if ($rdr.Read()) {
        Write-Host ("  adbc=" + $rdr["adbc"].ToString() + "  bdbc=" + $rdr["bdbc"].ToString() + "  noal=" + $rdr["noal"].ToString())
        Write-Host ("  DB_PassWord=[" + $rdr["DB_PassWord"].ToString() + "]")
    }
    $rdr.Close()

    # UserData all users
    $cmd2 = $cn.CreateCommand()
    $cmd2.CommandText = "SELECT RU_ID, Us_ID, Us_Name, Us_PassWord, Us_UpDateDate FROM UserData ORDER BY RU_ID, Us_ID"
    $rdr2 = $cmd2.ExecuteReader()
    Write-Host "  UserData:"
    while ($rdr2.Read()) {
        Write-Host ("    RU=" + $rdr2["RU_ID"].ToString() + " Us_ID=" + $rdr2["Us_ID"].ToString() + " Name=[" + $rdr2["Us_Name"].ToString() + "] Pass=[" + $rdr2["Us_PassWord"].ToString() + "] Date=" + $rdr2["Us_UpDateDate"].ToString())
    }
    $rdr2.Close()

    # Count UserData rows
    $cmd3 = $cn.CreateCommand()
    $cmd3.CommandText = "SELECT COUNT(*) FROM UserData"
    $count = $cmd3.ExecuteScalar()
    Write-Host ("  Total UserData rows: " + $count.ToString())

    $cn.Close()
}
