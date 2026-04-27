# مهمة: إضافة خريطة الشبكة الكهربائية (Network Map)

## السياق
هذا مشروع نظام إدارة كهرباء (Angular 21 + Hono backend + PostgreSQL).
- صفحة الخريطة الحالية (`src/app/pages/maps/`) تعرض المحطات والموردين فقط
- الشبكة الكهربائية فيها: 4 محطات → 55 فيدر → 548 طبلة
- الفيدرات والطبلات موجودة في `backend/src/db/schema.ts` و `backend/src/routes/network.ts`

## المطلوب

### 1. Backend: إضافة حقل مسار الفيدر
- أضف migration جديد يضيف حقل `route_coordinates` من نوع `jsonb` لجدول `feeders`
  - يخزن مصفوفة نقاط: `[[lat, lng], [lat, lng], ...]` تمثل مسار الكابل
- حدّث schema.ts: أضف `routeCoordinates: jsonb('route_coordinates')` لـ feeders table
- حدّث network.ts routes:
  - GET /feeders يرجع routeCoordinates
  - PUT /feeders/:id يقبل routeCoordinates
  - POST /feeders يقبل routeCoordinates

### 2. Frontend Model & Service
- حدّث `src/app/models/network.model.ts`: أضف `routeCoordinates: [number, number][] | null` للـ Feeder interface
- حدّث `src/app/services/network.service.ts`: أضف methods لتحديث الإحداثيات

### 3. Frontend: صفحة خريطة الشبكة الجديدة
أنشئ component جديد `src/app/pages/stations/network-map/` مع:

#### التصميم العام
- نفس style الخريطة الحالية (dark theme, Leaflet, RTL)
- sidebar يسار + خريطة يمين
- الخريطة محددة باليمن (نفس bounds الخريطة الحالية)

#### عرض البيانات على الخريطة
- **المحطات**: markers بلون مميز (بنفسجي) — نفس الأيقونات الحالية
- **الفيدرات**: polylines ملونة — كل محطة بلون مختلف
  - لو الفيدر عنده routeCoordinates → ارسم الخط
  - لو ما عنده → لا تعرض خط
  - popup يعرض: اسم الفيدر، المحطة، عدد الطبلات، الحالة
- **الطبلات**: markers صغيرة دائرية
  - لو عندها lat/lng → اعرضها
  - لو ما عندها → تظهر في قائمة 'بدون موقع' في sidebar
  - popup يعرض: اسم الطبلة، الفيدر، المحطة، النوع
  - لون الطبلة = لون الفيدر المربوط

#### Sidebar
- فلتر حسب المحطة
- toggle layers: محطات / فيدرات / طبلات
- قائمة الفيدرات مع عدد الطبلات
- قائمة الطبلات بدون موقع (unmapped) مع زر لتحديد الموقع
- إحصائيات: عدد المحطات، الفيدرات، الطبلات، نسبة المحددة المواقع

#### وضع التعديل (Edit Mode)
##### تحديد موقع الطبلة
- اختر الطبلة من القائمة أو sidebar → اضغط على الخريطة → يحفظ lat/lng
- نفس pattern الخريطة الحالية (snackbar + click handler)

##### رسم مسار الفيدر (Cable Route Drawing)
- اختر الفيدر → ادخل وضع الرسم
- كل نقرة على الخريطة تضيف نقطة للمسار
- خط مؤقت يظهر أثناء الرسم
- أزرار: حفظ المسار / تراجع عن آخر نقطة / مسح المسار / إلغاء
- بعد الحفظ → يرسل PUT للـ API ويحدث routeCoordinates

### 4. Routing
- أضف route جديد في `app.routes.ts`: `stations/network-map` → NetworkMapComponent

### 5. Navigation
- أضف رابط في sidebar navigation للخريطة الشبكة (بجانب رابط 'الشبكة' الحالي)

## ملفات مهمة للرجوع إليها
- Backend schema: `backend/src/db/schema.ts` (سطر 514 - feeders, سطر 530 - panels)
- Backend routes: `backend/src/routes/network.ts`
- Frontend models: `src/app/models/network.model.ts`
- Frontend service: `src/app/services/network.service.ts`
- Current map page: `src/app/pages/maps/maps.component.ts` (استخدمها كمرجع للـ Leaflet setup)
- Current map styles: `src/app/pages/maps/maps.component.scss` (استخدم نفس الـ design language)
- Network component: `src/app/pages/stations/network/network.component.ts`
- Routes: `src/app/app.routes.ts`
- Drizzle config: `backend/drizzle.config.ts`

## ملاحظات تقنية
- استخدم Angular 21 signals (signal, computed)
- استخدم standalone components
- الـ migration: انشئ ملف SQL في `backend/migrations/` مع اسم مناسب
- الـ Leaflet مثبت: `import * as L from 'leaflet'`
- RTL direction دايماً
- اللغة العربية في كل الـ UI
- ألوان المحطات المقترحة: بنفسجي #8b5cf6، أزرق #3b82f6، أخضر #10b981، برتقالي #f59e0b
- الخريطة الحالية فيها geocoder (Nominatim) وtile styles (streets/dark/satellite) — أعد استخدامها
