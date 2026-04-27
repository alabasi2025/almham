using EcasLegacyBilling.Core;
using EcasLegacyBilling.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<EcasSqlGateway>();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy => policy
        .WithOrigins("http://localhost:1420", "http://127.0.0.1:1420", "tauri://localhost")
        .AllowAnyHeader()
        .AllowAnyMethod());
});

builder.WebHost.UseUrls(Environment.GetEnvironmentVariable("ECAS_API_URL") ?? "http://127.0.0.1:5087");

var app = builder.Build();

app.UseCors();

app.MapGet("/health", () => Results.Ok(new { status = "ready", service = "ECAS Legacy Billing API" }));

app.MapPost("/api/ecas/databases", async (
    ConnectionProfileRequest request,
    EcasSqlGateway gateway,
    CancellationToken cancellationToken) =>
{
    try
    {
        var databases = await gateway.GetDatabasesAsync(request.ToProfile(), cancellationToken);
        return Results.Ok(databases);
    }
    catch (Exception ex)
    {
        return Results.Problem(title: "تعذر الاتصال بقواعد ECAS", detail: ex.Message, statusCode: 500);
    }
});

app.MapPost("/api/ecas/workspace", async (
    WorkspaceRequest request,
    EcasSqlGateway gateway,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.DatabaseName))
    {
        return Results.BadRequest(new { error = "اختر قاعدة ECAS أولاً" });
    }

    try
    {
        var workspace = await gateway.LoadWorkspaceAsync(
            request.Connection.ToProfile(),
            request.DatabaseName.Trim(),
            Math.Clamp(request.Take ?? 300, 1, 1000),
            cancellationToken);

        return Results.Ok(workspace);
    }
    catch (Exception ex)
    {
        return Results.Problem(title: "تعذر تحميل بيانات نظام الفوترة القديم", detail: ex.Message, statusCode: 500);
    }
});

app.MapPost("/api/ecas/login", async (
    LoginRequest request,
    EcasSqlGateway gateway,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.DatabaseName))
    {
        return Results.BadRequest(new { error = "اختر قاعدة المحطة أولاً" });
    }

    if (string.IsNullOrWhiteSpace(request.UserName))
    {
        return Results.BadRequest(new { error = "أدخل اسم المستخدم" });
    }

    try
    {
        var login = await gateway.AuthenticateUserAsync(
            request.Connection.ToProfile(),
            request.DatabaseName.Trim(),
            request.UserName.Trim(),
            request.Password ?? string.Empty,
            cancellationToken);

        if (login is null)
        {
            return Results.Json(new { error = "اسم المستخدم أو كلمة المرور غير صحيحة في ECAS" }, statusCode: 401);
        }

        return Results.Ok(login);
    }
    catch (Exception ex)
    {
        return Results.Problem(title: "تعذر تسجيل الدخول إلى نظام ECAS", detail: ex.Message, statusCode: 500);
    }
});

app.MapPost("/api/ecas/screens", async (
    ScreensRequest request,
    EcasSqlGateway gateway,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.DatabaseName))
    {
        return Results.BadRequest(new { error = "اختر قاعدة المحطة أولاً" });
    }

    try
    {
        var screens = await gateway.LoadScreensAsync(
            request.Connection.ToProfile(),
            request.DatabaseName.Trim(),
            request.UserId,
            request.RoleId,
            cancellationToken);

        return Results.Ok(screens);
    }
    catch (Exception ex)
    {
        return Results.Problem(title: "تعذر تحميل شاشة النظام القديمة", detail: ex.Message, statusCode: 500);
    }
});

app.MapPost("/api/ecas/password-hint", async (
    PasswordHintRequest request,
    EcasSqlGateway gateway,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.DatabaseName))
    {
        return Results.BadRequest(new { error = "اختر قاعدة المحطة أولاً" });
    }

    if (string.IsNullOrWhiteSpace(request.UserName))
    {
        return Results.BadRequest(new { error = "أدخل اسم المستخدم أولاً" });
    }

    try
    {
        var hint = await gateway.GetPasswordHintAsync(
            request.Connection.ToProfile(),
            request.DatabaseName.Trim(),
            request.UserName.Trim(),
            cancellationToken);

        return Results.Ok(new { hint = hint ?? string.Empty });
    }
    catch (Exception ex)
    {
        return Results.Problem(title: "تعذر جلب تلميح كلمة المرور", detail: ex.Message, statusCode: 500);
    }
});

app.Run();

public sealed record ConnectionProfileRequest(
    string Server,
    string? UserName,
    string? Password,
    bool TrustServerCertificate = true,
    bool Encrypt = true)
{
    public ConnectionProfile ToProfile() => new(
        string.IsNullOrWhiteSpace(Server) ? @".\ECASDEV" : Server.Trim(),
        UserName?.Trim() ?? string.Empty,
        Password ?? string.Empty,
        TrustServerCertificate,
        Encrypt);
}

public sealed record WorkspaceRequest(
    ConnectionProfileRequest Connection,
    string DatabaseName,
    int? Take);

public sealed record LoginRequest(
    ConnectionProfileRequest Connection,
    string DatabaseName,
    string UserName,
    string? Password);

public sealed record ScreensRequest(
    ConnectionProfileRequest Connection,
    string DatabaseName,
    int UserId,
    int RoleId);

public sealed record PasswordHintRequest(
    ConnectionProfileRequest Connection,
    string DatabaseName,
    string UserName);
