/**
 * 🔐 اختبار أمني: كسر كلمة سر Administrator من جدول UserData
 *    (تسجيل الدخول لتطبيق سطح المكتب ECAS)
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

function isPrintable(s) {
  return s.length > 0 && /^[\x20-\x7E\u0600-\u06FF\u0750-\u077F\u0080-\u00FF]+$/.test(s);
}

function tryBase64(raw) {
  try {
    const buf = Buffer.from(raw, 'base64');
    return { utf8: buf.toString('utf8'), hex: buf.toString('hex'), bytes: [...buf] };
  } catch { return null; }
}

function tryXOR(bytes, key) {
  const keyBytes = typeof key === 'number' ? [key] : [...Buffer.from(String(key))];
  const result = bytes.map((b, i) => b ^ keyBytes[i % keyBytes.length]);
  return { text: Buffer.from(result).toString('utf8'), bytes: result };
}

function tryXORWithPosition(bytes) {
  // XOR مع موقع البايت (i, i+1, etc.)
  const results = [];
  for (let offset = 0; offset < 256; offset++) {
    const decoded = bytes.map((b, i) => b ^ ((i + offset) & 0xFF));
    const text = Buffer.from(decoded).toString('utf8');
    if (isPrintable(text)) results.push({ offset, text });
  }
  return results;
}

function analyzeBytes(bytes) {
  const freq = {};
  bytes.forEach(b => { freq[b] = (freq[b] || 0) + 1; });
  const entropy = -Object.values(freq).reduce((s, f) => {
    const p = f / bytes.length;
    return s + p * Math.log2(p);
  }, 0);
  return { freq, entropy, min: Math.min(...bytes), max: Math.max(...bytes), unique: Object.keys(freq).length };
}

// ═══════════════════════════════════════════
console.log('═'.repeat(65));
console.log('🔐 التحدي: كسر كلمة سر Administrator — تطبيق سطح المكتب');
console.log('   جدول: UserData.Us_PassWord');
console.log('═'.repeat(65));

for (const dbName of ECAS_DBS) {
  console.log(`\n${'═'.repeat(65)}`);
  console.log(`📦 قاعدة: ${dbName}`);
  console.log('═'.repeat(65));

  const pool = await getPool(dbName);
  try {
    // ─── 1. بنية الجدول ───
    const cols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'UserData'
      ORDER BY ORDINAL_POSITION
    `);
    console.log('\n📋 بنية جدول UserData:');
    for (const c of cols.recordset) {
      const mark = /pass/i.test(c.COLUMN_NAME) ? ' 🎯' : '';
      console.log(`   ${c.COLUMN_NAME.padEnd(30)} ${c.DATA_TYPE}(${c.CHARACTER_MAXIMUM_LENGTH ?? ''})${mark}`);
    }

    // ─── 2. كل المستخدمين ───
    console.log('\n📋 كل المستخدمين:');
    const allUsers = await pool.request().query(`
      SELECT RU_ID, RW_ID, Us_ID, Us_Name, Us_PassWord, Us_PassWordHint,
             Us_UpDateDate, Us_HaveRestrictedSomeID, Dev_Serl
      FROM UserData
      ORDER BY Us_ID
    `);

    for (const row of allUsers.recordset) {
      const name = String(row.Us_Name ?? '');
      const pw = row.Us_PassWord;
      const hint = row.Us_PassWordHint ?? '';
      const isAdmin = name.includes('Administrator') || row.Us_ID === -1;
      const marker = isAdmin ? '🎯' : '  ';

      let pwDisplay;
      if (pw === null || pw === undefined) {
        pwDisplay = '(null)';
      } else if (typeof pw === 'string' && pw.length === 0) {
        pwDisplay = '(empty string)';
      } else {
        const buf = Buffer.isBuffer(pw) ? pw : Buffer.from(String(pw));
        pwDisplay = `"${String(pw).substring(0, 40)}" [${buf.length}B, hex:${buf.toString('hex').substring(0, 40)}]`;
      }

      console.log(`${marker} [Us_ID=${String(row.Us_ID).padEnd(6)}] ${name.padEnd(35)} PW=${pwDisplay}  Hint="${hint}"`);
    }

    // ─── 3. التحليل العميق لـ Administrator ───
    const adminRow = allUsers.recordset.find(r => r.Us_ID === -1 || String(r.Us_Name ?? '').trim() === 'Administrator');
    if (!adminRow) {
      console.log('\n❌ Administrator غير موجود!');
      continue;
    }

    console.log('\n' + '─'.repeat(65));
    console.log('🔬 تحليل عميق — Administrator (Us_ID=' + adminRow.Us_ID + ')');
    console.log('─'.repeat(65));

    const pwRaw = adminRow.Us_PassWord;
    if (pwRaw === null || pwRaw === undefined) {
      console.log('   كلمة السر: NULL');
      console.log('   🤔 ربما كلمة السر مخزّنة في مكان آخر أو هي فارغة!');

      // نحاول نبحث في جداول أخرى
      console.log('\n   🔍 بحث في جداول أخرى عن كلمة سر Administrator...');
      const otherTables = ['CompInfoAndSysOption', 'DB_And_Sys_Info', 'Branch'];
      for (const tbl of otherTables) {
        try {
          const r = await pool.request().query(`SELECT * FROM [${tbl}]`);
          for (const row of r.recordset) {
            for (const [k, v] of Object.entries(row)) {
              if (/pass|pwd|secret/i.test(k) && v) {
                const buf = Buffer.isBuffer(v) ? v : Buffer.from(String(v));
                console.log(`      ${tbl}.${k} = hex:${buf.toString('hex')} (${buf.length}B)`);
              }
            }
          }
        } catch {}
      }
      continue;
    }

    // القيمة موجودة — نحللها
    const rawStr = String(pwRaw);
    const rawBuf = Buffer.isBuffer(pwRaw) ? pwRaw : Buffer.from(rawStr);
    const rawBytes = [...rawBuf];

    console.log(`\n   📝 القيمة الخام (string): "${rawStr}"`);
    console.log(`   📏 الطول: ${rawStr.length} حرف / ${rawBuf.length} بايت`);
    console.log(`   🔢 Hex: ${rawBuf.toString('hex')}`);
    console.log(`   🔢 Bytes: [${rawBytes.join(', ')}]`);
    console.log(`   🔢 Char codes: [${rawStr.split('').map(c => c.charCodeAt(0)).join(', ')}]`);

    const stats = analyzeBytes(rawBytes);
    console.log(`\n   📊 إحصائيات:`);
    console.log(`      الإنتروبيا: ${stats.entropy.toFixed(2)} bits/byte`);
    console.log(`      Min byte: ${stats.min} (0x${stats.min.toString(16)})`);
    console.log(`      Max byte: ${stats.max} (0x${stats.max.toString(16)})`);
    console.log(`      بايتات فريدة: ${stats.unique} / ${rawBytes.length}`);

    // ─── المحاولات ───

    // Base64
    console.log('\n   🧪 [1] Base64:');
    const b64 = tryBase64(rawStr);
    if (b64 && isPrintable(b64.utf8)) {
      console.log(`      🚨 "${b64.utf8}"`);
    } else if (b64) {
      console.log(`      Hex: ${b64.hex}`);
      console.log(`      ليس نص مقروء`);
    }

    // XOR مع مفاتيح
    console.log('\n   🧪 [2] XOR (بايت واحد 0x00-0xFF):');
    let xorHits = 0;
    for (let key = 0; key < 256; key++) {
      const r = tryXOR(rawBytes, key);
      if (isPrintable(r.text) && r.text !== rawStr) {
        console.log(`      XOR(0x${key.toString(16).padStart(2, '0')}) → "${r.text}"`);
        xorHits++;
        if (xorHits > 15) { console.log('      ...'); break; }
      }
    }

    // XOR مع كلمات مفتاحية
    console.log('\n   🧪 [3] XOR (كلمات مفتاحية):');
    const keys = ['ECAS', 'ecas', 'Admin', 'admin', 'Administrator', 'password',
      'Ecas2673', 'Ecas2668', 'System', 'system', 'PassWord', 'hexcell',
      'HexCell', 'HEXCELL', '123456', 'abcdef', 'master', 'sa'];
    for (const key of keys) {
      const r = tryXOR(rawBytes, key);
      if (isPrintable(r.text)) {
        console.log(`      XOR("${key}") → "${r.text}"`);
      }
    }

    // XOR مع الموقع
    console.log('\n   🧪 [4] XOR مع index (positional XOR):');
    const posResults = tryXORWithPosition(rawBytes);
    for (const r of posResults.slice(0, 10)) {
      console.log(`      XOR(i+${r.offset}) → "${r.text}"`);
    }

    // عكس + Base64
    console.log('\n   🧪 [5] عكس:');
    console.log(`      عكس النص: "${rawStr.split('').reverse().join('')}"`);
    console.log(`      عكس البايتات + Base64: "${Buffer.from([...rawBytes].reverse()).toString('base64')}"`);

    // ROT13 / Caesar
    console.log('\n   🧪 [6] ROT / Caesar:');
    for (let n = 1; n <= 25; n++) {
      const rotated = rawStr.split('').map(c => {
        const code = c.charCodeAt(0);
        if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + n) % 26) + 65);
        if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + n) % 26) + 97);
        if (code >= 48 && code <= 57) return String.fromCharCode(((code - 48 + n) % 10) + 48);
        return c;
      }).join('');
      if (isPrintable(rotated)) {
        console.log(`      ROT-${String(n).padStart(2)}: "${rotated}"`);
      }
    }

    // تحويل الأرقام
    console.log('\n   🧪 [7] تحويلات رقمية:');
    if (/^\d+$/.test(rawStr)) {
      console.log(`      كرقم: ${parseInt(rawStr, 10)}`);
      console.log(`      Hex→Dec: ${parseInt(rawStr, 16) || 'ليس hex صالح'}`);
    }
    // bytes كأرقام ASCII
    const asAsciiDigits = rawBytes.filter(b => b >= 48 && b <= 57).map(b => String.fromCharCode(b)).join('');
    if (asAsciiDigits) console.log(`      أرقام ASCII فقط: "${asAsciiDigits}"`);

    // ─── مقارنة مع كلمات شائعة ───
    console.log('\n   🧪 [8] مقارنة مباشرة (هل القيمة هي كلمة معروفة مُرمّزة؟):');
    const guesses = [
      'admin', 'Admin', 'administrator', 'Administrator', '123456', '12345678',
      '123', '1234', 'password', 'P@ssw0rd', '11225511', '123123',
      'system', 'System', 'SYSTEM', 'sa', 'master',
      '', ' ', 'null', 'ecas', 'ECAS',
    ];
    for (const guess of guesses) {
      const gBuf = Buffer.from(guess);
      const gB64 = gBuf.toString('base64');
      const gHex = gBuf.toString('hex');
      if (rawStr === guess) console.log(`      🚨 تطابق نص حرفي: "${guess}"`);
      if (rawStr === gB64) console.log(`      🚨 تطابق Base64("${guess}")`);
      if (rawBuf.toString('hex') === gHex) console.log(`      🚨 تطابق Hex("${guess}")`);
      // مقارنة XOR مع كل مفتاح بسيط
      for (let k = 1; k < 256; k++) {
        const xored = gBuf.map(b => b ^ k);
        if (Buffer.from(xored).equals(rawBuf)) {
          console.log(`      🚨 "${guess}" XOR 0x${k.toString(16)} = القيمة المخزّنة!`);
        }
      }
    }

    // ─── فحص varbinary ───
    console.log('\n   🧪 [9] فحص إذا كان الحقل varbinary:');
    try {
      const binResult = await pool.request().query(`
        SELECT CAST(Us_PassWord AS varbinary(MAX)) AS pw_bin,
               DATALENGTH(Us_PassWord) AS pw_len,
               LEN(Us_PassWord) AS pw_strlen
        FROM UserData
        WHERE Us_ID = ${adminRow.Us_ID}
      `);
      for (const row of binResult.recordset) {
        const bin = row.pw_bin;
        if (bin) {
          const buf = Buffer.isBuffer(bin) ? bin : Buffer.from(bin);
          console.log(`      varbinary hex: ${buf.toString('hex')}`);
          console.log(`      varbinary bytes: [${[...buf].join(', ')}]`);
          console.log(`      DATALENGTH: ${row.pw_len}`);
          console.log(`      LEN: ${row.pw_strlen}`);

          // نحاول فك هذا أيضاً
          const vBytes = [...buf];
          console.log('\n      🧪 XOR على varbinary:');
          for (let key = 0; key < 256; key++) {
            const decoded = vBytes.map(b => b ^ key);
            const text = Buffer.from(decoded).toString('utf8');
            if (isPrintable(text)) {
              console.log(`         XOR(0x${key.toString(16).padStart(2, '0')}) → "${text}"`);
            }
          }
        }
      }
    } catch (e) { console.log(`      خطأ: ${e.message}`); }

    // Hint
    console.log(`\n   💡 تلميح كلمة السر (Us_PassWordHint): "${adminRow.Us_PassWordHint ?? '(فارغ)'}"`);

  } finally {
    await pool.close();
  }
}

console.log('\n' + '═'.repeat(65));
console.log('✅ انتهى التحليل');
console.log('═'.repeat(65));

process.exit(0);
