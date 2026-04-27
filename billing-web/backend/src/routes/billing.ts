/**
 * Billing API routes — تقرأ من PostgreSQL بعد استيراد ECAS عبر ETL.
 * كل المسارات تحت /api/billing.
 */
import { Hono } from 'hono';
import { and, asc, desc, eq, gte, ilike, lte, or, sql as dsql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
    billingStations,
    billingPeriods,
    billingCustomers,
    billingSquares,
    billingRegisters,
    billingActivityTypes,
    billingCashiers,
    billingBills,
    billingPayments,
    billingAdjustments,
    billingPeriodSummary,
    billingScreens,
    billingScreenActions,
    billingScreenActionLinks,
    billingScreenRoles,
    billingScreenRoleLinks,
    billingScreenRolePermissions,
} from '../db/schema-billing.js';
import { requireAuth } from '../middleware/auth.js';
const app = new Hono();
app.use('*', requireAuth);
// ============================================================
// 1) Stations
// ============================================================
app.get('/stations', async (c) => {
    const stations = await db
        .select({
        id: billingStations.id,
        code: billingStations.code,
        name: billingStations.name,
        ecasDb: billingStations.ecasDb,
        sortOrder: billingStations.sortOrder,
    })
        .from(billingStations)
        .where(eq(billingStations.isActive, true))
        .orderBy(asc(billingStations.sortOrder));
    // ملحق: عداد سريع للمشتركين + إجماليات
    const stats = await db
        .select({
        stationId: billingCustomers.stationId,
        customers: dsql `COUNT(${billingCustomers.id})::int`,
    })
        .from(billingCustomers)
        .groupBy(billingCustomers.stationId);
    const statMap = new Map(stats.map((s) => [s.stationId, s.customers]));
    return c.json(stations.map((s) => ({ ...s, customersCount: statMap.get(s.id) ?? 0 })));
});
// ============================================================
// 2) Overview / KPIs لمحطة (اختياري: فترة محدّدة)
// ============================================================
app.get('/overview/:stationId', async (c) => {
    const stationId = c.req.param('stationId');
    const periodId = c.req.query('periodId') || null;
    const [station] = await db.select().from(billingStations).where(eq(billingStations.id, stationId)).limit(1);
    if (!station)
        return c.json({ error: 'المحطة غير موجودة' }, 404);
    const customersCountQ = await db
        .select({ n: dsql `COUNT(*)::int` })
        .from(billingCustomers)
        .where(eq(billingCustomers.stationId, stationId));
    const customersCount = customersCountQ[0]?.n ?? 0;
    // إجماليات (مدى الحياة أو فترة)
    const where = periodId
        ? and(eq(billingPeriodSummary.stationId, stationId), eq(billingPeriodSummary.periodId, periodId))
        : eq(billingPeriodSummary.stationId, stationId);
    const totals = await db
        .select({
        bills: dsql `COALESCE(SUM(${billingPeriodSummary.billsCount}), 0)::int`,
        payments: dsql `COALESCE(SUM(${billingPeriodSummary.paymentsCount}), 0)::int`,
        kwh: dsql `COALESCE(SUM(${billingPeriodSummary.totalKwh}), 0)::bigint`,
        sales: dsql `COALESCE(SUM(${billingPeriodSummary.totalSales}), 0)::numeric`,
        collected: dsql `COALESCE(SUM(${billingPeriodSummary.totalCollected}), 0)::numeric`,
        adjustments: dsql `COALESCE(SUM(${billingPeriodSummary.totalAdjustments}), 0)::numeric`,
        arrears: dsql `COALESCE(SUM(${billingPeriodSummary.totalArrears}), 0)::numeric`,
    })
        .from(billingPeriodSummary)
        .where(where);
    return c.json({
        station,
        customersCount,
        totals: totals[0],
        periodId,
    });
});
// ============================================================
// 3) Periods
// ============================================================
app.get('/periods', async (c) => {
    const stationId = c.req.query('stationId');
    const year = c.req.query('year');
    const stationEcasDb = stationId
        ? await db.select({ ecasDb: billingStations.ecasDb }).from(billingStations).where(eq(billingStations.id, stationId)).limit(1)
        : null;
    const conditions = [];
    if (stationEcasDb?.[0])
        conditions.push(eq(billingPeriods.ecasDb, stationEcasDb[0].ecasDb));
    if (year)
        conditions.push(eq(billingPeriods.year, Number(year)));
    const periods = await db
        .select()
        .from(billingPeriods)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(billingPeriods.year), desc(billingPeriods.month), desc(billingPeriods.part));
    return c.json(periods);
});
// ============================================================
// 4) Customers — قائمة + بحث + فلاتر (شاشة 9010)
// ============================================================
const customersSchema = z.object({
    stationId: z.string().uuid().optional(),
    q: z.string().optional(), // بحث بالاسم/الرقم
    squareId: z.string().uuid().optional(),
    registerId: z.string().uuid().optional(),
    activityTypeId: z.string().uuid().optional(),
    limit: z.coerce.number().min(1).max(500).default(50),
    offset: z.coerce.number().min(0).default(0),
    sort: z.enum(['name', 'code', 'balance', 'createdAt']).default('name'),
});
app.get('/customers', async (c) => {
    const parsed = customersSchema.safeParse({
        stationId: c.req.query('stationId'),
        q: c.req.query('q'),
        squareId: c.req.query('squareId'),
        registerId: c.req.query('registerId'),
        activityTypeId: c.req.query('activityTypeId'),
        limit: c.req.query('limit'),
        offset: c.req.query('offset'),
        sort: c.req.query('sort'),
    });
    if (!parsed.success)
        return c.json({ error: 'معاملات غير صحيحة' }, 400);
    const { stationId, q, squareId, registerId, activityTypeId, limit, offset, sort } = parsed.data;
    const conditions = [];
    if (stationId)
        conditions.push(eq(billingCustomers.stationId, stationId));
    if (squareId)
        conditions.push(eq(billingCustomers.squareId, squareId));
    if (registerId)
        conditions.push(eq(billingCustomers.registerId, registerId));
    if (activityTypeId)
        conditions.push(eq(billingCustomers.activityTypeId, activityTypeId));
    if (q) {
        conditions.push(or(ilike(billingCustomers.name, `%${q}%`), ilike(billingCustomers.subscriberCode, `%${q}%`), ilike(billingCustomers.countNo, `%${q}%`), ilike(billingCustomers.adNo, `%${q}%`)));
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const sortCol = sort === 'code' ? billingCustomers.subscriberCode
        : sort === 'balance' ? billingCustomers.currentBalance
            : sort === 'createdAt' ? billingCustomers.createdAt
                : billingCustomers.name;
    const [rows, totalRow] = await Promise.all([
        db
            .select({
            id: billingCustomers.id,
            subscriberCode: billingCustomers.subscriberCode,
            name: billingCustomers.name,
            address: billingCustomers.address,
            neighbor: billingCustomers.neighbor,
            countNo: billingCustomers.countNo,
            adNo: billingCustomers.adNo,
            lastRead: billingCustomers.lastRead,
            currentBalance: billingCustomers.currentBalance,
            lastArrears: billingCustomers.lastArrears,
            state: billingCustomers.state,
            stationId: billingCustomers.stationId,
            squareId: billingCustomers.squareId,
            squareName: billingSquares.name,
        })
            .from(billingCustomers)
            .leftJoin(billingSquares, eq(billingSquares.id, billingCustomers.squareId))
            .where(where)
            .orderBy(asc(sortCol))
            .limit(limit)
            .offset(offset),
        db
            .select({ n: dsql `COUNT(*)::int` })
            .from(billingCustomers)
            .where(where),
    ]);
    return c.json({ rows, total: totalRow[0]?.n ?? 0, limit, offset });
});
// ============================================================
// 5) Customer details — تاريخ كامل
// ============================================================
app.get('/customers/:id', async (c) => {
    const id = c.req.param('id');
    const [customer] = await db
        .select({
        customer: billingCustomers,
        square: billingSquares,
        register: billingRegisters,
        activity: billingActivityTypes,
        station: billingStations,
    })
        .from(billingCustomers)
        .leftJoin(billingSquares, eq(billingSquares.id, billingCustomers.squareId))
        .leftJoin(billingRegisters, eq(billingRegisters.id, billingCustomers.registerId))
        .leftJoin(billingActivityTypes, eq(billingActivityTypes.id, billingCustomers.activityTypeId))
        .leftJoin(billingStations, eq(billingStations.id, billingCustomers.stationId))
        .where(eq(billingCustomers.id, id))
        .limit(1);
    if (!customer)
        return c.json({ error: 'المشترك غير موجود' }, 404);
    const limit = Number(c.req.query('billsLimit') ?? 24);
    const bills = await db
        .select({
        id: billingBills.id,
        periodId: billingBills.periodId,
        periodName: billingPeriods.name,
        year: billingPeriods.year,
        month: billingPeriods.month,
        previousRead: billingBills.previousRead,
        currentRead: billingBills.currentRead,
        monthConsume: billingBills.monthConsume,
        consumePrice: billingBills.consumePrice,
        consumeAddedPrice: billingBills.consumeAddedPrice,
        lastArrears: billingBills.lastArrears,
        arrears: billingBills.arrears,
        paymentCount: billingBills.paymentCount,
        paymentSumMoney: billingBills.paymentSumMoney,
    })
        .from(billingBills)
        .leftJoin(billingPeriods, eq(billingPeriods.id, billingBills.periodId))
        .where(eq(billingBills.customerId, id))
        .orderBy(desc(billingPeriods.year), desc(billingPeriods.month), desc(billingPeriods.part))
        .limit(limit);
    const payments = await db
        .select({
        id: billingPayments.id,
        amount: billingPayments.amount,
        paidAt: billingPayments.paidAt,
        receiptNo: billingPayments.receiptNo,
        cashierName: billingCashiers.name,
        source: billingPayments.source,
        periodName: billingPeriods.name,
    })
        .from(billingPayments)
        .leftJoin(billingCashiers, eq(billingCashiers.id, billingPayments.cashierId))
        .leftJoin(billingPeriods, eq(billingPeriods.id, billingPayments.periodId))
        .where(eq(billingPayments.customerId, id))
        .orderBy(desc(billingPayments.paidAt))
        .limit(limit);
    const adjustments = await db
        .select({
        id: billingAdjustments.id,
        type: billingAdjustments.type,
        adjustmentValue: billingAdjustments.adjustmentValue,
        totalValue: billingAdjustments.totalValue,
        appliedAt: billingAdjustments.appliedAt,
        periodName: billingPeriods.name,
    })
        .from(billingAdjustments)
        .leftJoin(billingPeriods, eq(billingPeriods.id, billingAdjustments.periodId))
        .where(eq(billingAdjustments.customerId, id))
        .orderBy(desc(billingAdjustments.appliedAt))
        .limit(limit);
    return c.json({ ...customer, bills, payments, adjustments });
});
// ============================================================
// 6) Payments — شاشة 7201
// ============================================================
app.get('/payments', async (c) => {
    const stationId = c.req.query('stationId');
    const periodId = c.req.query('periodId');
    const cashierId = c.req.query('cashierId');
    const from = c.req.query('from');
    const to = c.req.query('to');
    const limit = Math.min(Number(c.req.query('limit') ?? 100), 500);
    const offset = Number(c.req.query('offset') ?? 0);
    const conditions = [];
    if (stationId)
        conditions.push(eq(billingPayments.stationId, stationId));
    if (periodId)
        conditions.push(eq(billingPayments.periodId, periodId));
    if (cashierId)
        conditions.push(eq(billingPayments.cashierId, cashierId));
    if (from)
        conditions.push(gte(billingPayments.paidAt, new Date(from)));
    if (to)
        conditions.push(lte(billingPayments.paidAt, new Date(to)));
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, totalRow] = await Promise.all([
        db
            .select({
            id: billingPayments.id,
            amount: billingPayments.amount,
            paidAt: billingPayments.paidAt,
            receiptNo: billingPayments.receiptNo,
            source: billingPayments.source,
            customerName: billingCustomers.name,
            customerCode: billingCustomers.subscriberCode,
            cashierName: billingCashiers.name,
            periodName: billingPeriods.name,
        })
            .from(billingPayments)
            .leftJoin(billingCustomers, eq(billingCustomers.id, billingPayments.customerId))
            .leftJoin(billingCashiers, eq(billingCashiers.id, billingPayments.cashierId))
            .leftJoin(billingPeriods, eq(billingPeriods.id, billingPayments.periodId))
            .where(where)
            .orderBy(desc(billingPayments.paidAt))
            .limit(limit)
            .offset(offset),
        db.select({ n: dsql `COUNT(*)::int` }).from(billingPayments).where(where),
    ]);
    return c.json({ rows, total: totalRow[0]?.n ?? 0, limit, offset });
});
// ============================================================
// 7) Cashiers performance — شاشة 10301
// ============================================================
app.get('/cashiers', async (c) => {
    const stationId = c.req.query('stationId');
    const from = c.req.query('from');
    const to = c.req.query('to');
    const payConditions = [];
    if (from)
        payConditions.push(gte(billingPayments.paidAt, new Date(from)));
    if (to)
        payConditions.push(lte(billingPayments.paidAt, new Date(to)));
    const cashConds = stationId ? [eq(billingCashiers.stationId, stationId)] : [];
    const rows = await db
        .select({
        id: billingCashiers.id,
        name: billingCashiers.name,
        isElectronic: billingCashiers.isElectronic,
        stationId: billingCashiers.stationId,
        paymentsCount: dsql `COALESCE(COUNT(${billingPayments.id}), 0)::int`,
        totalCollected: dsql `COALESCE(SUM(${billingPayments.amount}), 0)::numeric`,
        lastPaymentAt: dsql `MAX(${billingPayments.paidAt})`,
    })
        .from(billingCashiers)
        .leftJoin(billingPayments, and(eq(billingPayments.cashierId, billingCashiers.id), ...(payConditions.length ? [and(...payConditions)] : [])))
        .where(cashConds.length ? and(...cashConds) : undefined)
        .groupBy(billingCashiers.id)
        .orderBy(desc(dsql `SUM(${billingPayments.amount})`));
    return c.json(rows);
});
// ============================================================
// 8) Period summary report — تقرير المبيعات/التحصيل لكل فترة
// ============================================================
app.get('/reports/periods', async (c) => {
    const stationId = c.req.query('stationId');
    const yearFrom = c.req.query('yearFrom');
    const conds = [];
    if (stationId)
        conds.push(eq(billingPeriodSummary.stationId, stationId));
    const rows = await db
        .select({
        periodId: billingPeriodSummary.periodId,
        periodName: billingPeriods.name,
        year: billingPeriods.year,
        month: billingPeriods.month,
        part: billingPeriods.part,
        stationId: billingPeriodSummary.stationId,
        stationName: billingStations.name,
        billsCount: billingPeriodSummary.billsCount,
        paymentsCount: billingPeriodSummary.paymentsCount,
        totalKwh: billingPeriodSummary.totalKwh,
        totalSales: billingPeriodSummary.totalSales,
        totalCollected: billingPeriodSummary.totalCollected,
        totalAdjustments: billingPeriodSummary.totalAdjustments,
        totalArrears: billingPeriodSummary.totalArrears,
    })
        .from(billingPeriodSummary)
        .innerJoin(billingPeriods, eq(billingPeriods.id, billingPeriodSummary.periodId))
        .innerJoin(billingStations, eq(billingStations.id, billingPeriodSummary.stationId))
        .where(yearFrom
        ? and(...conds, gte(billingPeriods.year, Number(yearFrom)))
        : (conds.length ? and(...conds) : undefined))
        .orderBy(desc(billingPeriods.year), desc(billingPeriods.month), desc(billingPeriods.part), asc(billingStations.sortOrder));
    return c.json(rows);
});
// ============================================================
// 9) Yearly summary
// ============================================================
app.get('/reports/yearly', async (c) => {
    const stationId = c.req.query('stationId');
    const rows = await db
        .select({
        year: billingPeriods.year,
        stationId: billingPeriodSummary.stationId,
        stationName: billingStations.name,
        billsCount: dsql `SUM(${billingPeriodSummary.billsCount})::int`,
        paymentsCount: dsql `SUM(${billingPeriodSummary.paymentsCount})::int`,
        totalKwh: dsql `SUM(${billingPeriodSummary.totalKwh})::bigint`,
        totalSales: dsql `SUM(${billingPeriodSummary.totalSales})::numeric`,
        totalCollected: dsql `SUM(${billingPeriodSummary.totalCollected})::numeric`,
        totalAdjustments: dsql `SUM(${billingPeriodSummary.totalAdjustments})::numeric`,
    })
        .from(billingPeriodSummary)
        .innerJoin(billingPeriods, eq(billingPeriods.id, billingPeriodSummary.periodId))
        .innerJoin(billingStations, eq(billingStations.id, billingPeriodSummary.stationId))
        .where(stationId ? eq(billingPeriodSummary.stationId, stationId) : undefined)
        .groupBy(billingPeriods.year, billingPeriodSummary.stationId, billingStations.name)
        .orderBy(desc(billingPeriods.year), asc(billingStations.name));
    return c.json(rows);
});
// ============================================================
// 10) Screens index (171 شاشة ECAS)
// ============================================================
app.get('/screens', async (_c) => {
    const screens = await db
        .select()
        .from(billingScreens)
        .orderBy(asc(billingScreens.menuKey), asc(billingScreens.menuIndex), asc(billingScreens.code));
    return _c.json(screens);
});
app.get('/screen-actions', async (_c) => {
    const actions = await db
        .select()
        .from(billingScreenActions)
        .orderBy(asc(billingScreenActions.code));
    return _c.json(actions);
});
app.get('/screen-roles', async (_c) => {
    const roles = await db
        .select()
        .from(billingScreenRoles)
        .orderBy(asc(billingScreenRoles.code));
    return _c.json(roles);
});
app.get('/screens/:code', async (c) => {
    const code = Number(c.req.param('code'));
    if (!Number.isFinite(code)) {
        return c.json({ error: 'كود الشاشة غير صحيح' }, 400);
    }
    const [screen] = await db
        .select()
        .from(billingScreens)
        .where(eq(billingScreens.code, code))
        .limit(1);
    if (!screen) {
        return c.json({ error: 'الشاشة غير موجودة' }, 404);
    }
    const actions = await db
        .select({
        code: billingScreenActions.code,
        name: billingScreenActions.name,
    })
        .from(billingScreenActionLinks)
        .innerJoin(billingScreenActions, eq(billingScreenActions.id, billingScreenActionLinks.actionId))
        .where(eq(billingScreenActionLinks.screenId, screen.id))
        .orderBy(asc(billingScreenActions.code));
    const roles = await db
        .select({
        code: billingScreenRoles.code,
        name: billingScreenRoles.name,
    })
        .from(billingScreenRoleLinks)
        .innerJoin(billingScreenRoles, eq(billingScreenRoles.id, billingScreenRoleLinks.roleId))
        .where(eq(billingScreenRoleLinks.screenId, screen.id))
        .orderBy(asc(billingScreenRoles.code));
    const rolePermissions = await db
        .select({
        roleCode: billingScreenRoles.code,
        roleName: billingScreenRoles.name,
        actionCode: billingScreenActions.code,
        actionName: billingScreenActions.name,
    })
        .from(billingScreenRolePermissions)
        .innerJoin(billingScreenRoles, eq(billingScreenRoles.id, billingScreenRolePermissions.roleId))
        .innerJoin(billingScreenActions, eq(billingScreenActions.id, billingScreenRolePermissions.actionId))
        .where(eq(billingScreenRolePermissions.screenId, screen.id))
        .orderBy(asc(billingScreenRoles.code), asc(billingScreenActions.code));
    return c.json({ screen, actions, roles, rolePermissions });
});
export default app;
