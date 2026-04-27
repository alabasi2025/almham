using System.Globalization;

using EcasLegacyBilling.Core;
using Microsoft.Data.SqlClient;

namespace EcasLegacyBilling.Infrastructure;

public sealed class EcasSqlGateway
{
    public async Task<IReadOnlyList<LegacyDatabaseInfo>> GetDatabasesAsync(
        ConnectionProfile profile,
        CancellationToken cancellationToken)
    {
        await using var connection = new SqlConnection(BuildConnectionString(profile, "master"));
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT name
            FROM sys.databases
            WHERE name LIKE 'Ecas%' AND state_desc = 'ONLINE'
            ORDER BY name;
            """;

        var databases = new List<LegacyDatabaseInfo>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            databases.Add(new LegacyDatabaseInfo(reader.GetString(0)));
        }

        return databases;
    }

    public async Task<LegacyWorkspace> LoadWorkspaceAsync(
        ConnectionProfile profile,
        string databaseName,
        int take,
        CancellationToken cancellationToken)
    {
        await using var connection = new SqlConnection(BuildConnectionString(profile, databaseName));
        await connection.OpenAsync(cancellationToken);

        var summary = await LoadSummaryAsync(connection, cancellationToken);
        var menuEntries = await LoadMenuEntriesAsync(connection, cancellationToken);
        var users = await LoadUsersAsync(connection, cancellationToken);
        var customers = await LoadCustomersAsync(connection, take, cancellationToken);
        var bills = await LoadBillsAsync(connection, take, cancellationToken);
        var payments = await LoadPaymentsAsync(connection, take, cancellationToken);

        return new LegacyWorkspace(summary, menuEntries, users, customers, bills, payments);
    }

    public async Task<LegacyLoginResult?> AuthenticateUserAsync(
        ConnectionProfile profile,
        string databaseName,
        string userName,
        string password,
        CancellationToken cancellationToken)
    {
        await using var connection = new SqlConnection(BuildConnectionString(profile, databaseName));
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT TOP (1) u.Us_ID, u.Us_Name, u.RU_ID, ISNULL(r.RU_Name, '') AS RU_Name, u.RW_ID
            FROM UserData u
            LEFT JOIN RankUser r ON r.RU_ID = u.RU_ID
            WHERE (u.Us_Name = @userName OR CONVERT(varchar(20), u.Us_ID) = @userName)
              AND ISNULL(u.Us_PassWord, '') = @password
              AND (u.Us_ID = -1 OR u.Us_ID > 0)
            ORDER BY u.Us_ID;
            """;
        command.Parameters.AddWithValue("@userName", userName.Trim());
        command.Parameters.AddWithValue("@password", password);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return new LegacyLoginResult(
            ToInt(reader["Us_ID"]),
            ToStringValue(reader["Us_Name"]),
            ToInt(reader["RU_ID"]),
            ToStringValue(reader["RU_Name"]),
            ToInt(reader["RW_ID"]),
            databaseName);
    }

    public async Task<string?> GetPasswordHintAsync(
        ConnectionProfile profile,
        string databaseName,
        string userName,
        CancellationToken cancellationToken)
    {
        await using var connection = new SqlConnection(BuildConnectionString(profile, databaseName));
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT TOP (1) NULLIF(LTRIM(RTRIM(ISNULL(u.Us_PassWordHint, ''))), '') AS HintValue
            FROM UserData u
            WHERE (u.Us_Name = @userName OR CONVERT(varchar(20), u.Us_ID) = @userName)
              AND (u.Us_ID = -1 OR u.Us_ID > 0)
            ORDER BY u.Us_ID;
            """;
        command.Parameters.AddWithValue("@userName", userName.Trim());

        var value = await command.ExecuteScalarAsync(cancellationToken);
        return value == null || value == DBNull.Value ? null : Convert.ToString(value, CultureInfo.CurrentCulture);
    }

    public async Task<IReadOnlyList<LegacyScreenDefinition>> LoadScreensAsync(
        ConnectionProfile profile,
        string databaseName,
        int userId,
        int roleId,
        CancellationToken cancellationToken)
    {
        await using var connection = new SqlConnection(BuildConnectionString(profile, databaseName));
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT
              f.Frm_ID,
              f.Frm_Name,
              ISNULL(f.Frm_MnuName, '') AS Frm_MnuName,
              ISNULL(f.Frm_RankID, 0) AS Frm_RankID,
              ISNULL(f.Frm_MnuIndex, 0) AS Frm_MnuIndex,
              ISNULL(e.Evn_ID, 0) AS Evn_ID,
              ISNULL(e.Evn_Name, '') AS Evn_Name,
              CASE
                WHEN @isAdmin = 1 THEN 1
                WHEN up.RU_ID IS NULL THEN 0
                ELSE 1
              END AS IsAllowed
            FROM FormData f
            LEFT JOIN FormEvent fe ON fe.Frm_ID = f.Frm_ID
            LEFT JOIN Event e ON e.Evn_ID = fe.Evn_ID
            LEFT JOIN UserPrivileg up
              ON up.RU_ID = @roleId AND up.Frm_ID = f.Frm_ID AND up.Evn_ID = fe.Evn_ID
            WHERE f.Frm_ID > 0
            ORDER BY f.Frm_MnuName, f.Frm_MnuIndex, f.Frm_ID, e.Evn_ID;
            """;

        var isAdmin = userId == -1 || roleId <= 1;
        command.Parameters.AddWithValue("@roleId", roleId);
        command.Parameters.AddWithValue("@isAdmin", isAdmin ? 1 : 0);

        var buffers = new Dictionary<int, ScreenBuffer>();

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var formId = ToInt(reader["Frm_ID"]);
            if (!buffers.TryGetValue(formId, out var buffer))
            {
                buffer = new ScreenBuffer(
                    formId,
                    ToStringValue(reader["Frm_Name"]),
                    ToStringValue(reader["Frm_MnuName"]),
                    ToInt(reader["Frm_RankID"]),
                    ToInt(reader["Frm_MnuIndex"]));
                buffers.Add(formId, buffer);
            }

            var eventId = ToInt(reader["Evn_ID"]);
            if (eventId <= 0 || buffer.Events.Any(item => item.EventId == eventId))
            {
                continue;
            }

            buffer.Events.Add(new LegacyScreenEvent(
                eventId,
                ToStringValue(reader["Evn_Name"]),
                ToInt(reader["IsAllowed"]) == 1));
        }

        return buffers
            .Values
            .OrderBy(item => item.MenuKey, StringComparer.OrdinalIgnoreCase)
            .ThenBy(item => item.MenuIndex)
            .ThenBy(item => item.FormId)
            .Select(item => new LegacyScreenDefinition(
                item.FormId,
                item.FormName,
                item.MenuKey,
                item.RankId,
                item.MenuIndex,
                item.Events.Count == 0 || item.Events.Any(eventItem => eventItem.IsAllowed),
                item.Events.OrderBy(eventItem => eventItem.EventId).ToList()))
            .ToList();
    }

    private static string BuildConnectionString(ConnectionProfile profile, string databaseName)
    {
        var builder = new SqlConnectionStringBuilder
        {
            DataSource = profile.Server,
            InitialCatalog = databaseName,
            TrustServerCertificate = profile.TrustServerCertificate,
            ConnectTimeout = 10,
            MultipleActiveResultSets = false,
        };

        builder["Encrypt"] = profile.Encrypt ? "True" : "False";

        if (string.IsNullOrWhiteSpace(profile.UserName))
        {
            builder.IntegratedSecurity = true;
        }
        else
        {
            builder.UserID = profile.UserName;
            builder.Password = profile.Password;
        }

        return builder.ConnectionString;
    }

    private static async Task<DashboardSummary> LoadSummaryAsync(SqlConnection connection, CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT
              (SELECT COUNT(*) FROM Customer) AS CustomerCount,
              (SELECT COUNT(*) FROM Customer WHERE RS_ID = 1) AS ActiveCustomerCount,
              (SELECT COUNT(*) FROM BillAndRaedData) AS BillCount,
              (SELECT COUNT(*) FROM PaymentData) AS PaymentCount,
              (SELECT COUNT(*) FROM UserData WHERE Us_ID = -1 OR Us_ID > 0) AS UserCount,
              (SELECT ISNULL(SUM(Cst_LastBalance), 0) FROM Customer) AS TotalCurrentBalance,
              (SELECT MAX(BRD_OperationDate) FROM BillAndRaedData) AS LastBillingDate,
              (SELECT MAX(Pay_PaymentDate) FROM PaymentData) AS LastPaymentDate;
            """;

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return new DashboardSummary(0, 0, 0, 0, 0, 0, null, null);
        }

        return new DashboardSummary(
            ToInt(reader["CustomerCount"]),
            ToInt(reader["ActiveCustomerCount"]),
            ToInt(reader["BillCount"]),
            ToInt(reader["PaymentCount"]),
            ToInt(reader["UserCount"]),
            ToDecimal(reader["TotalCurrentBalance"]),
            ToNullableDateTime(reader["LastBillingDate"]),
            ToNullableDateTime(reader["LastPaymentDate"]));
    }

    private static async Task<IReadOnlyList<LegacyMenuEntry>> LoadMenuEntriesAsync(
        SqlConnection connection,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT Frm_ID, Frm_Name, Frm_MnuName, Frm_RankID
            FROM FormData
            WHERE Frm_ID > 0
            ORDER BY Frm_MnuName, Frm_ID;
            """;

        var entries = new List<LegacyMenuEntry>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            entries.Add(new LegacyMenuEntry(
                ToInt(reader["Frm_ID"]),
                ToStringValue(reader["Frm_Name"]),
                ToStringValue(reader["Frm_MnuName"]),
                ToInt(reader["Frm_RankID"])));
        }

        return entries;
    }

    private static async Task<IReadOnlyList<LegacyUser>> LoadUsersAsync(
        SqlConnection connection,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT u.Us_ID, u.Us_Name, u.RU_ID, ISNULL(r.RU_Name, '') AS RU_Name, u.RW_ID
            FROM UserData u
            LEFT JOIN RankUser r ON r.RU_ID = u.RU_ID
            WHERE u.Us_ID = -1 OR u.Us_ID > 0
            ORDER BY u.Us_ID;
            """;

        var users = new List<LegacyUser>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            users.Add(new LegacyUser(
                ToInt(reader["Us_ID"]),
                ToStringValue(reader["Us_Name"]),
                ToInt(reader["RU_ID"]),
                ToStringValue(reader["RU_Name"]),
                ToInt(reader["RW_ID"])));
        }

        return users;
    }

    private static async Task<IReadOnlyList<CustomerRecord>> LoadCustomersAsync(
        SqlConnection connection,
        int take,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT TOP (@take)
              Cst_ID, Cst_Name, Cst_Negabor, Cst_Address, Cst_CountNo, Cst_AdNo,
              Cst_LastRead, Cst_LastBalance, RS_ID
            FROM Customer
            ORDER BY Cst_ID;
            """;
        command.Parameters.AddWithValue("@take", take);

        var customers = new List<CustomerRecord>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            customers.Add(new CustomerRecord(
                ToInt(reader["Cst_ID"]),
                ToStringValue(reader["Cst_Name"]),
                ToStringValue(reader["Cst_Negabor"]),
                ToStringValue(reader["Cst_Address"]),
                ToStringValue(reader["Cst_CountNo"]),
                ToStringValue(reader["Cst_AdNo"]),
                ToInt(reader["Cst_LastRead"]),
                ToDecimal(reader["Cst_LastBalance"]),
                ToInt(reader["RS_ID"])));
        }

        return customers;
    }

    private static async Task<IReadOnlyList<BillRecord>> LoadBillsAsync(
        SqlConnection connection,
        int take,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT TOP (@take)
              BRD_ID, Dt_ID, Cst_ID, BRD_OperationDate, BRD_LastRead, BRD_CurrentRead,
              BRD_MonthConsume, BRD_ConsumeValue, BRD_CurrentBallance, User_Name
            FROM BillAndRaedData
            ORDER BY BRD_ID DESC;
            """;
        command.Parameters.AddWithValue("@take", take);

        var bills = new List<BillRecord>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            bills.Add(new BillRecord(
                ToLong(reader["BRD_ID"]),
                ToInt(reader["Dt_ID"]),
                ToInt(reader["Cst_ID"]),
                ToNullableDateTime(reader["BRD_OperationDate"]),
                ToInt(reader["BRD_LastRead"]),
                ToInt(reader["BRD_CurrentRead"]),
                ToInt(reader["BRD_MonthConsume"]),
                ToDecimal(reader["BRD_ConsumeValue"]),
                ToDecimal(reader["BRD_CurrentBallance"]),
                ToStringValue(reader["User_Name"])));
        }

        return bills;
    }

    private static async Task<IReadOnlyList<PaymentRecord>> LoadPaymentsAsync(
        SqlConnection connection,
        int take,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT TOP (@take)
              PG_ID, Dt_ID, Cst_ID, Cst_Name, Pay_Mony, Pay_PaymentDate,
              Pay_UserName, Pay_Type, Pay_RefID
            FROM PaymentData
            ORDER BY PG_ID DESC;
            """;
        command.Parameters.AddWithValue("@take", take);

        var payments = new List<PaymentRecord>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            payments.Add(new PaymentRecord(
                ToLong(reader["PG_ID"]),
                ToInt(reader["Dt_ID"]),
                ToInt(reader["Cst_ID"]),
                ToStringValue(reader["Cst_Name"]),
                ToDecimal(reader["Pay_Mony"]),
                ToNullableDateTime(reader["Pay_PaymentDate"]),
                ToStringValue(reader["Pay_UserName"]),
                ToInt(reader["Pay_Type"]),
                ToStringValue(reader["Pay_RefID"])));
        }

        return payments;
    }

    private static string ToStringValue(object value)
    {
        return value == DBNull.Value ? string.Empty : Convert.ToString(value, CultureInfo.CurrentCulture) ?? string.Empty;
    }

    private static int ToInt(object value)
    {
        return value == DBNull.Value ? 0 : Convert.ToInt32(value, CultureInfo.InvariantCulture);
    }

    private static long ToLong(object value)
    {
        return value == DBNull.Value ? 0L : Convert.ToInt64(value, CultureInfo.InvariantCulture);
    }

    private static decimal ToDecimal(object value)
    {
        return value == DBNull.Value ? 0m : Convert.ToDecimal(value, CultureInfo.InvariantCulture);
    }

    private static DateTime? ToNullableDateTime(object value)
    {
        return value == DBNull.Value ? null : Convert.ToDateTime(value, CultureInfo.InvariantCulture);
    }

    private sealed class ScreenBuffer(
        int formId,
        string formName,
        string menuKey,
        int rankId,
        int menuIndex)
    {
        public int FormId { get; } = formId;
        public string FormName { get; } = formName;
        public string MenuKey { get; } = menuKey;
        public int RankId { get; } = rankId;
        public int MenuIndex { get; } = menuIndex;
        public List<LegacyScreenEvent> Events { get; } = [];
    }
}
