// split-genuine-re.js
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'data');
const DST = path.join(__dirname, 'data-genuine-re');

// Must appear in `name` — case-insensitive
const REQUIRED_TERMS = [
  /\broyal[\s-]*enfield\b/i,
  /\bRE\b/,                            // case-sensitive: matches "RE", not "re"/"Rear"
  /\bclassic\s*350\b/i,
  /\bmeteor\s*350\b/i,
  /\bhimalayan\s*450\b/i,
  /\binterceptor\s*650\b/i,
  /\bbullet\s*350\b/i,
  /\bcontinental\s*gt\s*650\b/i,
];

fs.mkdirSync(DST, { recursive: true });

let kept = 0, omitted = 0;
const samples = [];

for (const f of fs.readdirSync(SRC).filter(f => f.endsWith('.json'))) {
  const p = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
  const name = String(p.name || '');

  if (!REQUIRED_TERMS.some(re => re.test(name))) {
    omitted++;
    continue;
  }

  fs.copyFileSync(path.join(SRC, f), path.join(DST, f));
  kept++;
  if (samples.length < 8) samples.push(`${p.id}: ${name.slice(0, 65)}`);
}

console.log(`\n✅ Kept:    ${kept}`);
console.log(`❌ Omitted: ${omitted}`);
console.log(`📁 Folder:  ${DST}\n`);
console.log('Sample kept:');
samples.forEach(s => console.log('  ' + s));