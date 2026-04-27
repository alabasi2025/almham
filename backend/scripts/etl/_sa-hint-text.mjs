/**
 * كلمة السر = نص التلميح نفسه؟
 */
import sql from 'mssql';

const BASE = {
  server: 'localhost',
  options: { instanceName: 'ECASDEV', trustServerCertificate: true, encrypt: false },
  connectionTimeout: 3_000,
};

async function tryLogin(user, pw) {
  const pool = new sql.ConnectionPool({ ...BASE, database: 'master', user, password: pw });
  try { await pool.connect(); await pool.close(); return true; } catch { return false; }
}

const candidates = [
  // "Admin_Store" variations
  'Admin_Store', 'admin_store', 'AdminStore', 'adminstore',
  'ADMIN_STORE', 'ADMINSTORE', 'Admin Store', 'admin store',
  'AdminStor', 'adminstor', 'admin_stor', 'Admin_Stor',
  'admstor', 'AdmStor', 'adm_stor',
  // الادمن ستور في عربي/مخلوط
  'الادمن ستور', 'الادمن_ستور', 'الادمنستور',
  'al_admin_store', 'AlAdminStore', 'aladminstore',
  // "same password"
  'same', 'nafs', 'نفس', 'نفسها',
  'samepassword', 'SamePassword', 'same_password',
  // "store admin"
  'StoreAdmin', 'storeadmin', 'Store_Admin', 'store_admin',
  'StorAdmin', 'storadmin',
  // "database admin"
  'dbadmin', 'DbAdmin', 'DBAdmin', 'db_admin',
  'DatabaseAdmin', 'databaseadmin', 'dbo',
  // SQL-specific short
  'dbo', 'master', 'Master', 'public',
  // "Administrator" with stor suffix
  'AdministratorStore', 'Administrator_Store', 'administrator_store',
  // Hint as one line
  'الادمنستور', 'adminstor2026', 'Admin_Store2026',
  // Mohammed's name variations
  'mohammed', 'Mohammed', 'Mo7ammed', 'muhammad', 'Muhammad',
  'm7md', 'M7MD', 'mhmd', 'MHMD',
  'محمدالعباسي', 'mohammedalabbasi', 'MohammedAlabbasi',
  // Project-specific
  'almham', 'alhamham', 'alhambh', 'AlhamSystem',
  // Yemen
  'sanaa', 'sana', 'Yemen2026', 'YEM',
  // Password re-used from srv-fix (literal hash?)
  'nullandnotempty', 'Nullandnotempty', 'NULLANDNOTEMPTY',
  'NullAndNotEmpty', 'null-and-not-empty',
  // Test account common passwords
  'Passw0rd', 'Passw0rd!', 'P@ssw0rd1', 'Password1',
  'Password1!', 'P@ssword1', 'Passw0rd123',
  // "developer mode"
  'dev', 'Dev', 'DEV', 'devmode', 'developer',
  'ECASDEV', 'EcasDev', 'ecasdev',
  // Just the instance name
  'ECASDEV!', 'ECASDEV@', 'Ecas@DEV', 'EcasDEV2026',
];

async function main() {
  console.log(`┌─ ${candidates.length} نص من التلميح/السياق ─┐\n`);
  for (const pw of candidates) {
    const ok = await tryLogin('sa', pw);
    if (ok) {
      console.log(`\n⭐⭐⭐ MATCH: sa / "${pw}"`);
      process.exit(0);
    }
  }
  console.log(`\n(${candidates.length}: لا تطابق)`);
}

main().catch(e => { console.error(e); process.exit(1); });
