$q = @"
-- Create log table in both databases to capture ECAS access
USE Ecas2672;
GO

IF OBJECT_ID('dbo.ECAS_DebugLog', 'U') IS NOT NULL DROP TABLE dbo.ECAS_DebugLog;
CREATE TABLE dbo.ECAS_DebugLog (
    LogID INT IDENTITY PRIMARY KEY,
    LogTime DATETIME DEFAULT GETDATE(),
    TableName VARCHAR(100),
    Action VARCHAR(10),
    OldValues NVARCHAR(MAX),
    NewValues NVARCHAR(MAX),
    AppName VARCHAR(200)
);
GO

-- Trigger on DB_And_Sys_Info for UPDATE
IF OBJECT_ID('dbo.trg_DBInfo_Log', 'TR') IS NOT NULL DROP TRIGGER dbo.trg_DBInfo_Log;
GO
CREATE TRIGGER dbo.trg_DBInfo_Log ON dbo.DB_And_Sys_Info
AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.ECAS_DebugLog (TableName, Action, OldValues, NewValues, AppName)
    SELECT 'DB_And_Sys_Info', 'UPDATE',
        ISNULL((SELECT DB_Name+' | noal='+CAST(noal AS VARCHAR)+' | adbc='+ISNULL(adbc,'') FROM deleted),''),
        ISNULL((SELECT DB_Name+' | noal='+CAST(noal AS VARCHAR)+' | adbc='+ISNULL(adbc,'') FROM inserted),''),
        APP_NAME()
    ;
END
GO

-- Trigger on RankUser for UPDATE
IF OBJECT_ID('dbo.trg_RankUser_Log', 'TR') IS NOT NULL DROP TRIGGER dbo.trg_RankUser_Log;
GO
CREATE TRIGGER dbo.trg_RankUser_Log ON dbo.RankUser
AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.ECAS_DebugLog (TableName, Action, OldValues, NewValues, AppName)
    SELECT 'RankUser', 'UPDATE',
        ISNULL((SELECT CAST(RU_ID AS VARCHAR)+' SFID='+CAST(SFID AS VARCHAR)+' SEID='+CAST(SEID AS VARCHAR) FROM deleted),''),
        ISNULL((SELECT CAST(RU_ID AS VARCHAR)+' SFID='+CAST(SFID AS VARCHAR)+' SEID='+CAST(SEID AS VARCHAR) FROM inserted),''),
        APP_NAME()
    ;
END
GO

-- Trigger on UserData for SELECT (not possible with triggers, use instead of)
-- Let's at least capture UPDATE on UserData
IF OBJECT_ID('dbo.trg_UserData_Log', 'TR') IS NOT NULL DROP TRIGGER dbo.trg_UserData_Log;
GO
CREATE TRIGGER dbo.trg_UserData_Log ON dbo.UserData
AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.ECAS_DebugLog (TableName, Action, OldValues, NewValues, AppName)
    SELECT 'UserData', 'UPDATE',
        ISNULL((SELECT CAST(RU_ID AS VARCHAR)+' '+Us_Name+' PW='+ISNULL(Us_PassWord,'') FROM deleted),''),
        ISNULL((SELECT CAST(RU_ID AS VARCHAR)+' '+Us_Name+' PW='+ISNULL(Us_PassWord,'') FROM inserted),''),
        APP_NAME()
    ;
END
GO

-- Same for Ecas2673
USE Ecas2673;
GO

IF OBJECT_ID('dbo.ECAS_DebugLog', 'U') IS NOT NULL DROP TABLE dbo.ECAS_DebugLog;
CREATE TABLE dbo.ECAS_DebugLog (
    LogID INT IDENTITY PRIMARY KEY,
    LogTime DATETIME DEFAULT GETDATE(),
    TableName VARCHAR(100),
    Action VARCHAR(10),
    OldValues NVARCHAR(MAX),
    NewValues NVARCHAR(MAX),
    AppName VARCHAR(200)
);
GO

CREATE TRIGGER dbo.trg_DBInfo_Log ON dbo.DB_And_Sys_Info
AFTER UPDATE AS
BEGIN SET NOCOUNT ON;
    INSERT INTO dbo.ECAS_DebugLog (TableName, Action, OldValues, NewValues, AppName)
    SELECT 'DB_And_Sys_Info','UPDATE',
        (SELECT DB_Name+' | noal='+CAST(noal AS VARCHAR) FROM deleted),
        (SELECT DB_Name+' | noal='+CAST(noal AS VARCHAR) FROM inserted),
        APP_NAME();
END
GO
CREATE TRIGGER dbo.trg_RankUser_Log ON dbo.RankUser
AFTER UPDATE AS
BEGIN SET NOCOUNT ON;
    INSERT INTO dbo.ECAS_DebugLog (TableName, Action, OldValues, NewValues, AppName)
    SELECT 'RankUser','UPDATE',
        (SELECT CAST(RU_ID AS VARCHAR)+' SFID='+CAST(SFID AS VARCHAR) FROM deleted),
        (SELECT CAST(RU_ID AS VARCHAR)+' SFID='+CAST(SFID AS VARCHAR) FROM inserted),
        APP_NAME();
END
GO

SELECT 'Triggers created on Ecas2672 and Ecas2673 - now try to login and run srv-read-log.ps1';
GO
"@

$q | Out-File "C:\trigger_log.sql" -Encoding UTF8
$taskCmd = 'sqlcmd -S localhost -E -i "C:\trigger_log.sql" -o "C:\trigger_log_out.txt" -W'
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c " + $taskCmd)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Unregister-ScheduledTask -TaskName "EcasTrigger" -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName "EcasTrigger" -Action $action -Principal $principal -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1)) -Force | Out-Null
Start-ScheduledTask -TaskName "EcasTrigger"; Start-Sleep 10
Get-Content "C:\trigger_log_out.txt" -Encoding UTF8 -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "EcasTrigger" -Confirm:$false -ErrorAction SilentlyContinue
