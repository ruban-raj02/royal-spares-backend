// fix-oemrefs.js
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

// --- OEM extraction patterns (order matters: specific → generic) ---
const EXTRACT = [
  { re: /\b(RE-?\d{6}[A-Z]?)\b/i,       fmt: m => m[1].toUpperCase() },
  { re: /\b(RAL\d{5}-[A-Z])\b/i,        fmt: m => m[1].toUpperCase() },
  { re: /\b(RAL\d{5})\b/i,              fmt: m => m[1].toUpperCase() },
  { re: /\b(\d{6})[\/-]([A-Z])\b/i,     fmt: m => `${m[1]}/${m[2].toUpperCase()}` },
  { re: /\b(\d{6}[A-Z])\b/i,            fmt: m => m[1].toUpperCase() },
  { re: /\b(\d{7})\b/,                  fmt: m => m[1] },
  { re: /\b(\d{6})\b/,                  fmt: m => m[1] },
];

// --- Clean OEM patterns ---
const CLEAN = [
  /^RE-?\d{6}[A-Z]?$/i,
  /^RAL\d{5}(?:-[A-Z])?$/i,
  /^\d{6}\/[A-Z]$/i,
  /^\d{6}[A-Z]$/i,
  /^\d{7}$/,
  /^\d{6}$/,
];

// --- Uncertain alpha-SKU prefixes ---
const UNCERTAIN_SKU = /^(?:RLG|KAB|KAT|RAE|RAG|RAH)\d{5}$/i;

// --- Aftermarket bike brands (in name only) ---
const OTHER_BIKES = /\b(hero|honda|bajaj|yamaha|ktm|suzuki|kawasaki|ducati|harley|triumph|benelli|jawa|splendor|pulsar|apache|activa|shine|unicorn|dominar|ns200|r15)\b/i;

// --- Aftermarket part brands (in name only) ---
const AFTERMARKET = /\b(bosch|ngk|motul|shell|castrol|exide|amaron|hella|philips|osram|valeo|denso|champion|k&n|bmc|pipercross|elofic|purolator|sakura|autopal|simtac|veedol|gunk|wuerth|wurth|3m)\b/i;

// --- Genuine marker (in description) ---
const GENUINE_MARKER = /\b(genuine|oem|o\.e\.m\.?|original)\b/i;

function extractOem(slug) {
  if (!slug) return null;
  const s = String(slug);
  for (const p of EXTRACT) {
    const m = s.match(p.re);
    if (m) return p.fmt(m);
  }
  return null;
}

function isClean(o) {
  return CLEAN.some(re => re.test(o));
}

function classify(p) {
  const name = `${p.name || ''} ${p.subtitle || ''}`;
  const desc = p.description || '';
  const oem = String(p.oemRef || '').trim();

  if (OTHER_BIKES.test(name)) return { v: 'aftermarket', r: `other-bike` };
  if (AFTERMARKET.test(name)) return { v: 'aftermarket', r: `aftermarket-brand` };

  if (isClean(oem)) return { v: 'genuine', r: `clean:${oem}` };

  if (UNCERTAIN_SKU.test(oem)) {
    if (GENUINE_MARKER.test(desc)) return { v: 'genuine', r: `marker+${oem}` };
    return { v: 'uncertain', r: `alpha-sku:${oem}` };
  }

  const ext = extractOem(oem);
  if (ext) {
    if (isClean(ext) || /^RAL/i.test(ext)) return { v: 'genuine', r: `extracted:${ext}`, newOem: ext };
    return { v: 'uncertain', r: `ext-uncertain:${ext}`, newOem: ext };
  }

  return { v: 'aftermarket', r: `no-oem` };
}

function main() {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  const buckets = { genuine: [], aftermarket: [], uncertain: [] };
  let updated = 0;

  for (const f of files) {
    const full = path.join(DATA_DIR, f);
    const p = JSON.parse(fs.readFileSync(full, 'utf8'));
    const { v, r, newOem } = classify(p);

    if (newOem && p.oemRef !== newOem) {
      p.oemRef = newOem;
      fs.writeFileSync(full, JSON.stringify(p, null, 2), 'utf8');
      updated++;
    }

    buckets[v].push({ id: p.id, oemRef: p.oemRef, name: (p.name || '').slice(0, 55), reason: r });
  }

  console.log('\n📊 Classification:');
  for (const k in buckets) console.log(`  ${k.padEnd(12)} ${buckets[k].length}`);
  console.log(`\n🔧 ${updated} oemRef fields updated from slug extraction.`);

  fs.writeFileSync('oem-report-v2.json', JSON.stringify(buckets, null, 2));
  console.log('Report → oem-report-v2.json');
}

main();