/**
 * 🔐 اختبار أمني شامل: محاولة كسر تشفير كلمة سر Administrator في ECAS
 *
 * يتصل بـ SQL Server ويستخرج كل البيانات المتعلقة بكلمة السر
 * ثم يحاول كسرها بعدة طرق:
 *   1. فك Base64
 *   2. فك XOR بمفاتيح شائعة
 *   3. فك ROT / Caesar
 *   4. تحليل Hex
 *   5. فك UTF-16 / Windows-1256
 *   6. هجوم قاموس
 *   7. تحليل النمط
 *
 * الاستخدام:
 *   node scripts/test-ecas-password-crack.mjs
 */
import sql from 'mssql';

const ECAS_DBS = ['Ecas2673', 'Ecas2668'];

async function getPool(dbName) {
  const pool = new sql.ConnectionPool({
    server: 'localhost',
    user: 'almham_reader',
    password: 'AlhamRead@2026!',
    database: dbName,
    options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false },
    connectionTimeout: 15_000,
    requestTimeout: 60_000,
  });
  await pool.connect();
  return pool;
}

// ═══════════════════════════════════════════
// أدوات فك التشفير
// ═══════════════════════════════════════════

function tryBase64(raw) {
  try {
    const buf = Buffer.from(raw, 'base64');
    const utf8 = buf.toString('utf8');
    const ascii = buf.toString('ascii');
    const latin1 = buf.toString('latin1');
    return { utf8, ascii, latin1, hex: buf.toString('hex'), bytes: [...buf] };
  } catch { return null; }
}

function tryXOR(bytes, key) {
  const keyBytes = typeof key === 'number' ? [key] : [...Buffer.from(String(key))];
  const result = bytes.map((b, i) => b ^ keyBytes[i % keyBytes.length]);
  return Buffer.from(result).toString('utf8');
}

function tryROT(str, n) {
  return str.split('').map(c => {
    const code = c.charCodeAt(0);
    if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + n) % 26) + 65);
    if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + n) % 26) + 97);
    if (code >= 48 && code <= 57) return String.fromCharCode(((code - 48 + n) % 10) + 48);
    return c;
  }).join('');
}

function reverseString(s) { return s.split('').reverse().join(''); }

function isPrintable(s) {
  return /^[\x20-\x7E\u0600-\u06FF\u0750-\u077F]+$/.test(s);
}

function analyzePattern(bytes) {
  const patterns = {
    allSame: bytes.every(b => b === bytes[0]),
    sequential: bytes.every((b, i) => i === 0 || b === bytes[i - 1] + 1),
    repeating: null,
    entropy: 0,
  };

  // حساب الإنتروبيا
  const freq = {};
  bytes.forEach(b => { freq[b] = (freq[b] || 0) + 1; });
  const len = bytes.length;
  patterns.entropy = -Object.values(freq).reduce((s, f) => {
    const p = f / len;
    return s + p * Math.log2(p);
  }, 0);

  // كشف التكرار
  for (let period = 1; period <= Math.floor(len / 2); period++) {
    let repeats = true;
    for (let i = period; i < len; i++) {
      if (bytes[i] !== bytes[i % period]) { repeats = false; break; }
    }
    if (repeats) { patterns.repeating = period; break; }
  }

  return patterns;
}

// ═══════════════════════════════════════════
// الفحص الرئيسي
// ═══════════════════════════════════════════

async function analyzeDatabase(dbName) {
  console.log(`\n${'═'.repeat(65)}`);
  console.log(`📦 قاعدة: ${dbName}`);
  console.log('═'.repeat(65));

  const pool = await getPool(dbName);
  try {
    // ─── جلب من BILLING_MANAGERS_USERS ───
    console.log('\n📋 جدول BILLING_MANAGERS_USERS:');
    const bmResult = await pool.request().query(`
      SELECT USER_NO, NAME, P, STATUS, ISMANAGER, ADJECTIVE
      FROM BILLING_MANAGERS_USERS
      ORDER BY USER_NO
    `);

    const adminRows = bmResult.recordset.filter(r =>
      String(r.NAME ?? '').includes('Administrator') ||
      String(r.NAME ?? '').includes('admin') ||
      String(r.NAME ?? '').includes('مدير')
    );

    for (const row of bmResult.recordset) {
      const name = String(row.NAME ?? '').trim();
      const pwRaw = row.P;
      const isAdmin = name.includes('Administrator') || name.includes('مدير');
      const marker = isAdmin ? '🎯' : '  ';
      console.log(`${marker} [${row.USER_NO}] ${name.padEnd(30)} P="${pwRaw ?? '(null)'}" status=${row.STATUS}`);
    }

    // ─── جلب من جدول المستخدمين الرئيسي ───
    console.log('\n📋 جداول أخرى تحتوي كلمات سر:');
    const tables = [
      'Sys_Users', 'Users', 'CompInfoAndSysOption',
      'DB_And_Sys_Info', 'Branch',
    ];

    for (const tbl of tables) {
      try {
        const cols = await pool.request().query(`
          SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = '${tbl}'
          AND (COLUMN_NAME LIKE '%Pass%' OR COLUMN_NAME LIKE '%pwd%' OR COLUMN_NAME LIKE '%password%' OR COLUMN_NAME LIKE '%P')
        `);
        if (cols.recordset.length > 0) {
          const colNames = cols.recordset.map(c => c.COLUMN_NAME);
          console.log(`   📂 ${tbl}: أعمدة مرتبطة بكلمة السر → [${colNames.join(', ')}]`);

          const data = await pool.request().query(`SELECT TOP 10 * FROM [${tbl}]`);
          for (const row of data.recordset) {
            for (const col of colNames) {
              if (row[col] !== null && row[col] !== undefined) {
                console.log(`      ${col} = "${row[col]}"`);
              }
            }
          }
        }
      } catch { /* الجدول غير موجود */ }
    }

    // ─── تحليل واختبار كسر Administrator ───
    console.log('\n' + '─'.repeat(65));
    console.log('🔬 تحليل كلمة سر Administrator:');
    console.log('─'.repeat(65));

    // نجلب Administrator من BILLING_MANAGERS_USERS
    const adminBM = bmResult.recordset.find(r => String(r.NAME ?? '').trim() === 'Administrator');
    if (!adminBM) {
      console.log('   ❌ Administrator غير موجود في BILLING_MANAGERS_USERS');
    } else {
      const raw = adminBM.P;
      if (!raw) {
        console.log('   ⚠️  حقل P فارغ (null) لـ Administrator');
      } else {
        const rawStr = String(raw);
        const rawBytes = Buffer.from(rawStr);

        console.log(`\n   📝 القيمة الخام: "${rawStr}"`);
        console.log(`   📏 الطول: ${rawStr.length} حرف / ${rawBytes.length} بايت`);
        console.log(`   🔢 Hex: ${rawBytes.toString('hex')}`);
        console.log(`   🔢 Bytes: [${[...rawBytes].join(', ')}]`);

        // تحليل النمط
        const pattern = analyzePattern([...rawBytes]);
        console.log(`\n   📊 تحليل النمط:`);
        console.log(`      الإنتروبيا: ${pattern.entropy.toFixed(2)} bits/byte`);
        console.log(`      كل البايتات متساوية: ${pattern.allSame ? 'نعم ❌' : 'لا ✅'}`);
        console.log(`      تسلسل: ${pattern.sequential ? 'نعم ❌' : 'لا ✅'}`);
        console.log(`      تكرار دوري: ${pattern.repeating ? `نعم (كل ${pattern.repeating} بايت) ❌` : 'لا ✅'}`);

        // ─── المحاولة 1: Base64 ───
        console.log('\n   🧪 المحاولة 1 — فك Base64:');
        const b64 = tryBase64(rawStr);
        if (b64) {
          console.log(`      UTF-8:  "${b64.utf8}" ${isPrintable(b64.utf8) ? '⚠️ مقروء!' : ''}`);
          console.log(`      ASCII:  "${b64.ascii}" ${isPrintable(b64.ascii) ? '⚠️ مقروء!' : ''}`);
          console.log(`      Latin1: "${b64.latin1}" ${isPrintable(b64.latin1) ? '⚠️ مقروء!' : ''}`);
          console.log(`      Hex:    ${b64.hex}`);
          console.log(`      Bytes:  [${b64.bytes.join(', ')}]`);
        }

        // ─── المحاولة 2: XOR ───
        console.log('\n   🧪 المحاولة 2 — فك XOR بمفاتيح شائعة:');
        const xorKeys = [
          0x00, 0xFF, 0xAA, 0x55, 0x42, 0x13, 0x37, 0x69,
          0x01, 0x02, 0x0F, 0x10, 0x1F, 0x20, 0x7F, 0x80,
          ...Array.from({ length: 26 }, (_, i) => 65 + i), // A-Z
          ...Array.from({ length: 10 }, (_, i) => 48 + i), // 0-9
        ];
        const stringKeys = ['ECAS', 'ecas', 'Admin', 'admin', 'password', 'Ecas2673', 'Ecas2668', 'Administrator', '11225511', '123'];

        let xorFound = [];
        for (const key of xorKeys) {
          const result = tryXOR([...rawBytes], key);
          if (isPrintable(result) && result !== rawStr) {
            xorFound.push({ key: `0x${key.toString(16).padStart(2, '0')}`, result });
          }
        }
        for (const key of stringKeys) {
          const result = tryXOR([...rawBytes], key);
          if (isPrintable(result) && result !== rawStr) {
            xorFound.push({ key: `"${key}"`, result });
          }
        }

        // نأخذ أيضاً البايتات بعد Base64 decode
        if (b64) {
          for (const key of xorKeys) {
            const result = tryXOR(b64.bytes, key);
            if (isPrintable(result)) {
              xorFound.push({ key: `b64+0x${key.toString(16).padStart(2, '0')}`, result });
            }
          }
          for (const key of stringKeys) {
            const result = tryXOR(b64.bytes, key);
            if (isPrintable(result)) {
              xorFound.push({ key: `b64+"${key}"`, result });
            }
          }
        }

        if (xorFound.length > 0) {
          for (const { key, result } of xorFound.slice(0, 20)) {
            console.log(`      XOR(${key}) → "${result}" ⚠️`);
          }
          if (xorFound.length > 20) console.log(`      ... و ${xorFound.length - 20} نتيجة أخرى`);
        } else {
          console.log('      لا نتائج مقروءة ✅');
        }

        // ─── المحاولة 3: ROT / Caesar ───
        console.log('\n   🧪 المحاولة 3 — ROT / Caesar:');
        for (let n = 1; n <= 25; n++) {
          const rotated = tryROT(rawStr, n);
          if (rotated !== rawStr && isPrintable(rotated)) {
            console.log(`      ROT-${n}: "${rotated}"`);
          }
        }
        console.log(`      عكس: "${reverseString(rawStr)}"`);

        // ─── المحاولة 4: UTF-16 ───
        console.log('\n   🧪 المحاولة 4 — UTF-16:');
        try {
          const utf16le = Buffer.from(rawStr).swap16?.() || rawBytes;
          console.log(`      UTF-16LE: "${utf16le.toString('utf16le')}"`);
        } catch (e) { console.log(`      UTF-16: فشل (${e.message})`); }

        // ─── المحاولة 5: فك تشفير ECAS المعروف ───
        console.log('\n   🧪 المحاولة 5 — خوارزميات ECAS المعروفة:');

        // ECAS عادة يستخدم Base64 بسيط لحقل P
        if (b64 && isPrintable(b64.utf8)) {
          console.log(`      🚨 Base64 → "${b64.utf8}" — هذه كلمة السر!`);
        }

        // أيضاً نحاول فك Windows-1256
        console.log('\n   🧪 المحاولة 6 — Windows-1256 / Arabic codepage:');
        try {
          const win1256 = rawBytes.toString('latin1'); // قريب من Windows-1256
          console.log(`      Latin1/Win1256: "${win1256}"`);
        } catch {}

        // ─── المحاولة 7: هجوم قاموس ───
        console.log('\n   🧪 المحاولة 7 — مقارنة مع كلمات سر شائعة (Base64 مُشفّرة):');
        const dictPasswords = [
          'admin', 'Admin', 'administrator', 'Administrator',
          '123456', '12345678', '123', '1234', 'password', 'P@ssw0rd',
          '11225511', '123123', '2664', '2668', '2673', '1994', '2023',
          'almham', 'ecas', 'ECAS', 'system', 'System',
          '424666', '10120101', 'hgtjhpd78',
          'admin123', 'Admin123', 'root', 'sa', 'master',
          'العباسي', 'مدير', 'كلمة', '',
        ];
        for (const pw of dictPasswords) {
          const b64enc = Buffer.from(pw).toString('base64');
          if (b64enc === rawStr) {
            console.log(`      🚨🚨 تطابق! "${pw}" → Base64 = "${b64enc}" = القيمة المخزّنة!`);
          }
        }
      }
    }

    // ─── فحص DB_PassWord (كلمة سر قاعدة البيانات نفسها) ───
    console.log('\n' + '─'.repeat(65));
    console.log('🔬 تحليل كلمة سر قاعدة البيانات (DB_PassWord):');
    console.log('─'.repeat(65));

    try {
      const dbInfo = await pool.request().query(`
        SELECT DB_PassWord, DB_Name FROM DB_And_Sys_Info
      `);
      for (const row of dbInfo.recordset) {
        const raw = row.DB_PassWord;
        if (!raw) continue;
        const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw), 'binary');
        console.log(`   DB: ${row.DB_Name}`);
        console.log(`   Raw length: ${buf.length} bytes`);
        console.log(`   Hex: ${buf.toString('hex')}`);
        console.log(`   Bytes: [${[...buf].join(', ')}]`);

        // تحليل
        const pattern = analyzePattern([...buf]);
        console.log(`   Entropy: ${pattern.entropy.toFixed(2)} bits/byte`);

        // محاولة XOR
        for (const key of [0xFF, 0xAA, 0x55, ...stringKeys.map(s => s)]) {
          const numKey = typeof key === 'number' ? key : 0;
          if (typeof key === 'number') {
            const decoded = tryXOR([...buf], key);
            if (isPrintable(decoded)) {
              console.log(`   XOR(0x${key.toString(16)}) → "${decoded}" ⚠️`);
            }
          }
        }
      }
    } catch { console.log('   ❌ جدول DB_And_Sys_Info غير متاح'); }

    // ─── فحص Sys_Users ───
    console.log('\n' + '─'.repeat(65));
    console.log('🔬 تحليل Sys_Users (إن وجد):');
    console.log('─'.repeat(65));

    try {
      // نبحث عن الجدول الذي يحتوي كلمات سر المستخدمين
      const sysTables = await pool.request().query(`
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME LIKE '%User%' OR TABLE_NAME LIKE '%user%'
      `);
      console.log(`   جداول المستخدمين: ${sysTables.recordset.map(r => r.TABLE_NAME).join(', ')}`);

      for (const { TABLE_NAME } of sysTables.recordset) {
        const cols = await pool.request().query(`
          SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = '${TABLE_NAME}'
        `);
        const pwCols = cols.recordset.filter(c =>
          /pass|pwd|secret|key|hash|crypt/i.test(c.COLUMN_NAME)
        );
        if (pwCols.length > 0) {
          console.log(`\n   📂 ${TABLE_NAME}:`);
          console.log(`      أعمدة كلمات السر: ${pwCols.map(c => `${c.COLUMN_NAME} (${c.DATA_TYPE})`).join(', ')}`);

          const data = await pool.request().query(`
            SELECT * FROM [${TABLE_NAME}]
            WHERE [${cols.recordset[0].COLUMN_NAME}] LIKE '%Admin%'
               OR [${cols.recordset[0].COLUMN_NAME}] LIKE '%admin%'
               OR [${cols.recordset[0].COLUMN_NAME}] = -1
          `).catch(() => pool.request().query(`SELECT TOP 5 * FROM [${TABLE_NAME}]`));

          for (const row of data.recordset) {
            console.log(`\n      سجل: ${JSON.stringify(row).substring(0, 200)}`);
            for (const { COLUMN_NAME } of pwCols) {
              const val = row[COLUMN_NAME];
              if (val === null || val === undefined) continue;
              const raw = Buffer.isBuffer(val) ? val : Buffer.from(String(val));
              console.log(`      ${COLUMN_NAME} = "${val}" (hex: ${raw.toString('hex')})`);

              // محاولة Base64
              const b = tryBase64(String(val));
              if (b && isPrintable(b.utf8)) {
                console.log(`         Base64 decode → "${b.utf8}" ⚠️`);
              }
            }
          }
        }
      }
    } catch (e) { console.log(`   ❌ خطأ: ${e.message}`); }

    // ─── بحث عن أي أعمدة تحتوي كلمة Pass في كل الجداول ───
    console.log('\n' + '─'.repeat(65));
    console.log('🔍 مسح شامل: كل الأعمدة المرتبطة بكلمات السر:');
    console.log('─'.repeat(65));

    const allPwCols = await pool.request().query(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE COLUMN_NAME LIKE '%Pass%'
         OR COLUMN_NAME LIKE '%pwd%'
         OR COLUMN_NAME LIKE '%secret%'
         OR COLUMN_NAME LIKE '%crypt%'
      ORDER BY TABLE_NAME
    `);
    for (const { TABLE_NAME, COLUMN_NAME, DATA_TYPE } of allPwCols.recordset) {
      console.log(`   ${TABLE_NAME}.${COLUMN_NAME} (${DATA_TYPE})`);
    }

  } finally {
    await pool.close();
  }
}

// ═══════════════════════════════════════════
// التشغيل
// ═══════════════════════════════════════════

console.log('═'.repeat(65));
console.log('🔐 اختبار أمان كلمات السر — نظام ECAS (SQL Server)');
console.log('═'.repeat(65));
console.log('الهدف: كشف كلمة سر Administrator بكل الطرق المتاحة');
console.log('');

for (const db of ECAS_DBS) {
  try {
    await analyzeDatabase(db);
  } catch (err) {
    console.error(`❌ فشل الاتصال بـ ${db}: ${err.message}`);
  }
}

console.log('\n' + '═'.repeat(65));
console.log('📊 النتيجة النهائية');
console.log('═'.repeat(65));
console.log(`
ملاحظات أمنية عن نظام ECAS:
  1. كلمات السر العادية مخزّنة بـ Base64 فقط — وهذا ليس تشفيراً!
     Base64 هو ترميز (encoding) وليس تشفير (encryption)
     يمكن عكسه فوراً بدون مفتاح.

  2. حقل DB_PassWord يستخدم تشفير XOR بسيط
     XOR بمفتاح ثابت يمكن كسره في ثوانٍ.

  3. لا يوجد hashing (مثل bcrypt/scrypt/argon2)
     = كل كلمات السر قابلة للاسترجاع مباشرة.

  ⚠️  نظامنا الجديد (أنظمة العباسي) يستخدم bcrypt بـ 10 جولات
     وهو أفضل بكثير — لكن يمكن تعزيزه أكثر.
`);

process.exit(0);
