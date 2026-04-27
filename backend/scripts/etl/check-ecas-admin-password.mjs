import { mssqlPool, ECAS_DATABASES } from './lib.mjs';

function decodeEcasPassword(p) {
  if (!p) return null;
  try {
    return Buffer.from(String(p), 'base64').toString('utf8');
  } catch {
    return null;
  }
}

async function main() {
  const argName = process.argv[2] ? String(process.argv[2]) : 'Administrator';
  console.log(`🔎 البحث عن المستخدم بالاسم الدقيق: "${argName}"\n`);

  for (const { code, label } of ECAS_DATABASES) {
    const mssql = await mssqlPool(code);
    try {
      const req = mssql.request();
      req.input('name', argName);
      req.input('like', `${argName}%`);
      const r = await req.query(`
        SELECT USER_NO, NAME, P, STATUS
        FROM BILLING_MANAGERS_USERS
        WHERE STATUS <> 0 AND (
          NAME = @name OR LTRIM(RTRIM(NAME)) = @name OR NAME LIKE @like OR NAME LIKE N'%ادم%'
        )
        ORDER BY USER_NO
      `);
      if (r.recordset.length === 0) {
        console.log(`[${code}] لا يوجد صف مطابق بالاسم الدقيق`);
        continue;
      }
      for (const row of r.recordset) {
        const rawName = row.NAME == null ? '' : String(row.NAME);
        const trimmed = rawName.trim();
        const enc = row.P == null ? null : String(row.P);
        const dec = decodeEcasPassword(enc);
        const encLen = enc ? enc.length : 0;
        const decLen = dec ? dec.length : 0;
        console.log(`[${code}] NAME(raw)="${rawName}" (len=${rawName.length}) | NAME(trim)="${trimmed}" (len=${trimmed.length}) | STATUS=${row.STATUS}`);
        console.log(`        P(raw)="${enc ?? ''}" (len=${encLen}) -> decoded="${dec ?? ''}" (len=${decLen})`);
      }
    } finally {
      await mssql.close();
    }
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('❌ خطأ:', err && err.message ? err.message : err);
  process.exit(1);
});
