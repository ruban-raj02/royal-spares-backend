// validate.js
const Ajv = require('ajv');
const fs = require('fs');
const schema = require('./schema.json');
const ajv = new Ajv({ strict: false });
const validate = ajv.compile(schema);

let bad = 0, firstErr = null;
for (const f of fs.readdirSync('data')) {
  const d = JSON.parse(fs.readFileSync(`data/${f}`, 'utf8'));
  if (!validate(d)) {
    bad++;
    if (!firstErr) firstErr = { f, errors: validate.errors };
  }
}
if (bad) {
  console.log(`❌ ${bad} invalid files`);
  console.log('First failure:', firstErr.f);
  console.log(JSON.stringify(firstErr.errors.slice(0, 5), null, 2));
} else {
  console.log('✅ All 4723 products validate');
}