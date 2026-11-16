// make-manifest.js
const fs = require('fs');
const report = JSON.parse(fs.readFileSync('oem-report.json', 'utf8'));

// Start with auto-classified genuine
const approved = new Set(report.genuine.map(x => x.id));

// Add any manually vetted "uncertain" IDs — put them in a file
if (fs.existsSync('approved-manual.json')) {
  const manual = JSON.parse(fs.readFileSync('approved-manual.json', 'utf8'));
  for (const id of manual) approved.add(id);
}

const manifest = [...approved].sort((a, b) =>
  parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10)
);

fs.writeFileSync('genuine-manifest.json', JSON.stringify(manifest, null, 2));
console.log(`✅ ${manifest.length} genuine IDs → genuine-manifest.json`);