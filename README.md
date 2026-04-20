# أنظمة العباسي المتخصصة

> منصّة ERP متخصصة لإدارة محطات توليد وتوزيع الكهرباء (4 محطات — اليمن).

## التقنيات
- **Frontend:** Angular 21 + Angular Material + Chart.js
- **Backend:** Hono + Drizzle ORM
- **Database:** PostgreSQL

## التشغيل

### 1. تثبيت المتطلبات

```bash
# Frontend
npm install

# Backend
cd backend
npm install
```

### 2. إعداد قاعدة البيانات

```bash
cd backend
cp .env.example .env
# عدّل ملف .env وضع بيانات PostgreSQL الخاصة بك
npm run db:push
```

### 3. تشغيل المشروع

```bash
# Backend (في تيرمنال منفصل)
cd backend
npm run dev

# Frontend (في تيرمنال آخر)
npm start
```

### 4. الروابط
- **Frontend:** http://localhost:4200
- **Backend API:** http://localhost:3000

## هيكل المشروع

```
almham/
├── src/                          # Angular Frontend
│   ├── app/
│   │   ├── components/           # مكونات مشتركة
│   │   │   └── sidebar/          # القائمة الجانبية
│   │   ├── models/               # الموديلات
│   │   │   ├── station.model.ts
│   │   │   ├── employee.model.ts
│   │   │   └── task.model.ts
│   │   ├── pages/                # الصفحات
│   │   │   ├── dashboard/        # لوحة التحكم
│   │   │   ├── stations/         # إدارة المحطات
│   │   │   ├── employees/        # إدارة الموظفين
│   │   │   └── tasks/            # إدارة المهام
│   │   └── services/             # الخدمات
│   │       ├── station.service.ts
│   │       ├── employee.service.ts
│   │       └── task.service.ts
│   ├── index.html
│   ├── main.ts
│   └── styles.scss
├── backend/                      # Hono Backend
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.ts         # جداول قاعدة البيانات
│   │   │   └── index.ts          # اتصال قاعدة البيانات
│   │   ├── routes/
│   │   │   ├── stations.ts       # API المحطات
│   │   │   ├── employees.ts      # API الموظفين
│   │   │   └── tasks.ts          # API المهام
│   │   └── index.ts              # نقطة الدخول
│   └── drizzle.config.ts
├── angular.json
├── package.json
└── README.md
```

## API Endpoints

| Method | Endpoint | الوصف |
|--------|----------|-------|
| GET | /api/stations | جلب كل المحطات |
| POST | /api/stations | إضافة محطة |
| PUT | /api/stations/:id | تعديل محطة |
| DELETE | /api/stations/:id | حذف محطة |
| GET | /api/employees | جلب كل الموظفين |
| POST | /api/employees | إضافة موظف |
| PUT | /api/employees/:id | تعديل موظف |
| DELETE | /api/employees/:id | حذف موظف |
| GET | /api/tasks | جلب كل المهام |
| POST | /api/tasks | إضافة مهمة |
| PUT | /api/tasks/:id | تعديل مهمة |
| DELETE | /api/tasks/:id | حذف مهمة |
