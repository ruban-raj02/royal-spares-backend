const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('data').filter(f => f.endsWith('.json'));
const shapes = { digitOnly: 0, digitSlash: 0, rePrefix: 0, alphaDigit: 0, handleLike: 0, short: 0, other: 0 };
const samples = { digitOnly: [], digitSlash: [], rePrefix: [], alphaDigit: [], handleLike: [], short: [], other: [] };

for (const f of files) {
  const p = JSON.parse(fs.readFileSync(path.join('data', f), 'utf8'));
  const o = String(p.oemRef || '').trim();
  let bucket;

  if (/^\d{4,7}[A-Z]?$/i.test(o))                        bucket = 'digitOnly';     // 570123, 5851234A
  else if (/^\d{4,7}[A-Z]?\/[A-Z0-9]{1,3}$/i.test(o))    bucket = 'digitSlash';    // 570123/A
  else if (/^RE[-\s]?[A-Z0-9]{3,}$/i.test(o))            bucket = 'rePrefix';      // RE-1234
  else if (/^[A-Z]{2,3}[-\s]?\d{4,7}$/i.test(o))         bucket = 'alphaDigit';    // AB123456
  else if (/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(o) && !/\d{4,}/.test(o)) bucket = 'handleLike';
  else if (o.length < 4)                                  bucket = 'short';
  else                                                    bucket = 'other';

  shapes[bucket]++;
  if (samples[bucket].length < 5) samples[bucket].push(`${p.id}: ${o}`);
}

console.log('Shapes:', shapes);
console.log('\nSamples:');
for (const k in samples) {
  if (samples[k].length) console.log(`  ${k}:`, samples[k]);
}