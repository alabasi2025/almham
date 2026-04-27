import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { closeDb, db } from '../db/index.js';
import {
  billingAddressTypes,
  billingAreas,
  billingBranches,
  billingCustomers,
  billingPhases,
  billingRegisters,
  billingSquares,
  billingStations,
} from '../db/schema-billing.js';
import { loadTable } from '../lib/ecas-csv.js';

type EcasDb = 'Ecas2664' | 'Ecas2668' | 'Ecas2670' | 'Ecas2672' | 'Ecas2673';
type StationCode = 'dahamiya' | 'sabaliya' | 'ghulail' | 'saddam' | 'tawfiq';

const SOURCES: Array<{ dbName: EcasDb; defaultStation: StationCode }> = [
  { dbName: 'Ecas2673', defaultStation: 'dahamiya' },
  { dbName: 'Ecas2668', defaultStation: 'sabaliya' },
  { dbName: 'Ecas2672', defaultStation: 'ghulail' },
  { dbName: 'Ecas2664', defaultStation: 'saddam' },
  { dbName: 'Ecas2670', defaultStation: 'tawfiq' },
];

interface ImportSummary {
  areas: number;
  branches: number;
  registers: number;
  squares: number;
  squaresNeedReview: number;
  addressTypes: number;
  phases: number;
  customers: number;
  customersWithoutSquare: number;
}

const summary: ImportSummary = {
  areas: 0,
  branches: 0,
  registers: 0,
  squares: 0,
  squaresNeedReview: 0,
  addressTypes: 0,
  phases: 0,
  customers: 0,
  customersWithoutSquare: 0,
};

function clean(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || text.toLowerCase() === 'null') return null;
  return text;
}

function text(value: unknown, fallback = ''): string {
  return clean(value) ?? fallback;
}

function intValue(value: unknown): number | null {
  const raw = clean(value);
  if (!raw) return null;
  const valueNumber = Number(raw.replace(/,/g, ''));
  return Number.isFinite(valueNumber) ? Math.trunc(valueNumber) : null;
}

function numericValue(value: unknown): string | null {
  const raw = clean(value);
  if (!raw) return null;
  const valueNumber = Number(raw.replace(/,/g, ''));
  return Number.isFinite(valueNumber) ? String(valueNumber) : null;
}

function dateOnly(value: unknown): string | null {
  const raw = clean(value);
  if (!raw) return null;

  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [, month, day, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function timestampValue(value: unknown): Date {
  const raw = clean(value);
  if (!raw) return new Date();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function key(dbName: string, ecasId: number | null): string | null {
  return ecasId == null ? null : `${dbName}:${ecasId}`;
}

function detectStationCode(dbName: EcasDb, sourceText: string | null): { code: StationCode; needsReview: boolean } {
  if (dbName === 'Ecas2673') return { code: 'dahamiya', needsReview: false };
  if (dbName === 'Ecas2672') return { code: 'ghulail', needsReview: false };
  if (dbName === 'Ecas2664') return { code: 'saddam', needsReview: false };
  if (dbName === 'Ecas2670') return { code: 'tawfiq', needsReview: false };
  return { code: 'sabaliya', needsReview: false };
}

async function loadStationIds(): Promise<Record<StationCode, string>> {
  const rows = await db
    .select({ id: billingStations.id, code: billingStations.code })
    .from(billingStations);

  const stations = Object.fromEntries(rows.map((row) => [row.code, row.id])) as Partial<Record<StationCode, string>>;
  for (const code of ['dahamiya', 'sabaliya', 'ghulail', 'saddam', 'tawfiq'] satisfies StationCode[]) {
    if (!stations[code]) {
      throw new Error(`محطة الفوترة غير موجودة في seed: ${code}`);
    }
  }

  return stations as Record<StationCode, string>;
}

async function upsertArea(dbName: EcasDb, stationId: string, row: Record<string, string>) {
  const ecasId = intValue(row['Ar_ID']);
  if (ecasId == null) return null;

  const values = {
    stationId,
    ecasId,
    ecasDb: dbName,
    name: text(row['Ar_Name'], `Area ${ecasId}`),
  };

  const [existing] = await db
    .select({ id: billingAreas.id })
    .from(billingAreas)
    .where(and(eq(billingAreas.ecasDb, dbName), eq(billingAreas.ecasId, ecasId)))
    .limit(1);

  if (existing) {
    await db.update(billingAreas).set(values as typeof billingAreas.$inferInsert).where(eq(billingAreas.id, existing.id));
    return existing.id;
  }

  const [created] = await db.insert(billingAreas).values(values as typeof billingAreas.$inferInsert).returning({ id: billingAreas.id });
  summary.areas += 1;
  return created.id;
}

async function upsertAddressType(dbName: EcasDb, row: Record<string, string>) {
  const ecasId = intValue(row['AdTp_ID']);
  if (ecasId == null) return null;

  const values = {
    ecasId,
    ecasDb: dbName,
    name: text(row['AdTp_Name'], `AdTp ${ecasId}`),
  };

  const [existing] = await db
    .select({ id: billingAddressTypes.id })
    .from(billingAddressTypes)
    .where(and(eq(billingAddressTypes.ecasDb, dbName), eq(billingAddressTypes.ecasId, ecasId)))
    .limit(1);

  if (existing) {
    await db.update(billingAddressTypes).set(values as typeof billingAddressTypes.$inferInsert).where(eq(billingAddressTypes.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(billingAddressTypes)
    .values(values as typeof billingAddressTypes.$inferInsert)
    .returning({ id: billingAddressTypes.id });
  summary.addressTypes += 1;
  return created.id;
}

async function upsertPhase(dbName: EcasDb, row: Record<string, string>) {
  const ecasId = intValue(row['FT_ID']);
  if (ecasId == null) return null;

  const values = {
    ecasId,
    ecasDb: dbName,
    name: text(row['FT_Name'], `Faz ${ecasId}`),
  };

  const [existing] = await db
    .select({ id: billingPhases.id })
    .from(billingPhases)
    .where(and(eq(billingPhases.ecasDb, dbName), eq(billingPhases.ecasId, ecasId)))
    .limit(1);

  if (existing) {
    await db.update(billingPhases).set(values as typeof billingPhases.$inferInsert).where(eq(billingPhases.id, existing.id));
    return existing.id;
  }

  const [created] = await db.insert(billingPhases).values(values as typeof billingPhases.$inferInsert).returning({ id: billingPhases.id });
  summary.phases += 1;
  return created.id;
}

async function upsertBranch(
  dbName: EcasDb,
  stationId: string,
  areaId: string | null,
  row: Record<string, string>,
) {
  const ecasId = intValue(row['Brn_ID']);
  if (ecasId == null) return null;

  const values = {
    stationId,
    areaId,
    ecasId,
    ecasDb: dbName,
    name: text(row['Brn_Name'], `Branch ${ecasId}`),
  };

  const [existing] = await db
    .select({ id: billingBranches.id })
    .from(billingBranches)
    .where(and(eq(billingBranches.ecasDb, dbName), eq(billingBranches.ecasId, ecasId)))
    .limit(1);

  if (existing) {
    await db.update(billingBranches).set(values as typeof billingBranches.$inferInsert).where(eq(billingBranches.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(billingBranches)
    .values(values as typeof billingBranches.$inferInsert)
    .returning({ id: billingBranches.id });
  summary.branches += 1;
  return created.id;
}

async function upsertRegister(
  dbName: EcasDb,
  stationIds: Record<StationCode, string>,
  branchId: string | null,
  row: Record<string, string>,
) {
  const ecasId = intValue(row['Sgl_ID']);
  if (ecasId == null) return null;
  const station = detectStationCode(dbName, row['Sgl_Name']);

  const values = {
    stationId: stationIds[station.code],
    branchId,
    ecasId,
    ecasDb: dbName,
    name: text(row['Sgl_Name'], `Segel ${ecasId}`),
  };

  const [existing] = await db
    .select({ id: billingRegisters.id })
    .from(billingRegisters)
    .where(and(eq(billingRegisters.ecasDb, dbName), eq(billingRegisters.ecasId, ecasId)))
    .limit(1);

  if (existing) {
    await db.update(billingRegisters).set(values as typeof billingRegisters.$inferInsert).where(eq(billingRegisters.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(billingRegisters)
    .values(values as typeof billingRegisters.$inferInsert)
    .returning({ id: billingRegisters.id });
  summary.registers += 1;
  return created.id;
}

async function upsertSquare(
  dbName: EcasDb,
  stationIds: Record<StationCode, string>,
  registerMap: Map<string, string>,
  row: Record<string, string>,
) {
  const ecasId = intValue(row['Squr_ID']);
  if (ecasId == null) return null;
  const station = detectStationCode(dbName, row['Squr_Name']);
  const registerId = registerMap.get(key(dbName, intValue(row['Rder_ID'])) ?? '') ?? null;

  const values = {
    stationId: stationIds[station.code],
    registerId,
    ecasId,
    ecasDb: dbName,
    name: text(row['Squr_Name'], `Square ${ecasId}`),
    detectedStation: station.code,
    needsReview: station.needsReview,
  };

  const [existing] = await db
    .select({ id: billingSquares.id })
    .from(billingSquares)
    .where(and(eq(billingSquares.ecasDb, dbName), eq(billingSquares.ecasId, ecasId)))
    .limit(1);

  if (station.needsReview) summary.squaresNeedReview += 1;

  if (existing) {
    await db.update(billingSquares).set(values as typeof billingSquares.$inferInsert).where(eq(billingSquares.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(billingSquares)
    .values(values as typeof billingSquares.$inferInsert)
    .returning({ id: billingSquares.id });
  summary.squares += 1;
  return created.id;
}

async function upsertCustomer(
  dbName: EcasDb,
  stationIds: Record<StationCode, string>,
  squareStationMap: Map<string, StationCode>,
  squareMap: Map<string, string>,
  registerMap: Map<string, string>,
  addressTypeMap: Map<string, string>,
  phaseMap: Map<string, string>,
  row: Record<string, string>,
) {
  const ecasId = intValue(row['Cst_ID']);
  if (ecasId == null) return;

  const squareKey = key(dbName, intValue(row['Squr_ID']));
  const squareId = squareKey ? squareMap.get(squareKey) ?? null : null;
  const stationCode = (squareKey ? squareStationMap.get(squareKey) : null) ?? detectStationCode(dbName, row['Cst_Address'] ?? row['Cst_Negabor']).code;

  if (!squareId) summary.customersWithoutSquare += 1;

  const values = {
    ecasId,
    ecasDb: dbName,
    ecasRefId: intValue(row['Cst_RefID']),
    stationId: stationIds[stationCode],
    squareId,
    registerId: registerMap.get(key(dbName, intValue(row['Sgl_ID'])) ?? '') ?? null,
    addressTypeId: addressTypeMap.get(key(dbName, intValue(row['AdTp_ID'])) ?? '') ?? null,
    phaseId: phaseMap.get(key(dbName, intValue(row['FT_ID'])) ?? '') ?? null,
    subscriberCode: text(row['Cst_NewCode'], String(ecasId)),
    name: text(row['Cst_Name'], `مشترك ${ecasId}`),
    address: clean(row['Cst_Address']),
    neighbor: clean(row['Cst_Negabor']),
    countNo: clean(row['Cst_CountNo']),
    adNo: clean(row['Cst_AdNo']),
    adField: clean(row['Cst_AdFild']),
    adTor: clean(row['Cst_AdTor']),
    phone: clean(row['Cst_TeleNo']),
    beginServiceDate: dateOnly(row['Cst_BeginServceDate']),
    lastRead: numericValue(row['Cst_LastRead']),
    lastBalance: numericValue(row['Cst_LastBalance']) ?? '0',
    lastArrears: numericValue(row['Cst_LastArrears']) ?? '0',
    currentBalance: numericValue(row['Cst_LastBalance']) ?? '0',
    recordState: intValue(row['RS_ID']),
    updatedAt: timestampValue(row['Cst_UpDateDate']),
  };

  const [existing] = await db
    .select({ id: billingCustomers.id })
    .from(billingCustomers)
    .where(and(eq(billingCustomers.ecasDb, dbName), eq(billingCustomers.ecasId, ecasId)))
    .limit(1);

  if (existing) {
    await db.update(billingCustomers).set(values as typeof billingCustomers.$inferInsert).where(eq(billingCustomers.id, existing.id));
  } else {
    await db.insert(billingCustomers).values(values as typeof billingCustomers.$inferInsert);
    summary.customers += 1;
  }
}

async function importSource(dbName: EcasDb, defaultStation: StationCode, stationIds: Record<StationCode, string>) {
  const defaultStationId = stationIds[defaultStation];

  const areaMap = new Map<string, string>();
  for (const row of loadTable(dbName, 'Area')) {
    const id = await upsertArea(dbName, defaultStationId, row);
    const areaKey = key(dbName, intValue(row['Ar_ID']));
    if (id && areaKey) areaMap.set(areaKey, id);
  }

  const addressTypeMap = new Map<string, string>();
  for (const row of loadTable(dbName, 'AdadType')) {
    const id = await upsertAddressType(dbName, row);
    const itemKey = key(dbName, intValue(row['AdTp_ID']));
    if (id && itemKey) addressTypeMap.set(itemKey, id);
  }

  const phaseMap = new Map<string, string>();
  for (const row of loadTable(dbName, 'FazType')) {
    const id = await upsertPhase(dbName, row);
    const itemKey = key(dbName, intValue(row['FT_ID']));
    if (id && itemKey) phaseMap.set(itemKey, id);
  }

  const branchMap = new Map<string, string>();
  for (const row of loadTable(dbName, 'Branch')) {
    const areaId = areaMap.get(key(dbName, intValue(row['Ar_ID'])) ?? '') ?? null;
    const id = await upsertBranch(dbName, defaultStationId, areaId, row);
    const branchKey = key(dbName, intValue(row['Brn_ID']));
    if (id && branchKey) branchMap.set(branchKey, id);
  }

  const registerMap = new Map<string, string>();
  for (const row of loadTable(dbName, 'Segel')) {
    const branchId = branchMap.get(key(dbName, intValue(row['Brn_ID'])) ?? '') ?? null;
    const id = await upsertRegister(dbName, stationIds, branchId, row);
    const registerKey = key(dbName, intValue(row['Sgl_ID']));
    if (id && registerKey) registerMap.set(registerKey, id);
  }

  const squareMap = new Map<string, string>();
  const squareStationMap = new Map<string, StationCode>();
  for (const row of loadTable(dbName, 'Squares')) {
    const id = await upsertSquare(dbName, stationIds, registerMap, row);
    const squareKey = key(dbName, intValue(row['Squr_ID']));
    if (id && squareKey) {
      squareMap.set(squareKey, id);
      squareStationMap.set(squareKey, detectStationCode(dbName, row['Squr_Name']).code);
    }
  }

  for (const row of loadTable(dbName, 'Customer')) {
    await upsertCustomer(dbName, stationIds, squareStationMap, squareMap, registerMap, addressTypeMap, phaseMap, row);
  }
}

async function main() {
  const stationIds = await loadStationIds();
  for (const source of SOURCES) {
    await importSource(source.dbName, source.defaultStation, stationIds);
  }

  console.log('اكتمل استيراد المشتركين.');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error('فشل استيراد المشتركين:', error);
  process.exitCode = 1;
}).finally(async () => {
  await closeDb();
});
