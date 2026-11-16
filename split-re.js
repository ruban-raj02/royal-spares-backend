const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'data');
const DST = path.join(__dirname, 'data-re');

// ---- POSITIVE: RE terms in the product name/subtitle ----
const RE_TERMS = [
  /\broyal[\s-]*enfield\b/i,
  /\bRE\b/,                          // word-boundary safe: won't match "Rear", "Bracket"
  /\bclassic\s*350\b/i,
  /\bmeteor\s*350\b/i,
  /\bhimalayan\s*450\b/i,
  /\bhimalayan\s*411\b/i,            // older Himalayan — likely wanted too
  /\binterceptor\s*650\b/i,
  /\bbullet\s*350\b/i,
  /\bcontinental\s*gt\s*650\b/i,
  /\bgt\s*650\b/i,                   // shorthand for Continental GT 650
  /\bscram\s*411\b/i,                // Scram 411 (current RE)
];

// ---- NEGATIVE: other bike brands (name/subtitle only) ----
const OTHER_BIKE = /\b(hero|honda|bajaj|yamaha|ktm|suzuki|kawasaki|ducati|harley|triumph|benelli|jawa|splendor|pulsar|apache|activa|shine|unicorn|dominar|ns200|r15|fz|gixxer|royal enfield competitor)\b/i;

// ---- NEGATIVE: aftermarket brands (name/subtitle only) ----
const AFTERMARKET = /\b(bosch|ngk|motul|shell|castrol|exide|amaron|hella|philips|osram|valeo|denso|champion|k&n|bmc|pipercross|elofic|purolator|sakura|autopal|simtac|veedol|gunk|wuerth|wurth|3m|mrf|ceat|apollo|jk|minda|lumax|root)\b/i;

fs.mkdirSync(DST, { recursive: true });

let kept = 0, skipOtherBike = 0, skipAftermarket = 0, skipNoRE = 0;
const keptExamples = [];

for (const f of fs.readdirSync(SRC).filter(f => f.endsWith('.json'))) {
  const p = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
  const hay = `${p.name || ''} ${p.subtitle || ''}`;

  if (OTHER_BIKE.test(hay))     { skipOtherBike++;     continue; }
  if (AFTERMARKET.test(hay))    { skipAftermarket++;   continue; }
  if (!RE_TERMS.some(re => re.test(hay))) { skipNoRE++; continue; }

  fs.copyFileSync(path.join(SRC, f), path.join(DST, f));
  kept++;
  if (keptExamples.length < 8) keptExamples.push(`${p.id}: ${hay.slice(0, 70).trim()}`);
}

console.log(`\n✅ Kept (RE):            ${kept}`);
console.log(`❌ Skipped (other bike):  ${skipOtherBike}`);
console.log(`❌ Skipped (aftermarket): ${skipAftermarket}`);
console.log(`❌ Skipped (no RE term):  ${skipNoRE}`);
console.log(`\nFolder → ${DST}\n`);
console.log('Sample kept:');
keptExamples.forEach(e => console.log('  ' + e));