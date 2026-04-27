/**
 * تجربة فعلية لكلمات سر SQL Server للمستخدم "Administrator"
 * + محاولة فك DB_PassWord الـ 14 بايت باستراتيجيات إضافية
 */
import sql from 'mssql';
import crypto from 'crypto';

const SERVER_BASE = {
  server: 'localhost',
  options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false },
  connectionTimeout: 5_000,
};

const CANDIDATES = [
  '11225511', 'mypassword4lonin', 'mypassword4login', 'nullandnotempty',
  'Administrator', 'admin', 'Admin', 'sa', '123', 'Ecas@123',
  'Ecas2668', 'Ecas@2668', 'Ecas@2668.zuc', 'Ecas2668@2026',
  'SabalyahEle', 'Sabalyah', 'Lit_SabalyahEle_$_2668@255',
  'zuakha033', 'YemenID', 'Challengers', 'Challengers@yahoo.com',
  'YIDedCheckLicnce07710114',
  '2668', '2673', 'dahmiya', 'Dahmiya', 'AlhamRead@2026!',
  'Pass@123', 'password', 'P@ssw0rd', '12345678',
  // تجربة الـ P باعتباره مشفّر مختلف
  'MTEyMjU1MTE',
  // أنماط شائعة يمنية
  'alabbasi', 'alabasi', 'العباسي',
];

const USERS = ['Administrator', 'ECASDEV\\Administrator', 'sa', 'administrator'];

async function tryLogin(user, password) {
  const pool = new sql.ConnectionPool({
    ...SERVER_BASE,
    database: 'master',
    user,
    password,
  });
  try {
    await pool.connect();
    await pool.close();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message.split('\n')[0].substring(0, 80) };
  }
}

async function main() {
  console.log('═══ جزء 1: تجربة SQL Server logins ═══\n');
  for (const user of USERS) {
    console.log(`── user: ${user} ──`);
    for (const pw of CANDIDATES) {
      const r = await tryLogin(user, pw);
      if (r.ok) {
        console.log(`  ⭐⭐⭐ MATCH! user="${user}" password="${pw}"`);
      }
    }
    console.log(`  (جُرّب ${CANDIDATES.length} كلمة سر، لا تطابق)`);
  }

  // ═══ جزء 2: محاولات إضافية لفك الـ 14 بايت ═══
  console.log('\n═══ جزء 2: فكّ DB_PassWord (14 بايت) ═══');
  const cipher = Buffer.from([0xd3, 0xb5, 0xf8, 0x31, 0x89, 0xc6, 0x39, 0x8c, 0x23, 0xed, 0xb1, 0x45, 0x37, 0xd0]);
  console.log(`cipher = ${[...cipher].map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

  // استراتيجية 1: addition mod 256 (ليس XOR) مع مفاتيح مختلفة
  console.log('\n── استراتيجية 1: plain = cipher - key (mod 256) ──');
  const keys = [
    'mypassword4lonin', 'mypassword4login', 'zuakha033', 'YemenID',
    'Challengers', 'Administrator', 'Ecas2668', 'Ecas@123',
    'Lit_SabalyahEle', 'Lit_Ecas2668', 'Ecas9220', '11225511',
    '1', 'A', 'E', String.fromCharCode(255), String.fromCharCode(170),
  ];
  for (const key of keys) {
    const keyBuf = Buffer.from(key, 'utf8');
    const out = Buffer.alloc(14);
    for (let i = 0; i < 14; i++) {
      out[i] = (cipher[i] - keyBuf[i % keyBuf.length] + 256) % 256;
    }
    const str = out.toString('latin1');
    const printable = [...out].filter(b => b >= 0x20 && b <= 0x7e).length;
    if (printable >= 12) {
      console.log(`  key="${key}" → "${str.replace(/[\x00-\x1f]/g, '·')}" (${printable}/14 printable)`);
    }
  }

  // استراتيجية 2: addition mod 256 (عكسي)
  console.log('\n── استراتيجية 2: plain = key - cipher (mod 256) ──');
  for (const key of keys) {
    const keyBuf = Buffer.from(key, 'utf8');
    const out = Buffer.alloc(14);
    for (let i = 0; i < 14; i++) {
      out[i] = (keyBuf[i % keyBuf.length] - cipher[i] + 256) % 256;
    }
    const str = out.toString('latin1');
    const printable = [...out].filter(b => b >= 0x20 && b <= 0x7e).length;
    if (printable >= 12) {
      console.log(`  key="${key}" → "${str.replace(/[\x00-\x1f]/g, '·')}" (${printable}/14 printable)`);
    }
  }

  // استراتيجية 3: كل بايت بعد عكس البتات (bit reversal)
  console.log('\n── استراتيجية 3: bit reversal ──');
  function reverseBits(b) {
    let r = 0;
    for (let i = 0; i < 8; i++) r = (r << 1) | ((b >> i) & 1);
    return r & 0xff;
  }
  const revBits = Buffer.from([...cipher].map(reverseBits));
  console.log(`  ${revBits.toString('latin1').replace(/[\x00-\x1f]/g, '·')} (${[...revBits].filter(b => b >= 0x20 && b <= 0x7e).length}/14 printable)`);

  // استراتيجية 4: NOT (complement)
  console.log('\n── استراتيجية 4: bitwise NOT ──');
  const notBytes = Buffer.from([...cipher].map(b => (~b) & 0xff));
  console.log(`  ${notBytes.toString('latin1').replace(/[\x00-\x1f]/g, '·')} (${[...notBytes].filter(b => b >= 0x20 && b <= 0x7e).length}/14 printable)`);

  // استراتيجية 5: Windows-1256 decode
  console.log('\n── استراتيجية 5: Windows-1256 decode ──');
  try {
    const arabic = new TextDecoder('windows-1256').decode(cipher);
    console.log(`  "${arabic}"`);
  } catch (e) { console.log(`  ${e.message}`); }

  // استراتيجية 6: عكس الترتيب ثم XOR بمفتاح
  console.log('\n── استراتيجية 6: reverse + XOR with known keys ──');
  const revCipher = Buffer.from([...cipher].reverse());
  for (const key of keys) {
    const keyBuf = Buffer.from(key, 'utf8');
    const out = Buffer.alloc(14);
    for (let i = 0; i < 14; i++) out[i] = revCipher[i] ^ keyBuf[i % keyBuf.length];
    const printable = [...out].filter(b => b >= 0x20 && b <= 0x7e).length;
    if (printable >= 12) {
      console.log(`  key="${key}" → "${out.toString('latin1').replace(/[\x00-\x1f]/g, '·')}" (${printable}/14)`);
    }
  }

  // استراتيجية 7: كل بايتين swap ثم محاولة
  console.log('\n── استراتيجية 7: byte pair swap ──');
  const swapped = Buffer.alloc(14);
  for (let i = 0; i < 14; i += 2) {
    swapped[i] = cipher[i + 1] ?? 0;
    swapped[i + 1] = cipher[i];
  }
  console.log(`  swapped hex: ${[...swapped].map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

  // استراتيجية 8: Base64 من cipher كـ ASCII → decode
  console.log('\n── استراتيجية 8: base64 of cipher bytes ──');
  console.log(`  base64: "${cipher.toString('base64')}"`);
  console.log(`  hex:    "${cipher.toString('hex')}"`);

  // استراتيجية 9: XOR بـ MOBSERL (الأدمن)
  console.log('\n── استراتيجية 9: XOR with MOBSERL hex bytes ──');
  const mobserlAdmin = Buffer.from('3647081526bc30c8', 'hex');
  const mobserlAdmin2 = Buffer.from('4161fbe0f94da0ed', 'hex');
  for (const [name, m] of [['admin', mobserlAdmin], ['admin2', mobserlAdmin2]]) {
    const out = Buffer.alloc(14);
    for (let i = 0; i < 14; i++) out[i] = cipher[i] ^ m[i % m.length];
    const printable = [...out].filter(b => b >= 0x20 && b <= 0x7e).length;
    console.log(`  MOBSERL-${name}: "${out.toString('latin1').replace(/[\x00-\x1f]/g, '·')}" (${printable}/14)`);
  }

  // استراتيجية 10: plaintext من الأنماط الشائعة
  console.log('\n── استراتيجية 10: هل cipher = f(plaintext) لـ plaintext معروف؟ ──');
  const plaintextGuesses = [
    'Ecas@123', '11225511', 'Ecas2668', 'mypassword4lon', 'mypassword4loni',
    'administrator', 'Administrator', 'Challengers12', 'yemenid@company',
  ];
  for (const pt of plaintextGuesses) {
    const ptBuf = Buffer.from(pt.padEnd(14, '\0'), 'utf8').subarray(0, 14);
    // محاولة: cipher = plaintext XOR key مع key ثابت 14 بايت
    // الـ key الناتج:
    const key = Buffer.alloc(14);
    for (let i = 0; i < 14; i++) key[i] = cipher[i] ^ ptBuf[i];
    const keyPrintable = [...key].filter(b => b >= 0x20 && b <= 0x7e).length;
    if (keyPrintable >= 10) {
      console.log(`  plaintext="${pt}" → key: "${key.toString('latin1').replace(/[\x00-\x1f]/g, '·')}" hex=${key.toString('hex')}`);
    }
  }

  console.log('\n✅ انتهى');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
