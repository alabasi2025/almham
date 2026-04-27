/**
 * تحليل طريقة تشفير كلمات السر في ECAS
 * يقرأ UserData و BILLING_MANAGERS_USERS من كلا القاعدتين
 * ويعرض القيم الخام ومحاولات فكّ التشفير
 */
import sql from 'mssql';
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, '..', '..', '.env') });

const DBS = ['Ecas2673', 'Ecas2668'];

async function connect(db) {
  const pool = new sql.ConnectionPool({
    server: 'localhost',
    user: 'almham_reader',
    password: 'AlhamRead@2026!',
    database: db,
    options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false },
  });
  await pool.connect();
  return pool;
}

function tryBase64(s) {
  if (!s) return null;
  try {
    const buf = Buffer.from(String(s), 'base64');
    const str = buf.toString('utf8');
    if (/^[\x20-\x7e]+$/.test(str)) return str;
    return null;
  } catch { return null; }
}

function tryHex(s) {
  if (!s) return null;
  try {
    const clean = String(s).replace(/\s/g, '');
    if (/^[0-9a-fA-F]+$/.test(clean) && clean.length % 2 === 0) {
      const str = Buffer.from(clean, 'hex').toString('utf8');
      if (/^[\x20-\x7e]+$/.test(str)) return str;
    }
    return null;
  } catch { return null; }
}

function charAnalysis(s) {
  if (!s) return {};
  const chars = String(s);
  return {
    length: chars.length,
    isAllDigits: /^\d+$/.test(chars),
    isAllAlpha: /^[A-Za-z]+$/.test(chars),
    isAllAlphaNum: /^[A-Za-z0-9]+$/.test(chars),
    hasUpper: /[A-Z]/.test(chars),
    hasLower: /[a-z]/.test(chars),
    looksLikeBase64: /^[A-Za-z0-9+\/]+=*$/.test(chars) && chars.length > 4,
    looksLikeHex: /^[0-9a-fA-F]+$/.test(chars) && chars.length % 2 === 0 && chars.length > 2,
    isPlainText: /^[\x20-\x7e\u0600-\u06ff]+$/.test(chars),
  };
}

async function main() {
  for (const db of DBS) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`📦 ${db}`);
    console.log('═'.repeat(80));

    const pool = await connect(db);
    try {
      // ── UserData ──
      console.log('\n── UserData ──');
      const ud = await pool.request().query('SELECT Us_ID, Us_Name, Us_PassWord, Us_PassWordHint FROM UserData ORDER BY Us_ID');
      for (const row of ud.recordset) {
        const pw = row.Us_PassWord ?? '';
        const info = charAnalysis(pw);
        const b64 = tryBase64(pw);
        const hex = tryHex(pw);
        console.log(`\n  Us_ID=${row.Us_ID}  Us_Name="${row.Us_Name}"`);
        console.log(`    Us_PassWord   = "${pw}"`);
        console.log(`    Hint          = "${row.Us_PassWordHint ?? ''}"`);
        console.log(`    Analysis      = ${JSON.stringify(info)}`);
        if (b64) console.log(`    Base64 decode = "${b64}"`);
        if (hex) console.log(`    Hex decode    = "${hex}"`);
      }

      // ── BILLING_MANAGERS_USERS ──
      console.log('\n── BILLING_MANAGERS_USERS ──');
      const bm = await pool.request().query('SELECT USER_NO, NAME, P, ADJECTIVE FROM BILLING_MANAGERS_USERS ORDER BY USER_NO');
      for (const row of bm.recordset) {
        const pw = row.P ?? '';
        const info = charAnalysis(pw);
        const b64 = tryBase64(pw);
        const hex = tryHex(pw);
        console.log(`\n  USER_NO=${row.USER_NO}  NAME="${row.NAME ?? '?'}"  ADJECTIVE="${row.ADJECTIVE ?? ''}"`);
        console.log(`    P (raw)       = "${pw}"`);
        console.log(`    Analysis      = ${JSON.stringify(info)}`);
        if (b64) console.log(`    Base64 decode = "${b64}"`);
        if (hex) console.log(`    Hex decode    = "${hex}"`);
      }
    } finally {
      await pool.close();
    }
  }

  // خلاصة
  console.log(`\n${'═'.repeat(80)}`);
  console.log('📋 الخلاصة:');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('UserData.Us_PassWord:');
  console.log('  - المستخدمون العاديون: نص عادي (123, 2023, 424666, ...)');
  console.log('  - Administrator: "nullandnotempty" = قيمة حارسة (كلمة السر مضمّنة في البرنامج)');
  console.log('');
  console.log('BILLING_MANAGERS_USERS.P:');
  console.log('  - الكل: Base64 لنص عادي');
  console.log('  - MTEyMjU1MTE → 11225511 (Administrator)');
  console.log('  - MTIzMTIz → 123123 (بقية المستخدمين)');
  console.log('');
  console.log('⚠️  لا يوجد تشفير حقيقي — فقط ترميز Base64 (ترميز وليس تشفير)');

  process.exit(0);
}

main().catch(e => { console.error('❌', e); process.exit(1); });
