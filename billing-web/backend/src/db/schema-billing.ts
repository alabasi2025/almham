/**
 * Billing System Schema — استنساخ نظام الفوترة
 *
 * نموذج البيانات يغطي:
 *  - المشتركون والعدّادات
 *  - الفواتير والقراءات
 *  - التسديدات والمحصّلون والسندات اليدوية
 *  - التسويات (8 أنواع)
 *  - البيانات الأساسية (مربعات، سجلات، فروع، مناطق، كشاف، شرائح)
 *  - الفترات الفوترية (ف1، ف2، ف3)
 *  - ربط كل سجل بـ ECAS الأصلي عبر (ecas_db + ecas_id)
 */
import { pgTable, uuid, varchar, integer, bigint, timestamp, pgEnum, boolean, numeric, text, index, uniqueIndex, date, } from 'drizzle-orm/pg-core';
// ============================================================
// ENUMS
// ============================================================
export const billingEcasDbEnum = pgEnum('billing_ecas_db', [
    'Ecas2664', // صدام
    'Ecas2670', // التوفيق
    'Ecas2673', // الدهمية
    'Ecas2668', // الصبالية
    'Ecas2672', // غليل
]);
export const billingCustomerStateEnum = pgEnum('billing_customer_state', [
    'active', // فعّال
    'suspended', // موقوف
    'cancelled', // ملغى
    'pending', // جديد قيد التفعيل
]);
export const billingMeterStateEnum = pgEnum('billing_meter_state', [
    'active',
    'replaced', // مُبدّل
    'removed', // مسحوب
    'faulty', // معطّل
]);
export const billingReadingSourceEnum = pgEnum('billing_reading_source', [
    'manual', // إدخال يدوي
    'mobile', // من الجوال
    'estimated', // تقديري
    'import', // استيراد من ECAS
]);
export const billingPaymentSourceEnum = pgEnum('billing_payment_source', [
    'counter', // شبّاك التحصيل
    'mobile', // جوال (رائد تسديد إلكتروني)
    'wallet', // محفظة إلكترونية
    'bank', // بنك
    'manual', // سند يدوي
    'import', // مستورد من ECAS
]);
export const billingAdjustmentTypeEnum = pgEnum('billing_adjustment_type', [
    'accrual', // تراكم
    'reading_error', // خطأ قراءة
    'activity_error', // خطأ نوع النشاط
    'subscription_fee', // رسوم اشتراك
    'payment_reverse', // عكس تسديد محلي
    'data_correction', // استمارة تعديل حسب الرمز
    'credit_add', // ضم مبلغ مالي
    'credit_deduct', // خصم (عكس قيد مالي)
]);
export const billingPeriodPartEnum = pgEnum('billing_period_part', [
    'f1', // ف1
    'f2', // ف2
    'f3', // ف3 (اختياري في بعض الأشهر)
]);
export const billingDebentureStateEnum = pgEnum('billing_debenture_state', [
    'active',
    'used',
    'lost', // مفقود
    'damaged', // تالف
    'voided', // ملغى
]);
// ============================================================
// STATIONS & ORGANIZATIONAL STRUCTURE
// ============================================================
/** المحطات — 4 محطات (الدهمية، الصبالية، جمال، غليل) */
export const billingStations = pgTable('billing_stations', {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 32 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    ecasDb: billingEcasDbEnum('ecas_db').notNull(),
    companyName: varchar('company_name', { length: 255 }), // اسم الشركة في ECAS
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    ecasDbIdx: index('bs_ecas_db_idx').on(t.ecasDb),
}));
/** المناطق (Area) */
export const billingAreas = pgTable('billing_areas', {
    id: uuid('id').primaryKey().defaultRandom(),
    stationId: uuid('station_id').notNull().references(() => billingStations.id, { onDelete: 'cascade' }),
    ecasId: integer('ecas_id').notNull(),
    ecasDb: billingEcasDbEnum('ecas_db').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    ecasUnq: uniqueIndex('bar_ecas_unq').on(t.ecasDb, t.ecasId),
    stationIdx: index('bar_station_idx').on(t.stationId),
}));
/** الفروع (Branch) */
export const billingBranches = pgTable('billing_branches', {
    id: uuid('id').primaryKey().defaultRandom(),
    stationId: uuid('station_id').notNull().references(() => billingStations.id, { onDelete: 'cascade' }),
    areaId: uuid('area_id').references(() => billingAreas.id, { onDelete: 'set null' }),
    ecasId: integer('ecas_id').notNull(),
    ecasDb: billingEcasDbEnum('ecas_db').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    ecasUnq: uniqueIndex('bbr_ecas_unq').on(t.ecasDb, t.ecasId),
    stationIdx: index('bbr_station_idx').on(t.stationId),
}));
/** السجلات / الحروف (Segel) */
export const billingRegisters = pgTable('billing_registers', {
    id: uuid('id').primaryKey().defaultRandom(),
    stationId: uuid('station_id').notNull().references(() => billingStations.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').references(() => billingBranches.id, { onDelete: 'set null' }),
    ecasId: integer('ecas_id').notNull(),
    ecasDb: billingEcasDbEnum('ecas_db').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    ecasUnq: uniqueIndex('breg_ecas_unq').on(t.ecasDb, t.ecasId),
    stationIdx: index('breg_station_idx').on(t.stationId),
}));
/** المربعات السكنية (Squares) */
export const billingSquares = pgTable('billing_squares', {
    id: uuid('id').primaryKey().defaultRandom(),
    stationId: uuid('station_id').notNull().references(() => billingStations.id, { onDelete: 'cascade' }),
    registerId: uuid('register_id').references(() => billingRegisters.id, { onDelete: 'set null' }),
    ecasId: integer('ecas_id').notNull(),
    ecasDb: billingEcasDbEnum('ecas_db').notNull(),
    name: varchar('name', { length: 500 }).notNull(),
    detectedStation: varchar('detected_station', { length: 32 }),
    needsReview: boolean('needs_review').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    ecasUnq: uniqueIndex('bsq_ecas_unq').on(t.ecasDb, t.ecasId),
    stationIdx: index('bsq_station_idx').on(t.stationId),
    registerIdx: index('bsq_register_idx').on(t.registerId),
}));
/** الكشاف (Tsk) — للبحث */
export const billingFlashlights = pgTable('billing_flashlights', {
    id: uuid('id').primaryKey().defaultRandom(),
    stationId: uuid('station_id').notNull().references(() => billingStations.id, { onDelete: 'cascade' }),
    ecasId: integer('ecas_id').notNull(),
    ecasDb: billingEcasDbEnum('ecas_db').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    ecasUnq: uniqueIndex('bfl_ecas_unq').on(t.ecasDb, t.ecasId),
}));
// ============================================================
// LOOKUPS — التصنيفات والأنواع
// ============================================================
/** أنواع النشاط (منزل، محل، ورشة، ...) */
export const billingActivityTypes = pgTable('billing_activity_types', {
    id: uuid('id').primaryKey().defaultRandom(),
    ecasId: integer('ecas_id').notNull(),
    ecasDb: billingEcasDbEnum('ecas_db').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    ecasUnq: uniqueIndex('bact_ecas_unq').on(t.ecasDb, t.ecasId),
}));
/** أنواع العنوان (AdTp) */
export const billingAddressTypes = pgTable('billing_address_types', {
    id: uuid('id').primaryKey().defaultRandom(),
    ecasId: integer('ecas_id').notNull(),
    ecasDb: billingEcasDbEnum('ecas_db').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    ecasUnq: uniqueIndex('badt_ecas_unq').on(t.ecasDb, t.ecasId),
}));
/** الفاز (1-phase / 3-phase) */
export const billingPhases = pgTable('billing_phases', {
    id: uuid('id').primaryKey().defaultRandom(),
    ecasId: integer('ecas_id').notNull(),
    ecasDb: billingEcasDbEnum('ecas_db').notNull(),
    name: varchar('name', { length: 64 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    ecasUnq: uniqueIndex('bph_ecas_unq').on(t.ecasDb, t.ecasId),
}));
/** شرائح التعرفة (NewSliceDetail) */
export const billingTariffSlices = pgTable('billing_tariff_slices', {
    id: uuid('id').primaryKey().defaultRandom(),
    ecasId: integer('ecas_id').notNull(),
    ecasDb: billingEcasDbEnum('ecas_db').notNull(),
    activityTypeId: uuid('activity_type_id').references(() => billingActivityTypes.id, { onDelete: 'set null' }),
    fromKwh: integer('from_kwh').notNull(),
    toKwh: integer('to_kwh'), // null = ∞
    pricePerKwh: numeric('price_per_kwh', { precision: 12, scale: 2 }).notNull(),
    validFrom: date('valid_from'),
    validTo: date('valid_to'),
    name: varchar('name', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    ecasUnq: uniqueIndex('bts_ecas_unq').on(t.ecasDb, t.ecasId),
    activityIdx: index('bts_activity_idx').on(t.activityTypeId),
}));
// ============================================================
// TIME (سنوات / شهور / فترات)
// ============================================================
/** سنوات العمل */
export const billingYears = pgTable('billing_years', {
    id: uuid('id').primaryKey().defaultRandom(),
    year: integer('year').notNull().unique(),
    isOpen: boolean('is_open').notNull().default(true),
    isClosed: boolean('is_closed').notNull().default(false),
    closedAt: timestamp('closed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
/** شهور العمل */
export const billingMonths = pgTable('billing_months', {
    id: uuid('id').primaryKey().defaultRandom(),
    year: integer('year').notNull(),
    month: integer('month').notNull(), // 1-12
    name: varchar('name', { length: 64 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    yearMonthUnq: uniqueIndex('bm_year_month_unq').on(t.year, t.month),
}));
/** الفترات الفوترية (ف1، ف2، ف3) — أساس كل الفواتير */
export const billingPeriods = pgTable('billing_periods', {
    id: uuid('id').primaryKey().defaultRandom(),
    ecasId: bigint('ecas_id', { mode: 'number' }).notNull(), // 2025091
    ecasDb: billingEcasDbEnum('ecas_db').notNull(),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    part: billingPeriodPartEnum('part').notNull(), // f1/f2/f3
    name: varchar('name', { length: 128 }).notNull(), // سبتمبر/2025م.ف1
    fromDate: date('from_date').notNull(),
    toDate: date('to_date').notNull(),
    isClosed: boolean('is_closed').notNull().default(false),
    isComputed: boolean('is_computed').notNull().default(false),
    isLocked: boolean('is_locked').notNull().default(false),
    allowPayForNextPeriod: boolean('allow_pay_for_next_period').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    ecasUnq: uniqueIndex('bp_ecas_unq').on(t.ecasDb, t.ecasId),
    yearMonthPartIdx: index('bp_year_month_part_idx').on(t.year, t.month, t.part),
}));
// ============================================================
// CUSTOMERS & METERS — المشتركون والعدّادات
// ============================================================
/** المشتركون (Customer) */
export const billingCustomers = pgTable('billing_customers', {
    id: uuid('id').primaryKey().defaultRandom(),
    ecasId: integer('ecas_id').notNull(),
    ecasDb: billingEcasDbEnum('ecas_db').notNull(),
    ecasRefId: integer('ecas_ref_id'), // Cst_RefID
    stationId: uuid('station_id').notNull().references(() => billingStations.id, { onDelete: 'restrict' }),
    squareId: uuid('square_id').references(() => billingSquares.id, { onDelete: 'set null' }),
    registerId: uuid('register_id').references(() => billingRegisters.id, { onDelete: 'set null' }),
    activityTypeId: uuid('activity_type_id').references(() => billingActivityTypes.id, { onDelete: 'set null' }),
    addressTypeId: uuid('address_type_id').references(() => billingAddressTypes.id, { onDelete: 'set null' }),
    phaseId: uuid('phase_id').references(() => billingPhases.id, { onDelete: 'set null' }),
    subscriberCode: varchar('subscriber_code', { length: 64 }).notNull(), // Cst_NewCode
    name: varchar('name', { length: 500 }).notNull(),
    address: varchar('address', { length: 1000 }),
    neighbor: varchar('neighbor', { length: 500 }),
    countNo: varchar('count_no', { length: 64 }), // رقم العدّاد
    adNo: varchar('ad_no', { length: 64 }), // الرقم العام
    adField: varchar('ad_field', { length: 255 }), // تفاصيل العنوان
    adTor: varchar('ad_tor', { length: 255 }), // الطور
    phone: varchar('phone', { length: 64 }),
    beginServiceDate: date('begin_service_date'),
    lastRead: numeric('last_read', { precision: 14, scale: 2 }),
    currentRead: numeric('current_read', { precision: 14, scale: 2 }),
    lastBalance: numeric('last_balance', { precision: 18, scale: 2 }).notNull().default('0'),
    lastArrears: numeric('last_arrears', { precision: 18, scale: 2 }).notNull().default('0'),
    currentBalance: numeric('current_balance', { precision: 18, scale: 2 }).notNull().default('0'),
    state: billingCustomerStateEnum('state').notNull().default('active'),
    recordState: integer('record_state'), // من q_CustomerRecordState_Stc
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
    ecasUnq: uniqueIndex('bc_ecas_unq').on(t.ecasDb, t.ecasId),
    stationIdx: index('bc_station_idx').on(t.stationId),
    squareIdx: index('bc_square_idx').on(t.squareId),
    codeIdx: index('bc_code_idx').on(t.subscriberCode),
    nameIdx: index('bc_name_idx').on(t.name),
}));
/** تاريخ تبديل العدّادات (ChangeCustomerAdad) */
export const billingMeterChanges = pgTable('billing_meter_changes', {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id').notNull().references(() => billingCustomers.id, { onDelete: 'cascade' }),
    ecasId: integer('ecas_id').notNull(),
    ecasDb: billingEcasDbEnum('ecas_db').notNull(),
    oldMeterNo: varchar('old_meter_no', { length: 64 }),
    oldMeterLastRead: numeric('old_meter_last_read', { precision: 14, scale: 2 }),
    newMeterNo: varchar('new_meter_no', { length: 64 }),
    newMeterStartRead: numeric('new_meter_start_read', { precision: 14, scale: 2 }),
    reason: text('reason'),
    changedAt: timestamp('changed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    customerIdx: index('bmc_customer_idx').on(t.customerId),
    ecasUnq: uniqueIndex('bmc_ecas_unq').on(t.ecasDb, t.ecasId),
}));
/** سجل تحديث بيانات المشترك (CustomerUpdateDate) */
export const billingCustomerUpdates = pgTable('billing_customer_updates', {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id').notNull().references(() => billingCustomers.id, { onDelete: 'cascade' }),
    ecasId: integer('ecas_id'),
    ecasDb: billingEcasDbEnum('ecas_db').notNull(),
    field: varchar('field', { length: 128 }),
    oldValue: text('old_value'),
    newValue: text('new_value'),
    updatedAt: timestamp('updated_at'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    customerIdx: index('bcu_customer_idx').on(t.customerId),
}));
// ============================================================
// BILLS & READINGS — الفواتير والقراءات
// ============================================================
/**
 * الفواتير (BillAndRaedDataHistorical + BARD_RaedHistorical مدموجتين في سجل واحد)
 * كل سطر = فاتورة مشترك في فترة معيّنة
 */
export const billingBills = pgTable('billing_bills', {
    id: uuid('id').primaryKey().defaultRandom(),
    ecasDtId: bigint('ecas_dt_id', { mode: 'number' }).notNull(), // رقم الفترة ECAS
    ecasDb: billingEcasDbEnum('ecas_db').notNull(),
    periodId: uuid('period_id').notNull().references(() => billingPeriods.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id').notNull().references(() => billingCustomers.id, { onDelete: 'cascade' }),
    stationId: uuid('station_id').notNull().references(() => billingStations.id),
    squareId: uuid('square_id').references(() => billingSquares.id, { onDelete: 'set null' }),
    // القراءات
    previousRead: numeric('previous_read', { precision: 14, scale: 2 }),
    currentRead: numeric('current_read', { precision: 14, scale: 2 }),
    monthConsume: integer('month_consume').notNull().default(0), // كيلوواط
    consumeValue: numeric('consume_value', { precision: 14, scale: 2 }), // kWh
    dailyConstConsume: numeric('daily_const_consume', { precision: 14, scale: 2 }),
    // الأسعار
    consumePrice: numeric('consume_price', { precision: 18, scale: 2 }).notNull().default('0'),
    consumeAddedPrice: numeric('consume_added_price', { precision: 18, scale: 2 }).notNull().default('0'),
    consumeOfficialPrice: numeric('consume_official_price', { precision: 18, scale: 2 }).notNull().default('0'),
    consumeExemptPrice: numeric('consume_exempt_price', { precision: 18, scale: 2 }).notNull().default('0'),
    // المتأخرات والرصيد
    lastBalance: numeric('last_balance', { precision: 18, scale: 2 }).notNull().default('0'),
    lastArrears: numeric('last_arrears', { precision: 18, scale: 2 }).notNull().default('0'),
    arrears: numeric('arrears', { precision: 18, scale: 2 }).notNull().default('0'),
    // التسديدات المرتبطة (من ECAS)
    paymentCount: integer('payment_count').notNull().default(0),
    paymentSumMoney: numeric('payment_sum_money', { precision: 18, scale: 2 }).notNull().default('0'),
    countZeroRead: integer('count_zero_read').notNull().default(0),
    countZeroPayment: integer('count_zero_payment').notNull().default(0),
    // القراءة
    readingSource: billingReadingSourceEnum('reading_source').notNull().default('import'),
    readingEmployeeId: uuid('reading_employee_id'), // ribط لاحقاً بـ users
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    ecasUnq: uniqueIndex('bb_ecas_unq').on(t.ecasDb, t.ecasDtId, t.customerId),
    periodIdx: index('bb_period_idx').on(t.periodId),
    customerIdx: index('bb_customer_idx').on(t.customerId),
    stationIdx: index('bb_station_idx').on(t.stationId),
}));
// ============================================================
// PAYMENTS — التسديدات
// ============================================================
/** المحصّلون (CashierData) */
export const billingCashiers = pgTable('billing_cashiers', {
    id: uuid('id').primaryKey().defaultRandom(),
    ecasId: integer('ecas_id').notNull(),
    ecasDb: billingEcasDbEnum('ecas_db').notNull(),
    stationId: uuid('station_id').notNull().references(() => billingStations.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 64 }),
    isElectronic: boolean('is_electronic').notNull().default(false), // رائد تسديد إلكتروني
    isActive: boolean('is_active').notNull().default(true),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    ecasUnq: uniqueIndex('bcsh_ecas_unq').on(t.ecasDb, t.ecasId),
    stationIdx: index('bcsh_station_idx').on(t.stationId),
    nameIdx: index('bcsh_name_idx').on(t.name),
}));
/** دفاتر السندات اليدوية (ManualDbnsBooks) */
export const billingCashierBooks = pgTable('billing_cashier_books', {
    id: uuid('id').primaryKey().defaultRandom(),
    ecasId: integer('ecas_id').notNull(),
    ecasDb: billingEcasDbEnum('ecas_db').notNull(),
    cashierId: uuid('cashier_id').references(() => billingCashiers.id, { onDelete: 'set null' }),
    bookNo: varchar('book_no', { length: 64 }).notNull(),
    fromSerial: integer('from_serial'),
    toSerial: integer('to_serial'),
    issuedAt: timestamp('issued_at'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    ecasUnq: uniqueIndex('bcb_ecas_unq').on(t.ecasDb, t.ecasId),
    cashierIdx: index('bcb_cashier_idx').on(t.cashierId),
}));
/** السندات اليدوية (ManualDebenturesInfo) */
export const billingManualDebentures = pgTable('billing_manual_debentures', {
    id: uuid('id').primaryKey().defaultRandom(),
    ecasId: integer('ecas_id').notNull(),
    ecasDb: billingEcasDbEnum('ecas_db').notNull(),
    bookId: uuid('book_id').references(() => billingCashierBooks.id, { onDelete: 'set null' }),
    serialNo: integer('serial_no').notNull(),
    state: billingDebentureStateEnum('state').notNull().default('active'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    ecasUnq: uniqueIndex('bmd_ecas_unq').on(t.ecasDb, t.ecasId),
    bookIdx: index('bmd_book_idx').on(t.bookId),
}));
/** مجموعات التسديد (PaymentGroupHst) */
export const billingPaymentGroups = pgTable('billing_payment_groups', {
    id: uuid('id').primaryKey().defaultRandom(),
    ecasId: bigint('ecas_id', { mode: 'number' }).notNull(),
    ecasDb: billingEcasDbEnum('ecas_db').notNull(),
    periodId: uuid('period_id').references(() => billingPeriods.id, { onDelete: 'set null' }),
    cashierId: uuid('cashier_id').references(() => billingCashiers.id, { onDelete: 'set null' }),
    paymentsCount: integer('payments_count').notNull().default(0),
    totalMoney: numeric('total_money', { precision: 18, scale: 2 }).notNull().default('0'),
    startedAt: timestamp('started_at'),
    closedAt: timestamp('closed_at'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    ecasUnq: uniqueIndex('bpg_ecas_unq').on(t.ecasDb, t.ecasId),
    periodIdx: index('bpg_period_idx').on(t.periodId),
    cashierIdx: index('bpg_cashier_idx').on(t.cashierId),
}));
/** التسديدات (PaymentDataHistorical + PaymentWebHst) */
export const billingPayments = pgTable('billing_payments', {
    id: uuid('id').primaryKey().defaultRandom(),
    ecasId: bigint('ecas_id', { mode: 'number' }).notNull(),
    ecasDb: billingEcasDbEnum('ecas_db').notNull(),
    periodId: uuid('period_id').notNull().references(() => billingPeriods.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id').notNull().references(() => billingCustomers.id, { onDelete: 'cascade' }),
    stationId: uuid('station_id').notNull().references(() => billingStations.id),
    cashierId: uuid('cashier_id').references(() => billingCashiers.id, { onDelete: 'set null' }),
    paymentGroupId: uuid('payment_group_id').references(() => billingPaymentGroups.id, { onDelete: 'set null' }),
    debentureId: uuid('debenture_id').references(() => billingManualDebentures.id, { onDelete: 'set null' }),
    amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
    source: billingPaymentSourceEnum('source').notNull().default('import'),
    receiptNo: varchar('receipt_no', { length: 128 }),
    walletProvider: varchar('wallet_provider', { length: 64 }),
    walletRef: varchar('wallet_ref', { length: 128 }),
    paidAt: timestamp('paid_at').notNull(),
    reversedAt: timestamp('reversed_at'),
    reversedBy: uuid('reversed_by'),
    reversalReason: text('reversal_reason'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    ecasUnq: uniqueIndex('bpay_ecas_unq').on(t.ecasDb, t.ecasId),
    periodIdx: index('bpay_period_idx').on(t.periodId),
    customerIdx: index('bpay_customer_idx').on(t.customerId),
    cashierIdx: index('bpay_cashier_idx').on(t.cashierId),
    paidAtIdx: index('bpay_paid_at_idx').on(t.paidAt),
    stationIdx: index('bpay_station_idx').on(t.stationId),
}));
// ============================================================
// ADJUSTMENTS — التسويات (8 أنواع)
// ============================================================
/** التسويات (TswBasicData) */
export const billingAdjustments = pgTable('billing_adjustments', {
    id: uuid('id').primaryKey().defaultRandom(),
    ecasId: bigint('ecas_id', { mode: 'number' }),
    ecasDb: billingEcasDbEnum('ecas_db').notNull(),
    periodId: uuid('period_id').notNull().references(() => billingPeriods.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id').notNull().references(() => billingCustomers.id, { onDelete: 'cascade' }),
    stationId: uuid('station_id').notNull().references(() => billingStations.id),
    type: billingAdjustmentTypeEnum('type').notNull(),
    adjustmentValue: numeric('adjustment_value', { precision: 18, scale: 2 }).notNull(), // TwBd_TaswihValue
    totalValue: numeric('total_value', { precision: 18, scale: 2 }).notNull().default('0'), // TwBd_TotalTaswihValue
    officialPrice: numeric('official_price', { precision: 18, scale: 2 }).notNull().default('0'),
    exemptPrice: numeric('exempt_price', { precision: 18, scale: 2 }).notNull().default('0'),
    // تفاصيل حسب النوع
    errorValue: numeric('error_value', { precision: 18, scale: 2 }),
    correctValue: numeric('correct_value', { precision: 18, scale: 2 }),
    errorDate: date('error_date'),
    reason: text('reason'),
    notes: text('notes'),
    appliedAt: timestamp('applied_at'),
    updatedAt: timestamp('updated_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    periodIdx: index('badj_period_idx').on(t.periodId),
    customerIdx: index('badj_customer_idx').on(t.customerId),
    typeIdx: index('badj_type_idx').on(t.type),
    stationIdx: index('badj_station_idx').on(t.stationId),
}));
// ============================================================
// SUMMARIES — الخلاصات الشهرية
// ============================================================
/** ملخّص الفترة لكل محطة (SummaryMonthData) */
export const billingPeriodSummary = pgTable('billing_period_summary', {
    id: uuid('id').primaryKey().defaultRandom(),
    periodId: uuid('period_id').notNull().references(() => billingPeriods.id, { onDelete: 'cascade' }),
    stationId: uuid('station_id').notNull().references(() => billingStations.id, { onDelete: 'cascade' }),
    billsCount: integer('bills_count').notNull().default(0),
    totalKwh: bigint('total_kwh', { mode: 'number' }).notNull().default(0),
    totalSales: numeric('total_sales', { precision: 20, scale: 2 }).notNull().default('0'),
    paymentsCount: integer('payments_count').notNull().default(0),
    totalCollected: numeric('total_collected', { precision: 20, scale: 2 }).notNull().default('0'),
    totalAdjustments: numeric('total_adjustments', { precision: 20, scale: 2 }).notNull().default('0'),
    totalArrears: numeric('total_arrears', { precision: 20, scale: 2 }).notNull().default('0'),
    computedAt: timestamp('computed_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    periodStationUnq: uniqueIndex('bps_period_station_unq').on(t.periodId, t.stationId),
}));
// ============================================================
// ETL — سجل استيراد ECAS
// ============================================================
/** سجلّ استيرادات ETL من SQL Server */
export const billingImportRuns = pgTable('billing_import_runs', {
    id: uuid('id').primaryKey().defaultRandom(),
    ecasDb: billingEcasDbEnum('ecas_db').notNull(),
    tableName: varchar('table_name', { length: 128 }).notNull(),
    rowsRead: integer('rows_read').notNull().default(0),
    rowsInserted: integer('rows_inserted').notNull().default(0),
    rowsUpdated: integer('rows_updated').notNull().default(0),
    rowsSkipped: integer('rows_skipped').notNull().default(0),
    rowsFailed: integer('rows_failed').notNull().default(0),
    errorLog: text('error_log'),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    finishedAt: timestamp('finished_at'),
    durationMs: integer('duration_ms'),
}, (t) => ({
    tableIdx: index('bir_table_idx').on(t.tableName),
    startedAtIdx: index('bir_started_at_idx').on(t.startedAt),
}));
// ============================================================
// SCREEN PERMISSIONS — صلاحيات شاشات ECAS (174 شاشة)
// ============================================================
/** فهرس شاشات النظام (من ecas-forms.txt) */
export const billingScreens = pgTable('billing_screens', {
    id: uuid('id').primaryKey().defaultRandom(),
    code: integer('code').notNull().unique(), // 9010, 7101, 4101, ...
    name: varchar('name', { length: 500 }).notNull(),
    menuKey: varchar('menu_key', { length: 64 }),
    menuIndex: integer('menu_index'),
    rankId: integer('rank_id').notNull().default(1),
    routePath: varchar('route_path', { length: 255 }),
    isImplemented: boolean('is_implemented').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    menuIdx: index('bscr_menu_idx').on(t.menuKey, t.menuIndex),
}));

/** عمليات الشاشات كما هي في جدول Event داخل ECAS */
export const billingScreenActions = pgTable('billing_screen_actions', {
    id: uuid('id').primaryKey().defaultRandom(),
    code: integer('code').notNull().unique(),
    name: varchar('name', { length: 120 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

/** العمليات المتاحة لكل شاشة كما هي في FormEvent */
export const billingScreenActionLinks = pgTable('billing_screen_action_links', {
    id: uuid('id').primaryKey().defaultRandom(),
    screenId: uuid('screen_id').notNull().references(() => billingScreens.id, { onDelete: 'cascade' }),
    actionId: uuid('action_id').notNull().references(() => billingScreenActions.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    screenActionUnq: uniqueIndex('bsal_screen_action_unq').on(t.screenId, t.actionId),
    screenIdx: index('bsal_screen_idx').on(t.screenId),
    actionIdx: index('bsal_action_idx').on(t.actionId),
}));

/** أدوار ECAS كما هي في RankUser */
export const billingScreenRoles = pgTable('billing_screen_roles', {
    id: uuid('id').primaryKey().defaultRandom(),
    code: integer('code').notNull().unique(),
    name: varchar('name', { length: 120 }).notNull(),
    startFormId: integer('start_form_id'),
    startEventId: integer('start_event_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

/** الشاشات المسموحة لكل دور كما هي في FormRankUser */
export const billingScreenRoleLinks = pgTable('billing_screen_role_links', {
    id: uuid('id').primaryKey().defaultRandom(),
    roleId: uuid('role_id').notNull().references(() => billingScreenRoles.id, { onDelete: 'cascade' }),
    screenId: uuid('screen_id').notNull().references(() => billingScreens.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    roleScreenUnq: uniqueIndex('bsrl_role_screen_unq').on(t.roleId, t.screenId),
    roleIdx: index('bsrl_role_idx').on(t.roleId),
    screenIdx: index('bsrl_screen_idx').on(t.screenId),
}));

/** صلاحيات الدور التفصيلية حسب الشاشة والعملية كما هي في UserPrivileg */
export const billingScreenRolePermissions = pgTable('billing_screen_role_permissions', {
    id: uuid('id').primaryKey().defaultRandom(),
    roleId: uuid('role_id').notNull().references(() => billingScreenRoles.id, { onDelete: 'cascade' }),
    screenId: uuid('screen_id').notNull().references(() => billingScreens.id, { onDelete: 'cascade' }),
    actionId: uuid('action_id').notNull().references(() => billingScreenActions.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    roleScreenActionUnq: uniqueIndex('bsrp_role_screen_action_unq').on(t.roleId, t.screenId, t.actionId),
    roleIdx: index('bsrp_role_idx').on(t.roleId),
    screenIdx: index('bsrp_screen_idx').on(t.screenId),
    actionIdx: index('bsrp_action_idx').on(t.actionId),
}));
