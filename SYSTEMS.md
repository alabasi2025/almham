# خريطة الأنظمة من الكود

> مرجع فصل الأنظمة داخل `D:\almham`.
> هذه الوثيقة مبنية على ملفات الكود الموجودة، لا على الافتراضات.

**آخر تحديث:** 24 أبريل 2026

---

## 1. الخلاصة التنفيذية

الكود الحالي يحتوي على خمسة نطاقات يجب عدم خلطها:

| النطاق | الحالة | أين يظهر في الكود | الحكم |
|--------|--------|-------------------|-------|
| نظام العباسي المتخصص Web ERP | نشط | `src/` + `backend/src/` | المنتج الرئيسي |
| الخزينة والتحصيل | نشط داخل ERP | `src/app/pages/treasury/` + `backend/src/routes/treasury.ts` | وحدة داخل ERP، لا نظام منفصل |
| الفوترة Web بنفس تقنيات العباسي | مفصول مبدئياً | `billing-web/` + آثار قديمة في `src/app/services/billing.service.ts` و`backend/dist` | يحتاج DB وETL وحماية مستقلة قبل الإنتاج |
| الفوترة القديمة Desktop/API/Tauri | منفصل | `legacy-billing-desktop/` | نظام قديم مستقل يقرأ ECAS مباشرة |
| سكربتات ECAS/ETL/forensics | أدوات ومختبر | `backend/scripts/`, `scripts/`, `imports/` | ليست أنظمة إنتاج |

---

## 2. مصدر الحقيقة

مصدر الحقيقة للتشغيل الحالي هو:

- Frontend النشط: `src/`
- Backend النشط: `backend/src/`
- Schema النشط: `backend/src/db/schema.ts`
- Routes النشطة: `backend/src/index.ts`

ليست مصدر حقيقة للتشغيل الحالي:

- `backend/dist/`: ملفات build قديمة/سابقة، مفيدة كأثر لاستعادة كود مفقود فقط.
- `imports/`: مراجع ECAS ونتائج تحليل/استيراد.
- `scripts/` و `backend/scripts/`: أدوات تشغيل وتحليل وليست تطبيقات مستخدم.

---

## 3. نظام العباسي المتخصص Web ERP

**الحالة:** نشط.

**الهدف:** إدارة محطات العباسي المتخصصة: المحطات، الموظفون، المهام، الديزل، الخرائط، الخزينة، ثم بقية موجات ERP.

**الأدلة من الكود:**

- Angular app واحدة في `angular.json`.
- Routes الواجهة في `src/app/app.routes.ts`.
- Backend Hono في `backend/src/index.ts`.
- Schema PostgreSQL في `backend/src/db/schema.ts`.
- Services الواجهة في `src/app/services/`.

**المسارات النشطة في الواجهة:**

- `/login`
- `/dashboard`
- `/stations`
- `/stations/generators`
- `/employees`
- `/tasks`
- `/fuel`
- `/maps`
- `/suppliers/fuel`
- `/treasury`
- `/treasury/collections`
- `/treasury/expenses`
- `/users`

**APIs المركبة فعلياً في Backend:**

- `/api/auth`
- `/api/treasury`
- `/api/users`
- `/api/stations`
- `/api/employees`
- `/api/tasks`
- `/api/reset`
- `/api/fuel`

**ملاحظة مهمة:** لا يوجد حالياً route مركب باسم `/api/billing` في `backend/src/index.ts`، ولا يوجد route واجهة `/billing` في `src/app/app.routes.ts`.

---

## 4. الخزينة والتحصيل

**الحالة:** نشطة داخل نظام العباسي، وليست نظاماً مستقلاً.

**Frontend:**

- `src/app/pages/treasury/treasury.component.*`
- `src/app/pages/treasury/collections/collections.component.*`
- `src/app/pages/treasury/expenses/expenses.component.*`
- `src/app/services/treasury.service.ts`

**Backend:**

- `backend/src/routes/treasury.ts`
- جداول الخزينة في `backend/src/db/schema.ts`:
  - `cashboxes`
  - `cashMovements`
  - `billingSystems`
  - `collections`
  - `cashTransfers`
  - `expenseCategories`
  - `expenses`
  - `dailyClosures`

**تصحيح مصطلح:** جدول `billing_systems` داخل الخزينة لا يعني تطبيق الفوترة الكامل. هو فقط تصنيف مصدر التحصيل مثل ECAS/Hexcell/يدوي/آخر.

---

## 5. الفوترة Web بنفس تقنيات العباسي

**الحالة:** مشروع مستقل مبدئي داخل `billing-web/`، مستعاد جزئياً من آثار build قديمة.

**المجلد المستقل المعتمد:** `billing-web/`

**التقنيات المقصودة حسب `billing-plan.md`:**

- Angular 21 standalone + signals
- Hono 4
- Drizzle 0.38
- PostgreSQL

**الأدلة الموجودة:**

- `billing-plan.md` يصف نظام فوترة Web بـ Angular/Hono/Drizzle/PostgreSQL.
- `src/app/services/billing.service.ts` يحتوي خدمة Angular تستدعي `/api/billing`.
- `backend/dist/routes/billing.js` يحتوي API فوترة Hono مبني سابقاً.
- `backend/dist/db/schema-billing.js` يحتوي schema فوترة واسع باسماء مثل:
  - `billing_stations`
  - `billing_customers`
  - `billing_bills`
  - `billing_payments`
  - `billing_cashiers`
  - `billing_screens`

**ما تم فصله داخل `billing-web/`:**

- `billing-web/backend`: API Hono مستقل.
- `billing-web/backend/src/db/schema-billing.ts`: schema الفوترة.
- `billing-web/backend/src/routes/billing.ts`: route `/api/billing`.
- `billing-web/backend/drizzle`: migration أولي مستقل للفوترة.
- `billing-web/backend/src/db/seed.ts`: seed أولي للمحطات والسنوات فقط.
- `billing-web/backend/src/lib/ecas-csv.ts`: قارئ CSV مستقل لأدوات ETL.
- `billing-web/backend/src/etl/import-screens.ts`: استيراد كتالوج الشاشات وصلاحياتها من `FormData/Event/FormEvent/RankUser/FormRankUser/UserPrivileg` في ECAS.
- `billing-web/backend/src/etl/import-customers.ts`: استيراد مستقل للمشتركين من CSV إلى PostgreSQL.
- `billing-web/frontend`: Angular مستقل مبدئي.

**حالة قاعدة البيانات المحلية في 24 أبريل 2026:**

- قاعدة مستقلة: `almham_billing_db`.
- الجداول: 31 جدول فوترة.
- بيانات الأساس: 4 محطات، 3 سنوات، و171 شاشة مستوردة من `FormData`.
- صلاحيات الشاشات: 21 عملية شاشة، 15 دور ECAS، 593 ربط شاشة/عملية، 518 ربط دور/شاشة، 1453 صلاحية تفصيلية.
- بيانات ECAS المستوردة: 8683 مشتركاً، 1116 مربعاً، 65 سجلاً، 25 نوع عداد، 9 أنواع فاز.
- توزيع المشتركين: الدهمية 1775 من `Ecas2673`، الصبالية 1894 من `Ecas2668`، غليل 2042 من `Ecas2672`، صدام 1944 من `Ecas2664`، التوفيق 1028 من `Ecas2670`.
- محطة جمال موجودة في الهيكل التشغيلي، لكن لا توجد لها قاعدة ECAS مستقلة ضمن النسخ الحالية.

**ما ينقص في source النشط القديم:**

- لا يوجد `backend/src/routes/billing.ts`.
- لا يوجد `backend/src/db/schema-billing.ts`.
- لا يوجد `app.route('/api/billing', ...)` في `backend/src/index.ts`.
- لا توجد صفحات Angular مربوطة بـ `/billing`.
- `BillingService` لا يطابق API الموجود في `backend/dist/routes/billing.js`:
  - الخدمة تطلب `/systems`, `/:code/info`, `/:code/customers`.
  - الـ dist يعرض `/stations`, `/overview/:stationId`, `/customers`, `/payments`, `/cashiers`.

**الحكم:** المشروع صار مفصولاً مبدئياً، ويبني مستقلاً، وله قاعدة PostgreSQL مستقلة وفيها بيانات المشتركين الأساسية. ما زال يحتاج ETL كامل للفواتير والتسديدات، وحماية JWT/HttpOnly مستقلة قبل اعتباره إنتاجياً.

**المكان الصحيح عند الإحياء:**

الخيار المعتمد الآن:

```text
billing-web/
├── frontend/   # Angular 21
└── backend/    # Hono + Drizzle + PostgreSQL
```

الخيار الأكبر لاحقاً:

```text
apps/
├── almham-web/
└── billing-web/
services/
├── almham-api/
└── billing-api/
```

---

## 6. الفوترة القديمة Desktop/API/Tauri

**الحالة:** نظام مستقل عن نظام العباسي.

**المجلد:** `legacy-billing-desktop/`

**المكونات:**

| المكون | المجلد | التقنية | الدور |
|--------|--------|---------|-------|
| Core | `legacy-billing-desktop/src/EcasLegacyBilling.Core/` | .NET | نماذج وطلبات/استجابات |
| Infrastructure | `legacy-billing-desktop/src/EcasLegacyBilling.Infrastructure/` | .NET + SQL Server | قراءة قواعد ECAS |
| API | `legacy-billing-desktop/src/EcasLegacyBilling.Api/` | ASP.NET Core Minimal API | API محلي للواجهة |
| Desktop | `legacy-billing-desktop/src/EcasLegacyBilling.Desktop/` | WinForms | تطبيق سطح مكتب مباشر |
| Tauri UI | `legacy-billing-desktop/tauri-billing/` | React/Vite/Tauri | واجهة حديثة وتغليف Desktop |

**Endpoints API القديمة:**

- `/health`
- `/api/ecas/databases`
- `/api/ecas/workspace`
- `/api/ecas/login`
- `/api/ecas/screens`
- `/api/ecas/password-hint`

**الحدود:**

- هذا النظام يقرأ SQL Server/ECAS مباشرة.
- لا يعتمد على PostgreSQL الخاص بنظام العباسي.
- لا يُخلط مع الفوترة Web الجديدة المبنية بـ Angular/Hono.
- يبقى داخل `legacy-billing-desktop/` حتى لو استُخدم كمرجع.

---

## 7. أدوات ECAS والـ ETL والتحليل

**الحالة:** أدوات ومختبر، ليست منتجات.

**المسارات:**

- `imports/`
- `backend/scripts/`
- `backend/scripts/etl/`
- `scripts/`
- `scripts/remote/`
- `exports/`

**الاستخدام المسموح:**

- قراءة مرجعية أثناء تصميم موجات المشتركين/الفوترة.
- ETL مرة واحدة أو عمليات استيراد مضبوطة.
- تحقيق محلي محدود حسب الاستثناء المذكور في `AGENTS.md`.

**المخاطر:**

- توجد سكربتات تحتوي اتصالات وكلمات مرور/اعتمادات مضمنة. لا تُنقل إلى المنتج ولا تُنشر كما هي.
- بعض السكربتات تخص مسارات جانبية سابقة مثل remote/spying/forensics، ولا تمثل المنتج الحالي.

---

## 8. مشاكل يجب حلها قبل التوسع

1. `/api/billing` غير مركب في source النشط رغم وجود `BillingService` القديم؛ المسار الصحيح الآن هو `billing-web/backend`.
2. عقد `BillingService` لا يطابق API الفوترة الموجود في `backend/dist`.
3. `backend/dist` يحتوي آثار مهمة، لكنه ليس مصدر حقيقة.
4. تم إغلاق routes الأساسية المفتوحة في 24 أبريل 2026 بإضافة `requireAuth` إلى:
   - `stations`
   - `employees`
   - `tasks`
   - `fuel`
5. تم تقييد `/api/reset/seed` بتسجيل الدخول ودور `admin`.
6. تم إضافة rate limiting على `/api/auth/login` في 24 أبريل 2026 بعدد محاولات فاشلة قابل للضبط عبر `.env`.
7. تم استيراد المشتركين إلى قاعدة الفوترة المستقلة، لكن الفواتير والتسديدات التاريخية لم تُستورد بعد.
8. ما يزال مطلوباً استكمال موجة 0.6 بمراجعة الصلاحيات التفصيلية للكتابة والحذف.
9. سكربتات ECAS تحتاج تنظيف أسرار أو عزل قبل أي رفع/توزيع.

---

## 9. قرارات الحدود المعتمدة

1. نظام العباسي المتخصص يبقى في `src/` و `backend/src/`.
2. الخزينة جزء من نظام العباسي، وليست تطبيقاً مستقلاً.
3. الفوترة Web الجديدة تكون مشروعاً مستقلاً في `billing-web/`.
4. الفوترة Web الجديدة لا تُدفن داخل `legacy-billing-desktop/`.
5. الفوترة القديمة ECAS تبقى داخل `legacy-billing-desktop/`.
6. لا نضيف اعتماداً من نظام العباسي على SQL Server/ECAS إلا بقرار موجة واضح.
7. لا نعتمد على `dist` للتطوير، لكن يمكن استخدامه كمرجع لاستعادة source مفقود.
8. لا حذف ولا نقل كبير قبل قرار صريح، خصوصاً في `imports/`, `scripts/`, `legacy-billing-desktop/`.

---

## 10. المسار التالي

الأولوية الفنية الآمنة:

1. استكمال موجة 0.6: مراجعة صلاحيات الكتابة والحذف حسب الدور.
2. في الفوترة Web:
   - بناء صفحات عرض/بحث المشتركين من البيانات المستوردة.
   - مراجعة 247 مربعاً غير محسوم المحطة.
   - توسيع ETL للفواتير والتسديدات والتحصيل.
3. عزل سكربتات ECAS ذات الأسرار في أرشيف واضح قبل أي نشر.

**القرار الافتراضي:** لا نبدأ موجة فوترة جديدة قبل إنهاء أساسيات الحماية، إلا إذا كان فصل الفوترة أولوية تشغيلية عاجلة.
