// classify-oem.js
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const REPORT = path.join(__dirname, 'oem-report.json');

// Common aftermarket brands sold on RE spares sites
const AFTERMARKET_BRANDS = [
  'bosch', 'ngk', 'motul', 'castrol', 'shell', 'mobil', 'valvoline',
  'gulf', 'elf', 'servo', 'lucas', 'uno minda', 'minda', 'endurance',
  'exide', 'amaron', 'mrf', 'ceat', 'apollo', 'hella', 'philips',
  'osram', 'valeo', 'denso', 'champion', 'k&n', 'bmc', 'pipercross',
  'tvs', 'jk', 'elofic', 'purolator', 'mann filter', 'sakura',
  'minda', 'autopal', 'lumax', 'root', 'ceat', 'jk tyre'
];

function classify(p) {
  const oem  = String(p.oemRef || '').trim();
  const text = `${p.name || ''} ${p.subtitle || ''} ${p.description || ''}`.toLowerCase();

  // Real Royal Enfield OEM patterns
  const OEM_PATTERNS = [
    /^\d{4,7}[A-Z]?$/i,                    // 570123, 5851234A
    /^\d{4,7}[A-Z]?\/[A-Z0-9]{1,3}$/i,     // 570123/A
    /^RE[-\s]?[A-Z0-9]{3,}$/i,             // RE-1234
    /^[A-Z]{2,3}[-\s]?\d{4,7}$/i,          // AB123456
  ];

  const looksLikeHandle =
    /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(oem) && !/\d{4,}/.test(oem);

  const aftermarketHit = AFTERMARKET_BRANDS.find(b =>
    new RegExp(`\\b${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)
  );

  const hasGenuineMarker = /\b(genuine|oem|original|o\.e\.m\.?)\b/i.test(text);

  // Aftermarket brand beats everything — even if pattern looks OEM-ish
  if (aftermarketHit) return { verdict: 'aftermarket', reason: `brand: ${aftermarketHit}` };

  // Real OEM pattern = genuine
  if (OEM_PATTERNS.some(re => re.test(oem))) return { verdict: 'genuine', reason: `pattern: ${oem}` };

  // Explicit "genuine/OEM" in title but no clean pattern → still genuine (SKU might be odd)
  if (hasGenuineMarker && !looksLikeHandle) return { verdict: 'genuine', reason: 'explicit marker' };

  // Handle fallback → definitely no SKU → not verifiable as OEM
  if (looksLikeHandle) return { verdict: 'aftermarket', reason: 'oemRef is handle' };

  return { verdict: 'uncertain', reason: `oemRef: ${oem}` };
}

const buckets = { genuine: [], aftermarket: [], uncertain: [] };
for (const f of fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'))) {
  const p = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
  const { verdict, reason } = classify(p);
  buckets[verdict].push({ id: p.id, oemRef: p.oemRef, name: p.name, reason });
}

console.log('Summary:');
for (const k in buckets) console.log(`  ${k.padEnd(12)} ${buckets[k].length}`);
console.log(`\nReport: ${REPORT}`);
fs.writeFileSync(REPORT, JSON.stringify(buckets, null, 2));