// create-empty-mock.js
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'data-oem-matched-genuine');
const DST = path.join(__dirname, 'data-mock');

fs.mkdirSync(DST, { recursive: true });

const files = fs.readdirSync(SRC).filter(f => f.endsWith('.json'));
let created = 0;

for (const f of files) {
  const target = path.join(DST, f);
  // 'w' flag = create or truncate to empty
  fs.writeFileSync(target, '', { flag: 'w' });
  created++;
}

console.log(`✅ ${created} empty files → ${DST}`);