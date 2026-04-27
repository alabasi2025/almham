# تطبيق سطح مكتب لنظام الفوترة القديم ECAS

هذا مشروع منفصل تمامًا عن نظام `almham` المتخصص.

## المصدر الوحيد للبيانات

- قواعد SQL Server القديمة: `Ecas2664`, `Ecas2668`, `Ecas2670`, `Ecas2672`, `Ecas2673`
- نسخ ECAS القديمة الموجودة محلياً داخل `legacy-source/backups/`
- الجداول القديمة كما هي:
  - `Customer`
  - `BillAndRaedData`
  - `PaymentData`
  - `UserData`
  - `RankUser`
  - `FormData`

لا يعتمد هذا المشروع على Angular ولا Hono ولا PostgreSQL ولا أي كود من النظام المتخصص.

راجع `legacy-source/README.md` لمعرفة النسخ التي تم نسخها من سطح المكتب ونتائج فحص القواعد الحالية.

## التشغيل

### WinForms السريع

من داخل هذا المجلد:

```powershell
dotnet run --project .\src\EcasLegacyBilling.Desktop\EcasLegacyBilling.Desktop.csproj
```

داخل النافذة:

1. ضع السيرفر مثل: `.\ECASDEV`
2. ضع المستخدم: `sa`
3. ضع كلمة مرور SQL Server يدويًا
4. اضغط `جلب قواعد ECAS`
5. اختر قاعدة المحطة مثل `Ecas2673`
6. اضغط `فتح قاعدة الفوترة`

### React + Tauri

تم إضافة واجهة حديثة في `tauri-billing/`:

```powershell
dotnet run --project .\src\EcasLegacyBilling.Api\EcasLegacyBilling.Api.csproj
cd .\tauri-billing
npm install
npm run dev
```

ولتشغيلها كتطبيق Tauri كامل يلزم تثبيت Rust/Cargo ثم:

```powershell
npm run tauri:dev
```

النسخة المبنية من Tauri تعرض شاشة تسجيل دخول أولاً. الدخول يتم من جدول `UserData` في قاعدة ECAS المختارة عبر:

- `Us_Name`
- `Us_PassWord`

كما أن تطبيق Tauri يشغّل API المحلي كـ sidecar تلقائياً، فلا تحتاج تشغيل API يدوياً عند تشغيل ملف Tauri المبني.

يمكن بدل إدخال كلمة المرور كل مرة ضبطها مؤقتًا في PowerShell:

```powershell
$env:ECAS_SQL_PASSWORD='ضع_كلمة_المرور_هنا'
dotnet run --project .\src\EcasLegacyBilling.Desktop\EcasLegacyBilling.Desktop.csproj
```

## ماذا يعرض حاليًا

- ملخص المشتركين والفواتير والتسديدات
- القوائم القديمة من جدول `FormData`
- المستخدمون والأدوار من `UserData` و`RankUser`
- آخر 300 مشترك
- آخر 300 فاتورة/قراءة
- آخر 300 عملية تسديد

## الهدف

هذا هو الأساس لتطبيق سطح مكتب بديل يعتمد بالكامل على قاعدة وتفكير نظام الفوترة القديم ECAS.
