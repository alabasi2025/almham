# واجهة Tauri + React لنظام الفوترة القديم

هذه الواجهة هي تطبيق سطح مكتب حديث لنظام ECAS القديم.

## التقنية

- React + TypeScript + Vite للواجهة.
- Tauri لغلاف سطح المكتب.
- .NET API محلي للاتصال الآمن بـ SQL Server.
- SQL Server ECAS هو مصدر البيانات الوحيد.

## التشغيل أثناء التطوير

افتح نافذتين PowerShell من داخل `legacy-billing-desktop`.

النافذة الأولى:

```powershell
dotnet run --project .\src\EcasLegacyBilling.Api\EcasLegacyBilling.Api.csproj
```

النافذة الثانية:

```powershell
cd .\tauri-billing
npm install
npm run dev
```

بعدها افتح:

```text
http://127.0.0.1:1420
```

## تشغيل Tauri

يحتاج Tauri إلى Rust/Cargo. إذا كانا مثبتين:

```powershell
cd .\tauri-billing
npm run tauri:dev
```

لإنتاج نسخة تثبيت:

```powershell
npm run tauri:build
```

النسخة المبنية تشغّل API المحلي كـ sidecar تلقائياً. شاشة الدخول تتحقق من جدول `UserData` في قاعدة ECAS المختارة باستخدام `Us_Name` و`Us_PassWord`.
