# نظام الفوترة Web

> مشروع مستقل مخطط لنظام الفوترة الجديد بنفس تقنيات نظام العباسي المتخصص.
> هذا المجلد هو حدّ المشروع المستقل. تم استعادة أول نواة backend داخله، وتم إنشاء واجهة Angular مستقلة خفيفة.

## الهدف

استنساخ وظائف نظام ECAS القديم كمنظومة Web حديثة، مع بقاء مصدر ECAS للقراءة/الاستيراد فقط.

## التقنية المعتمدة

- Frontend: Angular 21 standalone + signals
- Backend: Hono 4 + TypeScript
- ORM: Drizzle
- Database: PostgreSQL
- Auth: JWT + HttpOnly cookies + bcrypt

## حدود المشروع

- هذا المشروع مستقل عن نظام العباسي الرئيسي الموجود في `src/` و `backend/src/`.
- هذا المشروع مستقل عن نظام الفوترة القديم الموجود في `legacy-billing-desktop/`.
- لا يقرأ من SQL Server/ECAS مباشرة في الواجهة؛ القراءة تكون عبر ETL أو backend مخصص.
- لا يستخدم شاشة دخول نظام العباسي الرئيسي.

## الموجود حالياً داخل هذا المجلد

- `backend/`: API مستقل مستعاد من أثر `backend/dist/routes/billing.js`.
- `backend/src/db/schema-billing.ts`: schema الفوترة المستعاد من `backend/dist/db/schema-billing.js`.
- `backend/src/etl/import-screens.ts`: استيراد أكواد وأسماء الشاشات وصلاحياتها من `FormData/Event/FormEvent/RankUser/FormRankUser/UserPrivileg` في ECAS.
- `backend/src/etl/import-customers.ts`: استيراد المشتركين والمراجع الأساسية من CSV إلى PostgreSQL.
- `frontend/`: واجهة Angular مستقلة مبدئية.
- `frontend/src/app/services/legacy-billing.service.ts`: خدمة Angular قديمة كمرجع فقط.
- `frontend/src/app/services/billing-api.service.ts`: خدمة API الجديدة المطابقة لمسارات backend المستعاد.

## حالة قاعدة البيانات المحلية

تم تجهيز قاعدة مستقلة باسم `almham_billing_db` وفيها حالياً:

- 31 جدول فوترة.
- 4 محطات، 171 شاشة مستوردة من `FormData`، 21 عملية شاشة، 15 دور ECAS، 3 سنوات.
- 593 ربط شاشة/عملية، 518 ربط دور/شاشة، 1453 صلاحية دور/شاشة/عملية.
- 8683 مشتركاً مستورداً من ECAS CSV.
- التوزيع الحالي: الدهمية 1775، الصبالية 1894، غليل 2042، صدام 1944، التوفيق 1028.
- محطة جمال موجودة في الهيكل التشغيلي، لكن لا توجد لها قاعدة ECAS مستقلة ضمن النسخ الحالية.
- 1116 مربعاً و65 سجلاً و25 نوع عداد و9 أنواع فاز.

## التشغيل المحلي

Backend:

```powershell
cd D:\almham\billing-web\backend
npm install
npm run build
npm run dev
```

قاعدة البيانات:

```powershell
cd D:\almham\billing-web\backend
npm run db:generate
npm run db:push
npm run db:seed
```

استيراد أكواد الشاشات من ECAS:

```powershell
cd D:\almham\billing-web\backend
npm run etl:import-screens
```

مسارات الشاشات في API:

- `GET /api/billing/screens`
- `GET /api/billing/screens/:code`
- `GET /api/billing/screen-actions`
- `GET /api/billing/screen-roles`

فحص ملفات ECAS CSV المتاحة:

```powershell
cd D:\almham\billing-web\backend
npm run etl:check-csv
```

استيراد المشتركين من ECAS CSV:

```powershell
cd D:\almham\billing-web\backend
npm run etl:import-customers
```

Frontend:

```powershell
cd D:\almham\billing-web\frontend
npm install
npm run build -- --configuration development
npm start
```

الـ backend يستخدم `BILLING_DATABASE_URL` وقيمة port الافتراضية `3100`.

## ما الموجود حالياً خارج هذا المجلد

هذه ملفات آثار/مراجع قبل الفصل الكامل:

- `billing-plan.md`: خطة بناء الفوترة Web.
- `src/app/services/billing.service.ts`: الخدمة القديمة قبل الفصل، تُترك مؤقتاً حتى نتأكد من البديل داخل `billing-web/`.
- `backend/dist/routes/billing.js`: أثر API فوترة مبني سابقاً.
- `backend/dist/db/schema-billing.js`: أثر schema فوترة مبني سابقاً.
- `backend/src/lib/ecas-db.ts` و `backend/src/lib/ecas-csv.ts`: أدوات قراءة ECAS تحتاج نقل/عزل عند الإحياء.

## الخطوة التالية عند العمل عليه

1. بناء صفحة بحث/عرض المشتركين من بيانات PostgreSQL المستوردة.
2. مراجعة المربعات التي تحتاج تحديد محطة.
3. توسيع ETL لاستيراد الفواتير والتسديدات إلى PostgreSQL.
4. توحيد عقد API قبل توسيع خدمة Angular.
5. استبدال الحماية المؤقتة في backend بتسجيل دخول JWT/HttpOnly مستقل.
