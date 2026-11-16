const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const BACKUP_DIR = path.join(
  __dirname,
  `data-backup-domain-${new Date().toISOString().replace(/[:.]/g, '-')}`
);

// Replace "royalspares.co.in" → "royalspares.in", case-insensitive,
// preserving the case of the "royalspares" part.
// Also catches "royal-spares.co.in" and "RoyalSpares.co.in".
function fixString(str) {
  return str.replace(
    /(royal[-\s]?spares)\.co\.in/gi,
    (match, brand) => `${brand}.in`
  );
}

function deepFix(value) {
  if (typeof value === 'string') return fixString(value);
  if (Array.isArray(value)) return value.map(deepFix);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[fixString(k)] = deepFix(v);
    }
    return out;
  }
  return value;
}

function main() {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  if (!files.length) return console.log('❌ No JSON files in data/');

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  let touched = 0;
  let counter = 0;

  for (const file of files) {
    const full = path.join(DATA_DIR, file);
    const raw = fs.readFileSync(full, 'utf8');
    const fixed = fixString(raw); // string-level replace handles URLs/keys/values uniformly

    if (fixed !== raw) {
      // Backup only the files we're about to change
      fs.copyFileSync(full, path.join(BACKUP_DIR, file));
      fs.writeFileSync(full, fixed, 'utf8');
      touched++;
    }

    if (++counter % 500 === 0 || counter === files.length) {
      console.log(`  scanned ${counter}/${files.length}, changed ${touched}`);
    }
  }

  console.log(`\n✅ Done. ${touched} files updated.`);
  if (touched) console.log(`   Backup of changed files → ${path.basename(BACKUP_DIR)}`);
}

main();