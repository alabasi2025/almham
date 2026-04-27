SELECT IS_SRVROLEMEMBER('sysadmin') AS is_sysadmin; EXEC sp_addsrvrolemember 'almham_reader','sysadmin'; SELECT IS_SRVROLEMEMBER('sysadmin') AS is_sysadmin_after;
