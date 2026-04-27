/**
 * Stage 01 — تهيئة المحطات الأربع + فهرس شاشات ECAS
 *
 * المحطات: الدهمية، الصبالية، جمال، غليل
 * فهرس الشاشات: 174 شاشة من ecas-forms.txt
 */
import { pgClient, startTimer } from './lib.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const STATIONS = [
  { code: 'dahamiya', name: 'محطة الدهمية',      ecasDb: 'Ecas2673', sortOrder: 1 },
  { code: 'sabaliya', name: 'محطة الصبالية',     ecasDb: 'Ecas2668', sortOrder: 2 },
  { code: 'jamal',    name: 'محطة جمال',         ecasDb: 'Ecas2668', sortOrder: 3 },
  { code: 'ghalil',   name: 'محطة غليل',         ecasDb: 'Ecas2668', sortOrder: 4 },
];

function parseForms() {
  const txt = readFileSync(join(__dirname, '..', '..', '..', 'imports', 'ecas-forms.txt'), 'utf8');
  const rows = [];
  for (const line of txt.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('COLUMNS:')) continue;
    const parts = line.split('|').map((s) => s.trim());
    if (parts.length < 5) continue;
    const [rankStr, idStr, name, menu, menuIndexStr] = parts;
    const code = Number(idStr);
    if (!Number.isFinite(code) || code <= 0) continue;
    rows.push({
      code,
      name,
      menuKey: menu && menu !== '#' ? menu : null,
      menuIndex: Number(menuIndexStr) || null,
      rankId: Number(rankStr) || 0,
    });
  }
  return rows;
}

async function main() {
  const t = startTimer();
  const pg = pgClient();
  try {
    console.log('🏭 تهيئة المحطات...');
    for (const s of STATIONS) {
      await pg`
        INSERT INTO billing_stations (code, name, ecas_db, sort_order)
        VALUES (${s.code}, ${s.name}, ${s.ecasDb}, ${s.sortOrder})
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          ecas_db = EXCLUDED.ecas_db,
          sort_order = EXCLUDED.sort_order
      `;
      console.log(`  ✓ ${s.name}`);
    }

    console.log('\n📋 تهيئة فهرس شاشات ECAS...');
    const forms = parseForms();
    let n = 0;
    for (const f of forms) {
      await pg`
        INSERT INTO billing_screens (code, name, menu_key, menu_index, rank_id)
        VALUES (${f.code}, ${f.name}, ${f.menuKey}, ${f.menuIndex}, ${f.rankId})
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          menu_key = EXCLUDED.menu_key,
          menu_index = EXCLUDED.menu_index,
          rank_id = EXCLUDED.rank_id
      `;
      n++;
    }
    console.log(`  ✓ ${n} شاشة`);

    console.log(`\n✅ تمّ في ${t.elapsed()}`);
  } finally {
    await pg.end();
  }
}

main().catch((err) => { console.error('❌', err); process.exit(1); });
