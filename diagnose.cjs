// diagnose.cjs
const fs = require('fs');
const path = require('path');
const DIR = 'data-finalised-backup-2026-11-16T15-08-49';

const stats = {
  total: 0,
  valid3: 0,
  nullReview: 0,
  emptyReview: 0,
  notArray: 0,
  wrongCount: 0,
  noKey: 0,
};
const problems = [];

for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.json'))) {
  stats.total++;
  const p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));

  let reviews = null;
  if ('review' in p) reviews = p.review;
  else if ('reviews' in p) {
    if (Array.isArray(p.reviews)) reviews = p.reviews;
    else if (p.reviews && Array.isArray(p.reviews.items)) reviews = p.reviews.items;
  } else { stats.noKey++; problems.push({ f, type: 'no-key' }); continue; }

  if (reviews === null)      { stats.nullReview++;  problems.push({ f, type: 'null' }); continue; }
  if (!Array.isArray(reviews)) { stats.notArray++;  problems.push({ f, type: 'not-array', got: typeof reviews }); continue; }
  if (reviews.length === 0)  { stats.emptyReview++; problems.push({ f, type: 'empty' }); continue; }
  if (reviews.length !== 3)  { stats.wrongCount++;  problems.push({ f, type: 'wrong-count', count: reviews.length }); continue; }

  stats.valid3++;
}

console.log('=== FILE STRUCTURE ===');
console.log(JSON.stringify(stats, null, 2));
console.log('\n=== PROBLEM FILES (first 30) ===');
problems.slice(0, 30).forEach(p => console.log(JSON.stringify(p)));
if (problems.length > 30) console.log(`... and ${problems.length - 30} more`);

// --- Names ---
const names = require('./names.json');
const withNums = names.filter(n => /\s+\d+$/.test(String(n).trim()));
console.log('\n=== NAMES ===');
console.log('Total names:', names.length);
console.log('With numeric suffix:', withNums.length);
console.log('First 15 numbered:');
withNums.slice(0, 15).forEach(n => console.log('  ' + n));