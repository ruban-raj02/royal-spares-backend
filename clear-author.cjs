// clear-authors.cjs
// Removes the .author field from every review in the backup folder.
// Everything else (indent, trailing newline, key order of other fields) preserved.

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'data-finalised-backup-2026-11-16T15-08-49');
const DRY_RUN = false;

if (!fs.existsSync(SRC)) {
  console.error(`❌ Missing: ${SRC}`);
  process.exit(1);
}

function detectIndent(text) {
  const m = text.match(/^([ \t]+)"/m);
  return m ? m[1] : '  ';
}
function hasTrailingNewline(text) { return text.endsWith('\n'); }
function getReviews(p) {
  if (Array.isArray(p.review)) return p.review;
  if (Array.isArray(p.reviews)) return p.reviews;
  if (p.reviews && Array.isArray(p.reviews.items)) return p.reviews.items;
  return null;
}

const files = fs.readdirSync(SRC).filter(f => f.endsWith('.json')).sort();
console.log(`Files found: ${files.length}`);

let changedFiles = 0;
let removedAuthors = 0;
let skippedNullReview = 0;
let skippedNoAuthor = 0;
const samples = [];

for (const f of files) {
  const full = path.join(SRC, f);
  const original = fs.readFileSync(full, 'utf8');
  const p = JSON.parse(original);
  const reviews = getReviews(p);

  if (!reviews) {
    skippedNullReview++;
    continue;
  }

  const before = reviews.filter(r => 'author' in r).length;
  if (before === 0) {
    skippedNoAuthor++;
    continue;
  }

  // Remove author from each review
  for (const r of reviews) {
    if ('author' in r) {
      delete r.author;
      removedAuthors++;
    }
  }

  const indent = detectIndent(original);
  const trailing = hasTrailingNewline(original);
  const serialized = JSON.stringify(p, null, indent) + (trailing ? '\n' : '');

  if (DRY_RUN) {
    if (samples.length < 5) samples.push(`${f}: would remove ${before} authors`);
    changedFiles++;
    continue;
  }

  fs.writeFileSync(full, serialized, 'utf8');
  changedFiles++;
  if (samples.length < 5) samples.push(`${f}: removed ${before} authors`);
}

console.log(`\n${DRY_RUN ? '🔍 DRY RUN — nothing written' : '✅ Done'}`);
console.log(`   Files changed:          ${changedFiles}`);
console.log(`   Authors removed:        ${removedAuthors}`);
console.log(`   Skipped (null review):  ${skippedNullReview}`);
console.log(`   Skipped (no authors):   ${skippedNoAuthor}`);
if (samples.length) {
  console.log('\n   Sample:');
  samples.forEach(s => console.log('     ' + s));
}