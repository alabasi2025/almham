import 'dotenv/config';
import { ECAS_SOURCES, countTableRows, getCsvPath } from '../lib/ecas-csv.js';

const TABLES = [
  'Customer',
  'BillAndRaedData',
  'BillAndRaedDataHistorical',
  'PaymentData',
  'PaymentDataHistorical',
  'CashierData',
  'Squares',
  'Segel',
  'Area',
  'Branch',
];

function main() {
  console.log('فحص ملفات ECAS CSV لنظام الفوترة Web');
  console.log('');

  for (const source of ECAS_SOURCES) {
    console.log(`${source.label} (${source.dbName})`);
    for (const table of TABLES) {
      const count = countTableRows(source.dbName, table);
      console.log(`  ${table.padEnd(26)} ${count.toLocaleString('ar-YE')}`);
    }
    console.log(`  المسار: ${getCsvPath(source.dbName, 'Customer')}`);
    console.log('');
  }
}

main();
