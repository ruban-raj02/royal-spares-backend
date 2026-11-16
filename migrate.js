const fs = require('fs');
const path = require('path');

// ---------- CONFIG ----------
const DATA_DIR = path.join(__dirname, 'data');
const BACKUP_DIR = path.join(
  __dirname,
  `data-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`
);

// New branding — edit these if your real domain differs
const NEW_DOMAIN = 'royalspares.co.in';   // used only in docs; the replace handles domains automatically
const NEW_SLUG   = 'royalspares';         // lowercase, no spaces (URLs, emails, handles)
const NEW_TITLE  = 'Royal Spares';        // human-readable brand name

// ---------- REPLACEMENT LOGIC ----------
// 1. "Under The Hood" (with spaces, any case) → "Royal Spares"
// 2. "underthehood" (one word, any case, incl. URLs / emails / handles) → case-aware slug
function replaceInString(str) {
  // Rule 1: phrase with spaces (must run first so it isn't partially eaten by rule 2)
  str = str.replace(/\bUnder\s+The\s+Hood\b/gi, NEW_TITLE);

  // Rule 2: single-token occurrences (URLs, emails, handles, plain text)
  str = str.replace(/\bunderthehood(?![A-Za-z])/gi, (match) => {
    if (match === match.toLowerCase()) return NEW_SLUG;             // underthehood
    if (match === match.toUpperCase()) return NEW_SLUG.toUpperCase(); // UNDERTHEHOOD
    if (
      match[0] === match[0].toUpperCase() &&
      match.slice(1) === match.slice(1).toLowerCase()
    ) {
      return 'RoyalSpares'; // Underthehood → RoyalSpares (camel, no space)
    }
    return 'RoyalSpares';   // mixed case → camel fallback
  });

  return str;
}

// Recursively replace in every string value AND every key
function deepReplace(value) {
  if (typeof value === 'string') return replaceInString(value);

  if (Array.isArray(value)) return value.map(deepReplace);

  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[replaceInString(k)] = deepReplace(v);
    }
    return out;
  }

  return value; // numbers, booleans, null
}

// ---------- MAIN ----------
function main() {
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.json'));

  if (files.length === 0) {
    console.log('❌ No JSON files found in data/. Nothing to do.');
    return;
  }

  // Parse each file and remember its ORIGINAL numeric id so we can sort deterministically
  const products = files.map((file) => {
    const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
    const data = JSON.parse(raw);
    const num = parseInt(String(data.id || '').replace(/^p/, ''), 10) || 0;
    return { oldFile: file, data, num };
  }).sort((a, b) => a.num - b.num); // p100 < p999 < p1234567890 ...

  // 1) Backup originals
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  for (const p of products) {
    fs.copyFileSync(
      path.join(DATA_DIR, p.oldFile),
      path.join(BACKUP_DIR, p.oldFile)
    );
  }
  console.log(`🗂  Backed up ${products.length} files → ${path.basename(BACKUP_DIR)}`);

  // 2) Clear data/ so we can write fresh filenames
  for (const p of products) {
    fs.unlinkSync(path.join(DATA_DIR, p.oldFile));
  }

  // 3) Transform + write with new sequential IDs
  let counter = 0;
  for (const p of products) {
    counter++;
    const newId = `p${counter}`;

    let transformed = deepReplace(p.data);
    transformed.id = newId; // force the new sequential ID

    fs.writeFileSync(
      path.join(DATA_DIR, `${newId}.json`),
      JSON.stringify(transformed, null, 2),
      'utf8'
    );

    if (counter % 100 === 0 || counter === products.length) {
      console.log(`✅ ${counter}/${products.length} processed`);
    }
  }

  console.log(`\n🎉 Done. ${counter} products renamed to p1 … p${counter}.`);
  console.log(`   Originals preserved in: ${BACKUP_DIR}`);
}

main();