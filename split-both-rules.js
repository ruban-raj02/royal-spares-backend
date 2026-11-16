// split-both-rules.js
const fs = require('fs');
const path = require('path');

const SOURCES = [
  path.join(__dirname, 'data'),
  path.join(__dirname, 'data-re'),
  path.join(__dirname, 'data-genuine-re'),
];
const DST = path.join(__dirname, 'data-oem-matched-genuine');
const NEW_NOTICE = 'Please confirm part number/OEM before ordering.';

// ---- RULE 1: name must contain one of these ----
const NAME_TERMS = [
  /\broyal[\s-]*enfield\b/i,
  /\bRE\b/,
  /\bclassic\s*350\b/i,
  /\bmeteor\s*350\b/i,
  /\bhimalayan\s*450\b/i,
  /\binterceptor\s*650\b/i,
  /\bbullet\s*350\b/i,
  /\bcontinental\s*gt\s*650\b/i,
];

// ---- RULE 2: oemRef must match one of these ----
const OEM_PATTERNS = [
  { name: '7-digit/slash/letter', re: /^\d{7}\/[A-Z]$/ },
  { name: '6-digit/slash/letter', re: /^\d{6}\/[A-Z]$/ },
  { name: '6-7 digit + letter',   re: /^\d{6,7}[A-Z]$/ },
  { name: '6-7 digit bare',       re: /^\d{6,7}$/ },
  { name: 'RE- prefix',           re: /^RE-?\d{6,7}[A-Z]?$/i },
  { name: 'Category prefix',      re: /^(RAN|RAB|RAP|RAK|RAL|RAC|RLX|RLY|KAA|KAR)\d+(?:-[A-Z])?$/i },
];

const nameMatches = name => NAME_TERMS.some(re => re.test(name));
const oemMatches  = oem  => OEM_PATTERNS.find(p => p.re.test(oem));

fs.mkdirSync(DST, { recursive: true });

const seen = new Set();          // de-dupe by filename across sources
let kept = 0, dupSkipped = 0, omitted = 0;
const failReasons = { name: 0, oem: 0, both: 0 };
const byPattern = Object.fromEntries(OEM_PATTERNS.map(p => [p.name, 0]));
const samples = [];

for (const SRC of SOURCES) {
  if (!fs.existsSync(SRC)) {
    console.log(`⚠️  Skipping missing folder: ${SRC}`);
    continue;
  }

  for (const f of fs.readdirSync(SRC).filter(f => f.endsWith('.json'))) {
    if (seen.has(f)) { dupSkipped++; continue; }
    seen.add(f);

    const p = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
    const name = String(p.name || '');
    const oem  = String(p.oemRef || '').trim();

    const nameOk = nameMatches(name);
    const oemHit = oemMatches(oem);

    if (!nameOk && !oemHit) { failReasons.both++; omitted++; continue; }
    if (!nameOk)            { failReasons.name++; omitted++; continue; }
    if (!oemHit)            { failReasons.oem++;  omitted++; continue; }

    // Both passed — write transformed copy
    p.policy = p.policy || {};
    p.policy.notice = NEW_NOTICE;

    fs.writeFileSync(
      path.join(DST, f),
      JSON.stringify(p, null, 2),
      'utf8'
    );

    byPattern[oemHit.name]++;
    kept++;
    if (samples.length < 12) {
      samples.push(
        `${p.id.padEnd(8)} ${oem.padEnd(14)} ${oemHit.name.padEnd(22)} ${name.slice(0, 50)}`
      );
    }
  }
}

console.log(`\n✅ Kept (both rules):      ${kept}`);
console.log(`❌ Omitted — bad name:     ${failReasons.name}`);
console.log(`❌ Omitted — bad oemRef:   ${failReasons.oem}`);
console.log(`❌ Omitted — both failed:  ${failReasons.both}`);
console.log(`🔁 De-dupe skipped:        ${dupSkipped}`);
console.log(`📁 Folder → ${DST}\n`);

console.log('Breakdown by OEM pattern:');
for (const [k, v] of Object.entries(byPattern).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(22)} ${v}`);
}

console.log('\nSample kept:');
samples.forEach(s => console.log('  ' + s));