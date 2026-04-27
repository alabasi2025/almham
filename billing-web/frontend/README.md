# واجهة نظام الفوترة Web

هذا المجلد مخصص لتطبيق Angular المستقل لنظام الفوترة Web.

الحالة الحالية:

- تم إنشاء هيكل Angular مستقل خفيف.
- الصفحة الأولى تعرض المحطات من API المستقل.
- تم نقل خدمة Angular القديمة إلى `src/app/services/legacy-billing.service.ts` كمرجع فقط.
- الخدمة القديمة لا تطابق عقد API المستعاد في `billing-web/backend`، لذلك لا تُستخدم كما هي قبل توحيد المسارات.
- الخدمة النشطة الجديدة هي `src/app/services/billing-api.service.ts`.

التشغيل:

```powershell
cd D:\almham\billing-web\frontend
npm install
npm start
```

الواجهة تعمل افتراضياً على `http://localhost:4200` عند تشغيلها وحدها، وتحوّل `/api` إلى `http://localhost:3100`.

الخطوة التالية:

1. بناء صفحات المشتركين والفترات والتسديدات.
2. توسيع خدمة API الجديدة لتغطي endpoints:
   - `/api/billing/stations`
   - `/api/billing/overview/:stationId`
   - `/api/billing/periods`
   - `/api/billing/customers`
   - `/api/billing/customers/:id`
   - `/api/billing/payments`
   - `/api/billing/cashiers`
   - `/api/billing/reports/periods`
   - `/api/billing/reports/yearly`
   - `/api/billing/screens`
