const fs = require('fs');
const path = require('path');

//CONFIG
const SRC = path.join(__dirname, 'data-finalised-backup-2026-11-16T15-08-49');
const NAMES_FILE = path.join(__dirname, 'names.json');
const DRY_RUN = false;  

//Seeded RNG (reproducible)
let seed = 20251116;
function rand() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

//Helpers
function initial(name) {
  const m = String(name).trim().match(/[A-Za-z]/);
  return m ? m[0].toUpperCase() : '#';
}
function getReviews(p) {
  if (Array.isArray(p.review)) return p.review;
  if (Array.isArray(p.reviews)) return p.reviews;
  if (p.reviews && Array.isArray(p.reviews.items)) return p.reviews.items;
  return null;
}
function detectIndent(text) {
  const m = text.match(/^([ \t]+)"/m);
  return m ? m[1] : '  ';
}
function hasTrailingNewline(text) {
  return text.endsWith('\n');
}

// Verify target folder exists
if (!fs.existsSync(SRC)) {
  console.error(` Target folder not found: ${SRC}`);
  console.error('   Check the folder name and try again.');
  process.exit(1);
}
console.log(`Target folder: ${path.basename(SRC)}`);

// ---------- Load names ----------
if (!fs.existsSync(NAMES_FILE)) {
  console.error(` Missing ${NAMES_FILE}`);
  process.exit(1);
}
const rawNames = JSON.parse(fs.readFileSync(NAMES_FILE, 'utf8'));
if (!Array.isArray(rawNames)) throw new Error('names.json must be an array');
const allNames = [...new Set(rawNames.map(n => String(n).trim()).filter(Boolean))];
console.log(`Names loaded: ${rawNames.length} (${allNames.length} unique)`);

// Load files
const files = fs.readdirSync(SRC).filter(f => f.endsWith('.json')).sort();
if (!files.length) {
  console.error(' No JSON files in target folder.');
  process.exit(1);
}
console.log(`Files found:  ${files.length}`);

const fileData = files.map(f => {
  const full = path.join(SRC, f);
  const original = fs.readFileSync(full, 'utf8');
  const p = JSON.parse(original);
  const reviews = getReviews(p);
  if (!reviews) throw new Error(`${f}: no review array found (checked review, reviews, reviews.items)`);
  if (reviews.length !== 3) throw new Error(`${f}: has ${reviews.length} reviews, expected 3`);
  return {
    f,
    full,
    original,
    indent: detectIndent(original),
    trailing: hasTrailingNewline(original),
    p,
    reviews,
  };
});

//Pass 1: collect pre-existing authors
const usedExisting = new Set();
let totalNeeded = 0;
for (const { reviews } of fileData) {
  for (const r of reviews) {
    const a = r.author && String(r.author).trim();
    if (a) usedExisting.add(a);
    else totalNeeded++;
  }
}
console.log(`Pre-existing authors:        ${usedExisting.size}`);
console.log(`Reviews needing new authors: ${totalNeeded}`);

if (totalNeeded === 0) {
  console.log('\n Nothing to do — every review already has an author. No files touched.');
  process.exit(0);
}

// Build remaining pool 
const available = allNames.filter(n => !usedExisting.has(n));
console.log(`Available for new assignment: ${available.length}`);

if (available.length < totalNeeded) {
  console.error(
    ` Need ${totalNeeded} names, only ${available.length} available ` +
    `(after removing ${usedExisting.size} pre-existing authors).`
  );
  process.exit(1);
}

// Group by initial
const groups = new Map();
for (const n of available) {
  const k = initial(n);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(n);
}
for (const [, arr] of groups) shuffle(arr);

// Assignment
let assigned = 0;
let skippedFiles = 0;
let partialFiles = 0;
let writtenFiles = 0;
let fallbackFiles = 0;
const writeLog = [];

for (const entry of fileData) {
  const { f, full, indent, trailing, p, reviews } = entry;

  const needIdx = [];
  const existingInits = new Set();
  for (let i = 0; i < reviews.length; i++) {
    const a = reviews[i].author && String(reviews[i].author).trim();
    if (a) existingInits.add(initial(a));
    else needIdx.push(i);
  }

  if (needIdx.length === 0) { skippedFiles++; continue; }
  if (needIdx.length < reviews.length) partialFiles++;

  const candidates = [...groups.entries()]
    .filter(([k, arr]) => arr.length > 0 && !existingInits.has(k))
    .map(([k, arr]) => ({ k, arr, score: arr.length + rand() * 1.5 }))
    .sort((a, b) => b.score - a.score);

  let picked;
  if (candidates.length >= needIdx.length) {
    picked = candidates.slice(0, needIdx.length);
  } else {
    fallbackFiles++;
    picked = candidates.slice();
    for (const [k, arr] of groups) {
      if (picked.length >= needIdx.length) break;
      if (arr.length > 0 && !picked.some(x => x.k === k)) picked.push({ k, arr });
    }
    if (picked.length < needIdx.length) {
      throw new Error(`Out of names at ${f} (need ${needIdx.length}, got ${picked.length})`);
    }
  }

  // Only mutation: set .author on the empty slots
  const assignedHere = [];
  for (let j = 0; j < needIdx.length; j++) {
    const idx = needIdx[j];
    const newAuthor = picked[j].arr.pop();
    reviews[idx].author = newAuthor;
    assignedHere.push({ slot: idx, author: newAuthor });
    assigned++;
  }

  const serialized = JSON.stringify(p, null, indent) + (trailing ? '\n' : '');

  // Round-trip safety: parsed back must equal intended object
  const roundTrip = JSON.parse(serialized);
  if (JSON.stringify(roundTrip) !== JSON.stringify(p)) {
    throw new Error(`${f}: round-trip mismatch — aborting before write`);
  }

  if (DRY_RUN) {
    writeLog.push(`[DRY] ${f}: ${assignedHere.map(a => `slot${a.slot}="${a.author}"`).join(', ')}`);
  } else if (serialized !== entry.original) {
    fs.writeFileSync(full, serialized, 'utf8');
    writtenFiles++;
    writeLog.push(`${f}: ${assignedHere.map(a => `slot${a.slot}="${a.author}"`).join(', ')}`);
  }
}

//Report
console.log(`\n${DRY_RUN ? ' DRY RUN — nothing written' : ' Done'}`);
console.log(`   Assigned:                ${assigned} authors`);
console.log(`   Files skipped (full):    ${skippedFiles}`);
console.log(`   Files partially filled:  ${partialFiles}`);
console.log(`   Files written:           ${writtenFiles}`);
if (fallbackFiles) console.warn(`   ⚠️  Fallback used in ${fallbackFiles} files`);

// Verification
const authorSet = new Set();
let distinctInitFiles = 0;
let completeFiles = 0;
const problems = [];

for (const { f, reviews } of fileData) {
  const inits = new Set();
  let filled = 0;
  for (const r of reviews) {
    const a = String(r.author || '').trim();
    if (!a) continue;
    filled++;
    authorSet.add(a);
    inits.add(initial(a));
  }
  if (filled === 3) completeFiles++;
  if (inits.size === 3) distinctInitFiles++;
  else problems.push(`${f}: only ${inits.size} distinct initials`);
}

console.log(`\n Verification`);
console.log(`   Files with all 3 reviews filled:  ${completeFiles} / ${fileData.length}`);
console.log(`   Files with 3 distinct initials:   ${distinctInitFiles} / ${fileData.length}`);
console.log(`   Unique authors across all reviews: ${authorSet.size} / ${fileData.length * 3}`);

if (problems.length) {
  console.log(`\n  Files with <3 distinct initials (${problems.length}):`);
  problems.slice(0, 10).forEach(p => console.log('   ' + p));
  if (problems.length > 10) console.log(`   ... and ${problems.length - 10} more`);
}

const remaining = [...groups.entries()].filter(([, a]) => a.length > 0);
const remainingCount = remaining.reduce((s, [, a]) => s + a.length, 0);
if (remainingCount) console.log(`\nℹ  ${remainingCount} names unused`);
else console.log(`\n All remaining names used exactly once`);

if (writeLog.length && DRY_RUN) {
  console.log(`\n Sample (first 5):`);
  writeLog.slice(0, 5).forEach(l => console.log('  ' + l));
}

if (!DRY_RUN) {
  console.log(`\n Target folder updated: ${path.basename(SRC)}`);
  console.log(`   Original data-finalised/ untouched.`);
}