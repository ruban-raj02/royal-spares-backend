// import-supabase.cjs
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// --- Config ---
const DATA_DIR = path.join(__dirname, 'data-finalised-backup-2026-11-16T15-08-49');
const BATCH_SIZE = 50;
const TABLE_NAME = 'products';

// --- Validate credentials ---
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in .env');
  console.error('   Expected: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// --- Init client ---
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// --- Mapper (matches your actual schema — images included) ---
function mapProductToRow(product) {
  return {
    id: product.id,
    oem_ref: product.oemRef,
    name: product.name,
    subtitle: product.subtitle,
    description: product.description,
    category: product.category,
    fitment: product.fitment,
    pricing: product.pricing,
    policy: product.policy,
    images: product.images || [],            // ← URLs only, no files
    compatibility: product.compatibility,
    installation_steps: product.installationSteps,
    box_contents: product.boxContents,
    warranty: product.warranty,
    reviews: product.reviews,
  };
}

// --- Main ---
async function importData() {
  console.log(`📂 Reading files from: ${DATA_DIR}`);

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`❌ Data folder not found: ${DATA_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  console.log(`📄 Found ${files.length} JSON files to import.`);

  if (files.length === 0) {
    console.log('🤷 No files to import. Exiting.');
    return;
  }

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batchFiles = files.slice(i, i + BATCH_SIZE);
    const batchData = [];

    for (const file of batchFiles) {
      try {
        const filePath = path.join(DATA_DIR, file);
        const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // Skip malformed files (null reviews, missing required fields)
        if (!fileContent.id || !fileContent.name || !fileContent.oemRef) {
          errorCount++;
          errors.push({ file, error: 'missing required fields' });
          continue;
        }

        batchData.push(mapProductToRow(fileContent));
      } catch (e) {
        errorCount++;
        errors.push({ file, error: e.message });
      }
    }

    if (batchData.length === 0) continue;

    const { error } = await supabase
      .from(TABLE_NAME)
      .upsert(batchData, { onConflict: 'id' });

    if (error) {
      console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      errorCount += batchData.length;
      errors.push({ batch: `starting at ${i}`, error: error.message });
    } else {
      successCount += batchData.length;
      console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(files.length / BATCH_SIZE)} — ${batchData.length} records`);
    }
  }

  console.log('\n--- Import Summary ---');
  console.log(`✅ Successfully inserted: ${successCount}`);
  console.log(`❌ Failed:                ${errorCount}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.slice(0, 10).forEach(e => console.log(`  ${JSON.stringify(e)}`));
    if (errors.length > 10) console.log(`  ... and ${errors.length - 10} more`);
  }

  console.log('\n🎉 Import process finished.');
}

importData().catch(err => {
  console.error('❌ Critical error:', err);
  process.exit(1);
});