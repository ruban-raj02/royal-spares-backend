// flatten-reviews.cjs
// Converts {items: [...], distribution: {...}} → flat [...] in source JSON files
// Preserves indent + trailing newline. Idempotent (safe to re-run).

const fs = require('fs');
const path = require('path');

// --- CONFIG ---
const SRC = path.join(__dirname, 'data-finalised-backup-2026-11-16T15-08-49');
const DRY_RUN = false;  // set true to preview without writing

// --- Helpers ---
function getReviewContainer(p) {
  if ('reviews' in p) return { obj: p, key: 'reviews' };
  if ('review'  in p) return { obj: p, key: 'review'  };
  return null;
}

function detectIndent(text) {
  const m = text.match(/^([ \t]+)"/m);
  return m ? m[1] : '  ';
}

function normalizeReviews(value) {
  if (Array.isArray(value)) return { value, changed: false, reason: 'already-flat' };
  if (value && Array.isArray(value.items)) {
    return { value: value.items, changed: true, reason: 'extracted-items' };
  }
  if (value === null || value === undefined) {
    return { value: [], changed: true, reason: 'null-to-empty' };
  }
  return { value: [], changed: true, reason: 'unknown-to-empty' };
}

// --- Main ---
if (!fs.existsSync(SRC)) {
  console.error(`❌ Folder not found: ${SRC}`);
  process.exit(1);
}

const files = fs.readdirSync(SRC).filter(f => f.endsWith('.json')).sort();
console.log(`📂 Folder: ${path.basename(SRC)}`);
console.log(`📄 Files:  ${files.length}\n`);

let flattened   = 0;
let alreadyFlat = 0;
let nullFixed   = 0;
let unknown     = 0;
let skipped     = 0;
let written     = 0;
const samples   = [];

for (const f of files) {
  const full = path.join(SRC, f);
  const original = fs.readFileSync(full, 'utf8');

  let p;
  try {
    p = JSON.parse(original);
  } catch (e) {
    skipped++;
    samples.push(`${f}: PARSE ERROR — ${e.message}`);
    continue;
  }

  const c = getReviewContainer(p);
  if (!c) {
    skipped++;
    samples.push(`${f}: no "reviews" or "review" key`);
    continue;
  }

  const { value, changed, reason } = normalizeReviews(c.obj[c.key]);

  if (!changed) {
    alreadyFlat++;
    continue;
  }

  c.obj[c.key] = value;

  if (reason === 'extracted-items') {
    flattened++;
    if (samples.length < 5) samples.push(`${f}: extracted ${value.length} items`);
  } else if (reason === 'null-to-empty') {
    nullFixed++;
    if (samples.length < 5) samples.push(`${f}: null → []`);
  } else {
    unknown++;
    if (samples.length < 5) samples.push(`${f}: ${reason}`);
  }

  if (!DRY_RUN) {
    const indent = detectIndent(original);
    const trailing = original.endsWith('\n');
    const serialized = JSON.stringify(p, null, indent) + (trailing ? '\n' : '');
    fs.writeFileSync(full, serialized, 'utf8');
    written++;
  }
}

// --- Report ---
console.log(`${DRY_RUN ? '🔍 DRY RUN — nothing written' : '✅ Done'}`);
console.log(`   Flattened (object → array):  ${flattened}`);
console.log(`   Already flat (no change):    ${alreadyFlat}`);
console.log(`   Null fixed (null → []):      ${nullFixed}`);
console.log(`   Unknown → []:                ${unknown}`);
console.log(`   Skipped (no review key):     ${skipped}`);
if (!DRY_RUN) console.log(`   Files written:               ${written}`);

if (samples.length) {
  console.log('\n📝 Sample changes:');
  samples.forEach(s => console.log('   ' + s));
}

// --- Verification hint ---
if (!DRY_RUN && (flattened + nullFixed + unknown) > 0) {
  console.log('\n🔍 Verify with:');
  console.log(`   jq -r '.reviews | type' "${path.basename(SRC)}"/*.json | sort | uniq -c`);
  console.log(`   jq -r '.reviews | length' "${path.basename(SRC)}"/*.json | sort | uniq -c`);
}