const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { convert } = require('html-to-text');

// ---------- CONFIGURATION ----------
const BASE_URL = 'https://underthehood.co.in';
const OUTPUT_DIR = path.join(__dirname, 'data');
const LIMIT = 250; // Shopify max per page
const DELAY_MIN = 2000; // 2 seconds
const DELAY_MAX = 5000; // 5 seconds
const GST_RATE = 18; // Assumed for auto parts in India; adjust if needed


// ---------- HELPERS ----------
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay() {
  return sleep(DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN));
}

function stripHtml(html) {
  return convert(html, { wordwrap: false }).trim();
}

function derivePricing(variant) {
  const price = parseFloat(variant.price);
  const mrp = variant.compare_at_price ? parseFloat(variant.compare_at_price) : price;
  const discountAmount = Math.max(0, mrp - price);
  const discountPercentage = mrp > 0 ? Math.round((discountAmount / mrp) * 100) : 0;
  // GST is assumed to be inclusive in the listed price (common in Indian retail).
  const gstAmount = price - (price / (1 + GST_RATE / 100));

  return {
    price: price,
    mrp: mrp,
    currency: 'INR',
    discountAmount: parseFloat(discountAmount.toFixed(2)),
    discountPercentage: discountPercentage,
    gstRate: GST_RATE,
    gstAmount: parseFloat(gstAmount.toFixed(2)),
    taxInclusive: true,
    inputTaxCreditAvailable: false // Default; set to true if the store issues GST invoices
  };
}

function extractBikeCategory(product) {
  // Try product_type first, then tags
  if (product.product_type && product.product_type.trim()) {
    return { bike: product.product_type.trim() };
  }
  const tags = product.tags || [];
  const bikeTags = tags.filter(t => 
    /classic|meteor|hunter|bullet|himalayan|scram|interceptor|continental|gt|350|650/i.test(t)
  );
  return { bike: bikeTags.length > 0 ? bikeTags.join(', ') : 'Royal Enfield' };
}

function extractFitment(product) {
  const tags = product.tags || [];
  const guaranteed = tags.some(t => /guaranteed\s*fit/i.test(t));
  // Build a headline from the first few compatibility tags
  const compatTags = tags.filter(t => 
    /classic|meteor|hunter|bullet|himalayan|scram|interceptor|continental|gt|350|650/i.test(t)
  );
  const headline = compatTags.length > 0 
    ? `Fits ${compatTags.slice(0, 3).join(', ')}` 
    : 'Check compatibility with your model';
  return { headline, guaranteed };
}

function extractCompatibility(product) {
  const tags = product.tags || [];
  const models = tags.filter(t => 
    /classic|meteor|hunter|bullet|himalayan|scram|interceptor|continental|gt|350|650/i.test(t)
  );
  return models.map(model => ({
    model: model.trim(),
    fit: 'Check fitment guide' // Placeholder; you can refine per product
  }));
}

function mapProductToSchema(product) {
  const variant = product.variants && product.variants[0] ? product.variants[0] : {};
  const oemRef = variant.sku || product.handle || 'UNKNOWN';

  return {
    id: `p${product.id}`,
    oemRef: oemRef,
    name: product.title,
    subtitle: product.product_type || '',
    description: stripHtml(product.body_html || ''),
    category: extractBikeCategory(product),
    fitment: extractFitment(product),
    pricing: derivePricing(variant),
    policy: {
      cancellable: true, // Shopify stores typically allow cancellation before fulfillment
      refundable: true,
      notice: 'Standard returns accepted within the store policy window.',
      policyUrl: `${BASE_URL}/policies/refund-policy`
    },
    // The following are left empty or minimal because you fill them manually
    images: [], // You will populate this
    compatibility: extractCompatibility(product),
    installationSteps: [], // You will populate this
    boxContents: { items: [] }, // You will populate this
    warranty: {}, // You will populate this
    reviews: { distribution: {}, items: [] } // You will populate this
  };
}

// ---------- MAIN SCRAPER ----------
async function fetchPage(page) {
  const url = `${BASE_URL}/products.json?limit=${LIMIT}&page=${page}`;
  console.log(`Fetching page ${page}: ${url}`);
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      timeout: 30000
    });
    return response.data.products || [];
  } catch (error) {
    if (error.response && error.response.status === 429) {
      const retryAfter = parseInt(error.response.headers['retry-after'] || '60', 10);
      console.warn(`Rate limited. Waiting ${retryAfter} seconds...`);
      await sleep(retryAfter * 1000);
      return fetchPage(page); // Retry same page
    }
    throw error;
  }
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let page = 1;
  let totalSaved = 0;

  while (true) {
    const products = await fetchPage(page);
    if (products.length === 0) {
      console.log('No more products. Finished.');
      break;
    }

    for (const product of products) {
      const mapped = mapProductToSchema(product);
      const filename = path.join(OUTPUT_DIR, `${mapped.id}.json`);
      fs.writeFileSync(filename, JSON.stringify(mapped, null, 2), 'utf-8');
      totalSaved++;
      console.log(`Saved: ${mapped.name} (${mapped.id})`);
    }

    console.log(`Page ${page} complete. Total saved: ${totalSaved}`);
    page++;
    await randomDelay(); // Respectful pause before next page
  }

  console.log(`\nDone. ${totalSaved} products saved to ${OUTPUT_DIR}`);
}

main().catch(err => {
  console.error('Scraper failed:', err.message);
  process.exit(1);
});