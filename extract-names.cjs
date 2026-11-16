// extract-names.cjs
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'data-finalised');
const OUT_TXT = path.join(__dirname, 'product-names.txt');
const OUT_JSON = path.join(__dirname, 'product-names.json');

const files = fs.readdirSync(SRC)
  .filter(f => f.endsWith('.json'))
  .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));

const rows = [];
let missingName = 0;
let missingOem = 0;

for (const f of files) {
  const p = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
  const name    = String(p.name    || '').trim();
  const oemRef  = String(p.oemRef  || '').trim();
  const subtitle = String(p.subtitle || '').trim();

  if (!name)   missingName++;
  if (!oemRef) missingOem++;

  rows.push({
    file: f,
    id: p.id || f.replace('.json', ''),
    oemRef,
    name,
    subtitle,
  });
}

// --- Plain text: "oemRef | name" one per line ---
fs.writeFileSync(
  OUT_TXT,
  rows.map(r => `${r.oemRef || '-'} | ${r.name}`).join('\n') + '\n',
  'utf8'
);

// --- Structured JSON ---
fs.writeFileSync(OUT_JSON, JSON.stringify(rows, null, 2), 'utf8');

console.log(`\n✅ Extracted ${rows.length} entries`);
if (missingName) console.log(`⚠️  ${missingName} files with empty name`);
if (missingOem)  console.log(`⚠️  ${missingOem} files with empty oemRef`);
console.log(`📄 ${OUT_TXT}`);
console.log(`📄 ${OUT_JSON}\n`);

console.log('First 5:');
rows.slice(0, 5).forEach(r =>
  console.log(`  ${r.id.padEnd(8)} ${r.oemRef.padEnd(14)} ${r.name}`)
);