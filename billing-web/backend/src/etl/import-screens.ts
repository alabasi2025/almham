import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { closeDb, db } from '../db/index.js';
import {
  billingScreenActionLinks,
  billingScreenActions,
  billingScreenRoleLinks,
  billingScreenRolePermissions,
  billingScreenRoles,
  billingScreens,
} from '../db/schema-billing.js';

interface EcasScreenRow {
  rankId: number;
  code: number;
  name: string;
  menuKey: string | null;
  menuIndex: number | null;
}

interface EcasActionRow {
  code: number;
  name: string;
}

interface EcasScreenActionRow {
  screenCode: number;
  actionCode: number;
}

interface EcasRoleRow {
  code: number;
  name: string;
  startFormId: number | null;
  startEventId: number | null;
}

interface EcasRoleScreenRow {
  roleCode: number;
  screenCode: number;
}

interface EcasRolePermissionRow {
  roleCode: number;
  screenCode: number;
  actionCode: number;
}

interface ImportCounter {
  imported: number;
  created: number;
  updated: number;
  skipped: number;
}

interface ImportSummary {
  sourceDb: string;
  screens: ImportCounter;
  actions: ImportCounter;
  screenActions: ImportCounter;
  roles: ImportCounter;
  roleScreens: ImportCounter;
  rolePermissions: ImportCounter;
}

const SQLCMD_SEPARATOR = '|';

function requiredSqlValue(value: string | undefined, name: string): string {
  if (!value?.trim()) {
    throw new Error(`${name} مطلوب`);
  }

  return value.trim();
}

function parseIntValue(value: string | undefined): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanText(value: string | undefined): string | null {
  const text = value?.trim();
  if (!text || text.toUpperCase() === 'NULL') return null;
  return text;
}

function emptyCounter(imported = 0): ImportCounter {
  return {
    imported,
    created: 0,
    updated: 0,
    skipped: 0,
  };
}

function quotePowerShellString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function runSqlcmd(query: string): string {
  const server = process.env['BILLING_ECAS_SQL_SERVER'] ?? '.\\ECASDEV';
  const tempDir = mkdtempSync(join(tmpdir(), 'almham-billing-sqlcmd-'));
  const queryPath = join(tempDir, 'query.sql');
  const scriptPath = join(tempDir, 'run-sqlcmd.ps1');
  writeFileSync(queryPath, query, 'utf8');
  writeFileSync(
    scriptPath,
    [
      "$utf8 = [System.Text.UTF8Encoding]::new($false)",
      '[Console]::OutputEncoding = $utf8',
      '$OutputEncoding = $utf8',
      '$sqlcmdArgs = @(',
      `  '-S', ${quotePowerShellString(server)},`,
      "  '-E',",
      "  '-C',",
      "  '-f', '65001',",
      "  '-W',",
      "  '-w', '65535',",
      "  '-h', '-1',",
      `  '-s', ${quotePowerShellString(SQLCMD_SEPARATOR)},`,
      `  '-i', ${quotePowerShellString(queryPath)}`,
      ')',
      '& sqlcmd @sqlcmdArgs',
      'exit $LASTEXITCODE',
      '',
    ].join('\n'),
    'utf8',
  );

  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
    windowsHide: true,
  });
  const stdout = new TextDecoder('utf-8').decode(result.stdout);
  const stderr = new TextDecoder('utf-8').decode(result.stderr);
  rmSync(tempDir, { recursive: true, force: true });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(stderr || stdout || 'فشل تشغيل sqlcmd');
  }

  return stdout;
}

function safeDbName(sourceDb: string): string {
  return requiredSqlValue(sourceDb, 'BILLING_ECAS_SCREEN_DB').replaceAll(']', ']]');
}

function parseSqlRows(output: string): string[][] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line && !line.startsWith('('))
    .map((line) => line.split(SQLCMD_SEPARATOR));
}

function loadScreensFromEcas(sourceDb: string): EcasScreenRow[] {
  const dbName = safeDbName(sourceDb);
  const output = runSqlcmd(`
SET NOCOUNT ON;
SELECT
  CONVERT(varchar(10), Frm_RankID),
  CONVERT(varchar(20), Frm_ID),
  REPLACE(REPLACE(ISNULL(Frm_Name, ''), CHAR(13), ' '), CHAR(10), ' '),
  REPLACE(REPLACE(ISNULL(Frm_MnuName, ''), CHAR(13), ' '), CHAR(10), ' '),
  ISNULL(CONVERT(varchar(20), Frm_MnuIndex), '')
FROM [${dbName}].dbo.FormData
ORDER BY Frm_MnuIndex, Frm_ID;
`);

  return parseSqlRows(output)
    .map((line) => {
      const [rankId, code, name, menuKey, menuIndex] = line;
      const parsedRankId = parseIntValue(rankId);
      const parsedCode = parseIntValue(code);

      if (parsedRankId == null || parsedCode == null) {
        throw new Error(`صف FormData غير صالح: ${line.join(SQLCMD_SEPARATOR)}`);
      }

      return {
        rankId: parsedRankId,
        code: parsedCode,
        name: cleanText(name) ?? `Screen ${parsedCode}`,
        menuKey: cleanText(menuKey),
        menuIndex: parseIntValue(menuIndex),
      };
    });
}

function loadActionsFromEcas(sourceDb: string): EcasActionRow[] {
  const dbName = safeDbName(sourceDb);
  const output = runSqlcmd(`
SET NOCOUNT ON;
SELECT
  CONVERT(varchar(20), Evn_ID),
  REPLACE(REPLACE(ISNULL(Evn_Name, ''), CHAR(13), ' '), CHAR(10), ' ')
FROM [${dbName}].dbo.Event
ORDER BY Evn_ID;
`);

  return parseSqlRows(output).map((line) => {
    const [code, name] = line;
    const parsedCode = parseIntValue(code);
    if (parsedCode == null) {
      throw new Error(`صف Event غير صالح: ${line.join(SQLCMD_SEPARATOR)}`);
    }

    return {
      code: parsedCode,
      name: cleanText(name) ?? `Action ${parsedCode}`,
    };
  });
}

function loadScreenActionsFromEcas(sourceDb: string): EcasScreenActionRow[] {
  const dbName = safeDbName(sourceDb);
  const output = runSqlcmd(`
SET NOCOUNT ON;
SELECT
  CONVERT(varchar(20), Frm_ID),
  CONVERT(varchar(20), Evn_ID)
FROM [${dbName}].dbo.FormEvent
ORDER BY Frm_ID, Evn_ID;
`);

  return parseSqlRows(output).map((line) => {
    const [screenCode, actionCode] = line;
    const parsedScreenCode = parseIntValue(screenCode);
    const parsedActionCode = parseIntValue(actionCode);
    if (parsedScreenCode == null || parsedActionCode == null) {
      throw new Error(`صف FormEvent غير صالح: ${line.join(SQLCMD_SEPARATOR)}`);
    }

    return {
      screenCode: parsedScreenCode,
      actionCode: parsedActionCode,
    };
  });
}

function loadRolesFromEcas(sourceDb: string): EcasRoleRow[] {
  const dbName = safeDbName(sourceDb);
  const output = runSqlcmd(`
SET NOCOUNT ON;
SELECT
  CONVERT(varchar(20), RU_ID),
  REPLACE(REPLACE(ISNULL(RU_Name, ''), CHAR(13), ' '), CHAR(10), ' '),
  ISNULL(CONVERT(varchar(20), SFID), ''),
  ISNULL(CONVERT(varchar(20), SEID), '')
FROM [${dbName}].dbo.RankUser
ORDER BY RU_ID;
`);

  return parseSqlRows(output).map((line) => {
    const [code, name, startFormId, startEventId] = line;
    const parsedCode = parseIntValue(code);
    if (parsedCode == null) {
      throw new Error(`صف RankUser غير صالح: ${line.join(SQLCMD_SEPARATOR)}`);
    }

    return {
      code: parsedCode,
      name: cleanText(name) ?? `Role ${parsedCode}`,
      startFormId: parseIntValue(startFormId),
      startEventId: parseIntValue(startEventId),
    };
  });
}

function loadRoleScreensFromEcas(sourceDb: string): EcasRoleScreenRow[] {
  const dbName = safeDbName(sourceDb);
  const output = runSqlcmd(`
SET NOCOUNT ON;
SELECT
  CONVERT(varchar(20), RU_ID),
  CONVERT(varchar(20), Frm_ID)
FROM [${dbName}].dbo.FormRankUser
ORDER BY RU_ID, Frm_ID;
`);

  return parseSqlRows(output).map((line) => {
    const [roleCode, screenCode] = line;
    const parsedRoleCode = parseIntValue(roleCode);
    const parsedScreenCode = parseIntValue(screenCode);
    if (parsedRoleCode == null || parsedScreenCode == null) {
      throw new Error(`صف FormRankUser غير صالح: ${line.join(SQLCMD_SEPARATOR)}`);
    }

    return {
      roleCode: parsedRoleCode,
      screenCode: parsedScreenCode,
    };
  });
}

function loadRolePermissionsFromEcas(sourceDb: string): EcasRolePermissionRow[] {
  const dbName = safeDbName(sourceDb);
  const output = runSqlcmd(`
SET NOCOUNT ON;
SELECT
  CONVERT(varchar(20), RU_ID),
  CONVERT(varchar(20), Frm_ID),
  CONVERT(varchar(20), Evn_ID)
FROM [${dbName}].dbo.UserPrivileg
ORDER BY RU_ID, Frm_ID, Evn_ID;
`);

  return parseSqlRows(output).map((line) => {
    const [roleCode, screenCode, actionCode] = line;
    const parsedRoleCode = parseIntValue(roleCode);
    const parsedScreenCode = parseIntValue(screenCode);
    const parsedActionCode = parseIntValue(actionCode);
    if (parsedRoleCode == null || parsedScreenCode == null || parsedActionCode == null) {
      throw new Error(`صف UserPrivileg غير صالح: ${line.join(SQLCMD_SEPARATOR)}`);
    }

    return {
      roleCode: parsedRoleCode,
      screenCode: parsedScreenCode,
      actionCode: parsedActionCode,
    };
  });
}

async function upsertScreen(row: EcasScreenRow): Promise<'created' | 'updated'> {
  const [existing] = await db
    .select({
      id: billingScreens.id,
      isImplemented: billingScreens.isImplemented,
    })
    .from(billingScreens)
    .where(eq(billingScreens.code, row.code))
    .limit(1);

  const values = {
    code: row.code,
    name: row.name,
    menuKey: row.menuKey,
    menuIndex: row.menuIndex,
    rankId: row.rankId,
    routePath: `/billing/f/${row.code}`,
    isImplemented: existing?.isImplemented ?? false,
  };

  if (existing) {
    await db.update(billingScreens).set(values as typeof billingScreens.$inferInsert).where(eq(billingScreens.id, existing.id));
    return 'updated';
  }

  await db.insert(billingScreens).values(values as typeof billingScreens.$inferInsert);
  return 'created';
}

async function upsertAction(row: EcasActionRow): Promise<'created' | 'updated'> {
  const [existing] = await db
    .select({ id: billingScreenActions.id })
    .from(billingScreenActions)
    .where(eq(billingScreenActions.code, row.code))
    .limit(1);

  const values = {
    code: row.code,
    name: row.name,
  };

  if (existing) {
    await db
      .update(billingScreenActions)
      .set(values as typeof billingScreenActions.$inferInsert)
      .where(eq(billingScreenActions.id, existing.id));
    return 'updated';
  }

  await db.insert(billingScreenActions).values(values as typeof billingScreenActions.$inferInsert);
  return 'created';
}

async function upsertRole(row: EcasRoleRow): Promise<'created' | 'updated'> {
  const [existing] = await db
    .select({ id: billingScreenRoles.id })
    .from(billingScreenRoles)
    .where(eq(billingScreenRoles.code, row.code))
    .limit(1);

  const values = {
    code: row.code,
    name: row.name,
    startFormId: row.startFormId,
    startEventId: row.startEventId,
  };

  if (existing) {
    await db
      .update(billingScreenRoles)
      .set(values as typeof billingScreenRoles.$inferInsert)
      .where(eq(billingScreenRoles.id, existing.id));
    return 'updated';
  }

  await db.insert(billingScreenRoles).values(values as typeof billingScreenRoles.$inferInsert);
  return 'created';
}

async function loadIdMap<TCode extends number>(
  tableName: 'screens' | 'actions' | 'roles',
): Promise<Map<TCode, string>> {
  if (tableName === 'screens') {
    const rows = await db.select({ id: billingScreens.id, code: billingScreens.code }).from(billingScreens);
    return new Map(rows.map((row) => [row.code as TCode, row.id]));
  }

  if (tableName === 'actions') {
    const rows = await db.select({ id: billingScreenActions.id, code: billingScreenActions.code }).from(billingScreenActions);
    return new Map(rows.map((row) => [row.code as TCode, row.id]));
  }

  const rows = await db.select({ id: billingScreenRoles.id, code: billingScreenRoles.code }).from(billingScreenRoles);
  return new Map(rows.map((row) => [row.code as TCode, row.id]));
}

async function replaceScreenActionLinks(rows: EcasScreenActionRow[], summary: ImportCounter) {
  await db.delete(billingScreenActionLinks);
  const screenMap = await loadIdMap<number>('screens');
  const actionMap = await loadIdMap<number>('actions');

  for (const row of rows) {
    const screenId = screenMap.get(row.screenCode);
    const actionId = actionMap.get(row.actionCode);
    if (!screenId || !actionId) {
      summary.skipped += 1;
      continue;
    }

    await db.insert(billingScreenActionLinks).values({
      screenId,
      actionId,
    } as typeof billingScreenActionLinks.$inferInsert);
    summary.created += 1;
  }
}

async function replaceRoleScreenLinks(rows: EcasRoleScreenRow[], summary: ImportCounter) {
  await db.delete(billingScreenRoleLinks);
  const roleMap = await loadIdMap<number>('roles');
  const screenMap = await loadIdMap<number>('screens');

  for (const row of rows) {
    const roleId = roleMap.get(row.roleCode);
    const screenId = screenMap.get(row.screenCode);
    if (!roleId || !screenId) {
      summary.skipped += 1;
      continue;
    }

    await db.insert(billingScreenRoleLinks).values({
      roleId,
      screenId,
    } as typeof billingScreenRoleLinks.$inferInsert);
    summary.created += 1;
  }
}

async function replaceRolePermissions(rows: EcasRolePermissionRow[], summary: ImportCounter) {
  await db.delete(billingScreenRolePermissions);
  const roleMap = await loadIdMap<number>('roles');
  const screenMap = await loadIdMap<number>('screens');
  const actionMap = await loadIdMap<number>('actions');

  for (const row of rows) {
    const roleId = roleMap.get(row.roleCode);
    const screenId = screenMap.get(row.screenCode);
    const actionId = actionMap.get(row.actionCode);
    if (!roleId || !screenId || !actionId) {
      summary.skipped += 1;
      continue;
    }

    await db.insert(billingScreenRolePermissions).values({
      roleId,
      screenId,
      actionId,
    } as typeof billingScreenRolePermissions.$inferInsert);
    summary.created += 1;
  }
}

async function main() {
  const sourceDb = process.env['BILLING_ECAS_SCREEN_DB'] ?? 'Ecas2673';
  const screenRows = loadScreensFromEcas(sourceDb);
  const actionRows = loadActionsFromEcas(sourceDb);
  const screenActionRows = loadScreenActionsFromEcas(sourceDb);
  const roleRows = loadRolesFromEcas(sourceDb);
  const roleScreenRows = loadRoleScreensFromEcas(sourceDb);
  const rolePermissionRows = loadRolePermissionsFromEcas(sourceDb);
  const summary: ImportSummary = {
    sourceDb,
    screens: emptyCounter(screenRows.length),
    actions: emptyCounter(actionRows.length),
    screenActions: emptyCounter(screenActionRows.length),
    roles: emptyCounter(roleRows.length),
    roleScreens: emptyCounter(roleScreenRows.length),
    rolePermissions: emptyCounter(rolePermissionRows.length),
  };

  for (const row of screenRows) {
    const result = await upsertScreen(row);
    summary.screens[result] += 1;
  }

  for (const row of actionRows) {
    const result = await upsertAction(row);
    summary.actions[result] += 1;
  }

  for (const row of roleRows) {
    const result = await upsertRole(row);
    summary.roles[result] += 1;
  }

  await replaceRolePermissions([], emptyCounter());
  await replaceScreenActionLinks(screenActionRows, summary.screenActions);
  await replaceRoleScreenLinks(roleScreenRows, summary.roleScreens);
  await replaceRolePermissions(rolePermissionRows, summary.rolePermissions);

  console.log('اكتمل استيراد أكواد الشاشات وصلاحياتها من ECAS.');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error('فشل استيراد أكواد الشاشات:', error);
  process.exitCode = 1;
}).finally(async () => {
  await closeDb();
});
