using System.ComponentModel;

namespace EcasLegacyBilling.Core;

public sealed record ConnectionProfile(
    string Server,
    string UserName,
    string Password,
    bool TrustServerCertificate,
    bool Encrypt);

public sealed record LegacyDatabaseInfo(string Name);

public sealed record DashboardSummary(
    int CustomerCount,
    int ActiveCustomerCount,
    int BillCount,
    int PaymentCount,
    int UserCount,
    decimal TotalCurrentBalance,
    DateTime? LastBillingDate,
    DateTime? LastPaymentDate);

public sealed record LegacyMenuEntry(
    int FormId,
    string FormName,
    string MenuKey,
    int RankId);

public sealed record LegacyUser(
    [property: DisplayName("رقم المستخدم")] int UserId,
    [property: DisplayName("اسم المستخدم")] string UserName,
    [property: DisplayName("رقم الدور")] int RoleId,
    [property: DisplayName("الدور")] string RoleName,
    [property: DisplayName("نطاق العمل")] int WorkKindId);

public sealed record LegacyLoginResult(
    int UserId,
    string UserName,
    int RoleId,
    string RoleName,
    int WorkKindId,
    string DatabaseName);

public sealed record LegacyScreenEvent(
    int EventId,
    string EventName,
    bool IsAllowed);

public sealed record LegacyScreenDefinition(
    int FormId,
    string FormName,
    string MenuKey,
    int RankId,
    int MenuIndex,
    bool HasAnyAccess,
    IReadOnlyList<LegacyScreenEvent> Events);

public sealed record CustomerRecord(
    [property: DisplayName("رقم المشترك")] int CustomerId,
    [property: DisplayName("اسم المشترك")] string CustomerName,
    [property: DisplayName("الحي")] string Neighborhood,
    [property: DisplayName("العنوان")] string Address,
    [property: DisplayName("رقم العداد")] string MeterNumber,
    [property: DisplayName("تسلسل العداد")] string MeterSerial,
    [property: DisplayName("آخر قراءة")] int LastRead,
    [property: DisplayName("الرصيد")] decimal LastBalance,
    [property: DisplayName("الحالة")] int RecordState);

public sealed record BillRecord(
    [property: DisplayName("رقم الفاتورة")] long BillId,
    [property: DisplayName("الفترة")] int PeriodId,
    [property: DisplayName("رقم المشترك")] int CustomerId,
    [property: DisplayName("تاريخ العملية")] DateTime? OperationDate,
    [property: DisplayName("القراءة السابقة")] int LastRead,
    [property: DisplayName("القراءة الحالية")] int CurrentRead,
    [property: DisplayName("الاستهلاك")] int MonthConsume,
    [property: DisplayName("قيمة الاستهلاك")] decimal ConsumeValue,
    [property: DisplayName("الرصيد الحالي")] decimal CurrentBalance,
    [property: DisplayName("المستخدم")] string UserName);

public sealed record PaymentRecord(
    [property: DisplayName("رقم السند")] long PaymentGroupId,
    [property: DisplayName("الفترة")] int PeriodId,
    [property: DisplayName("رقم المشترك")] int CustomerId,
    [property: DisplayName("اسم المشترك")] string CustomerName,
    [property: DisplayName("المبلغ")] decimal Amount,
    [property: DisplayName("تاريخ التسديد")] DateTime? PaymentDate,
    [property: DisplayName("المستخدم")] string UserName,
    [property: DisplayName("نوع التسديد")] int PaymentType,
    [property: DisplayName("المرجع")] string ReferenceId);

public sealed record LegacyWorkspace(
    DashboardSummary Summary,
    IReadOnlyList<LegacyMenuEntry> MenuEntries,
    IReadOnlyList<LegacyUser> Users,
    IReadOnlyList<CustomerRecord> Customers,
    IReadOnlyList<BillRecord> Bills,
    IReadOnlyList<PaymentRecord> Payments);
