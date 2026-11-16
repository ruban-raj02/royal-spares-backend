// freeze-ids.js — run once, commit the output
const fs = require('fs');
const map = {};
for (const f of fs.readdirSync('data')) {
  const d = JSON.parse(fs.readFileSync(`data/${f}`, 'utf8'));
  map[d.oemRef] = d.id;         // oemRef → pN
}
fs.writeFileSync('id-map.json', JSON.stringify(map, null, 2));
console.log(`Froze ${Object.keys(map).length} IDs → id-map.json`);