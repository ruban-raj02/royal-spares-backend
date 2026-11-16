import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// ─────────────────────────────────────────────────────────────
// 1. API KEY LOADING
// ─────────────────────────────────────────────────────────────
const API_KEYS = [
  process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
  process.env.GEMINI_API_KEY_6,
  process.env.GEMINI_API_KEY_7,
  process.env.GEMINI_API_KEY_8,
  process.env.GEMINI_API_KEY_9,
  process.env.GEMINI_API_KEY_10,
  process.env.GEMINI_API_KEY_11,
  process.env.GEMINI_API_KEY_12,
  process.env.GEMINI_API_KEY_13,
  process.env.GEMINI_API_KEY_14,
].filter(Boolean);

if (API_KEYS.length === 0) {
  console.error('❌ Error: No Gemini API keys provided in your .env file.');
  process.exit(1);
}

let currentKeyIndex = 0;
let aiClient = new GoogleGenAI({ apiKey: API_KEYS[currentKeyIndex] });

function rotateApiKey() {
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  console.warn(
    `⚠️  Rotating to API Key [${currentKeyIndex + 1}/${API_KEYS.length}]...`
  );
  aiClient = new GoogleGenAI({ apiKey: API_KEYS[currentKeyIndex] });
}

// ─────────────────────────────────────────────────────────────
// 2. PATHS & MODEL CONFIG
// ─────────────────────────────────────────────────────────────
const INPUT_DIR = path.join(process.cwd(), 'data-oem-matched-genuine');
const OUTPUT_DIR = path.join(process.cwd(), 'data-temp-mock');

const MODEL = 'gemini-3.6-flash';
const MAX_ATTEMPTS = 15;

const BASE_COOLDOWN_MS = 15_000;
const JITTER_MS = 10_000;

const BACKOFF_BASE_MS = 2_000;
const BACKOFF_MAX_MS = 60_000;

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ─────────────────────────────────────────────────────────────
// 3. PURE TAMIL & GEN-Z TAMIL NAMES POOL (NO ACTORS)
// ─────────────────────────────────────────────────────────────
const TAMIL_NAMES_POOL = [
  // Modern Gen-Z / Contemporary Tamil Names
  "Aakash Ramesh", "Adithya Vijayakumar", "Ajay Pranav", "Akshaya Selvam", 
  "Aravind Balaji", "Arun Prasath", "Ashwin Karthik", "Avinash Sundar", 
  "Deepak Raja", "Dinesh Kumar", "Divya Bharathi", "Gautham Krishna", 
  "Gokul Krishnan", "Hariharan Murugan", "Harish Raghavan", "Jeeva Pradeep", 
  "Karthick Subramanian", "Kavin Karthikeyan", "Kishore Sundar", "Logeshwaran Velmurugan", 
  "Manoj Kumar", "Mithun Chakravarthy", "Mugil Vannan", "Naveen Sundar", 
  "Nithin Balaji", "Pranav Sundar", "Praveen Raj", "Ragul Dravid", 
  "Rakesh Kumar", "Ram Vignesh", "Sabarish Kumar", "Sanjay Karthik", 
  "Saran Vignesh", "Sharan Kumar", "Siddharth Raman", "Sivakumar Natarajan", 
  "Ssujith Kumar", "Sundareshwaran R", "Surya Narayanan", "Tharun Balaji", 
  "Varun Chandrasekar", "Vasanth Raja", "Vigneshwaran S", "Yogeshwaran R",
  // Additional Authentic Real Tamil Names
  "Anbazhagan T", "Arumugam P", "Boopathi Raja", "Chezhiyan K", 
  "Elango Velu", "Ezhil Maran", "Inbasekar M", "Kanimozhi S", 
  "Kaviyarasan R", "Kudimaran V", "Maran Senguttuvan", "Mugilan Thangavel", 
  "Nambi Rajan", "Nandha Gopal", "Pazhanivel K", "Perarasu M", 
  "Ponmani Selvan", "Prabakaran N", "Pugazhenthi S", "Sathiyaraj K", 
  "Senthil Nathan", "Senguttuvan A", "Senthamarai K", "Tamilarasan V", 
  "Thangapandian M", "Thirunavukarasu R", "Udhayakumar S", "Valavan M", 
  "Vetrivel Pandian", "Vijayakumar R", "Aathira Murali", "Abinaya Sundar", 
  "Ananya K", "Archana Devi", "Buvana Priya", "Deepika Ramesh", 
  "Ezhil Vadhana", "Gayathri Devi", "Harini Sri", "Janani Priya", 
  "Keerthana Selvan", "Kavya Natchiyar", "Monisha Rajan", "Nandhini Devi", 
  "Nithya Shree", "Pavithra Lakshmi", "Priyadharshini M", "Ramya V", 
  "Roshini K", "Sangeetha Priya", "Shalini Soundararajan", "Soundarya Ramesh", 
  "Swetha Narayanan", "Vaishnavi Raman", "Viji Balakrishnan", "Yamini S"
];

// Shuffle and track to ensure zero repeats across the entire run
const shuffledNamesPool = [...TAMIL_NAMES_POOL].sort(() => Math.random() - 0.5);
let nameIndex = 0;
const usedNamesTracker = new Set();

function getUniqueAuthorName() {
  while (nameIndex < shuffledNamesPool.length) {
    const name = shuffledNamesPool[nameIndex++];
    if (!usedNamesTracker.has(name)) {
      usedNamesTracker.add(name);
      return name;
    }
  }
  // Fallback if we exceed the pool size
  const fallback = `Aakash Kumar ${usedNamesTracker.size + 1}`;
  usedNamesTracker.add(fallback);
  return fallback;
}

// ─────────────────────────────────────────────────────────────
// 4. SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert data transformation engine for an e-commerce platform (royalspares.in) selling Royal Enfield spare parts. 
Your task is to transform raw product JSON into a strict, web-ready JSON schema following these precise rules:
1. Retain the exact product "id", "oemRef", "pricing", and "policy" from the input.
2. Clean up "name" and generate a professional "subtitle" formatted as exactly three key product highlights separated by middle dots (e.g., "Smooth Engagement · High Durability · Exact OEM Fit").
3. Streamline the "description" into concise professional markdown strictly under 30 words. Completely remove any logos, brand watermarks, URLs, or external links.
4. "category.bike": Simplify to a comma-separated list of core compatible bike models (e.g., "Classic 350, Meteor 350"). Never include internal routing tags like UTH_MODEL_*.
5. "fitment": Set "headline" to a clean summary of fitment and "guaranteed" to true.
6. "compatibility": List all compatible models as an array of objects: { "model": "Royal Enfield [Model Name]", "fit": "100% fit" }. Remove all generic placeholders or UTH_MODEL tags.
7. "installationSteps": Provide an array of 4 realistic, sequential installation steps structured strictly as objects: [ { "step": 1, "title": "Step Title", "body": "Detailed installation instructions..." } ].
8. "boxContents": Accurately reflect what is included in the package.
9. "warranty": Always set { "years": 1, "km": 10000 }.
10. "reviews": Generate exactly 3 diverse, realistic reviews in simple english with ratings (4 or 5 stars), descriptive titles, body text, and verified: true. (Note: Review author fields will be assigned programmatically by the system).

CRITICAL: Return ONLY valid, parseable JSON matching the requested structure without any markdown code blocks or wrapper text.`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─────────────────────────────────────────────────────────────
// 5. ERROR CLASSIFICATION
// ─────────────────────────────────────────────────────────────
function isRateLimit(error) {
  const msg = String(error?.message ?? error);
  return /429|resource[_\s]?exhausted|quota|rate[_\s]?limit/i.test(msg);
}

function isOverloaded(error) {
  const msg = String(error?.message ?? error);
  return /503|unavailable|overloaded|high demand/i.test(msg);
}

function isRetryable(error) {
  return isRateLimit(error) || isOverloaded(error);
}

// ─────────────────────────────────────────────────────────────
// 6. RETRY-AWARE FILE PROCESSOR
// ─────────────────────────────────────────────────────────────
async function processFileWithRetry(filePath, outputFilePath) {
  const fileName = path.basename(filePath);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const preRequestDelay = 2_000 + Math.floor(Math.random() * 2_000);
      await sleep(preRequestDelay);

      const rawContent = fs.readFileSync(filePath, 'utf8');
      const inputJson = JSON.parse(rawContent);

      const prompt = `${SYSTEM_PROMPT}\n\nInput Raw JSON:\n${JSON.stringify(
        inputJson,
        null,
        2
      )}`;

      const response = await aiClient.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (!response.text) {
        throw new Error('Gemini returned an empty response');
      }

      const standardizedJson = JSON.parse(response.text);

      // Programmatically inject unique, non-repeating Tamil/Gen-Z names into each review
      if (standardizedJson.reviews && Array.isArray(standardizedJson.reviews)) {
        standardizedJson.reviews.forEach((review) => {
          review.author = getUniqueAuthorName();
        });
      }

      fs.writeFileSync(
        outputFilePath,
        JSON.stringify(standardizedJson, null, 2),
        'utf8'
      );

      console.log(`✅ Successfully processed: ${fileName}`);
      return true;
    } catch (error) {
      const msg = String(error?.message ?? error);

      console.warn(
        `⚠️  Attempt ${attempt}/${MAX_ATTEMPTS} on ${fileName} ` +
          `(Key #${currentKeyIndex + 1}): ${msg}`
      );

      if (!isRetryable(error)) {
        console.error(
          `❌ Non-retryable error on ${fileName}. Skipping this file.\n   ${msg}\n`
        );
        return false;
      }

      if (isOverloaded(error)) {
        const backoff = Math.min(
          BACKOFF_MAX_MS,
          BACKOFF_BASE_MS * Math.pow(2, attempt - 1)
        );
        console.log(
          `⏳ Model overloaded (503). Backing off ${(backoff / 1000).toFixed(
            1
          )}s before retry...\n`
        );
        await sleep(backoff);
      } else {
        rotateApiKey();
        const cooldown =
          BASE_COOLDOWN_MS + Math.floor(Math.random() * JITTER_MS);
        console.log(
          `⏳ Rate limited (429). Cooling down ${(cooldown / 1000).toFixed(
            1
          )}s before next key...\n`
        );
        await sleep(cooldown);
      }
    }
  }

  console.error(
    `❌ Gave up on ${fileName} after ${MAX_ATTEMPTS} attempts.\n`
  );
  return false;
}

// ─────────────────────────────────────────────────────────────
// 7. BATCH RUNNER
// ─────────────────────────────────────────────────────────────
async function runBatch() {
  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`❌ Directory '${INPUT_DIR}' does not exist.`);
    console.error(`   Current working directory: ${process.cwd()}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(INPUT_DIR)
    .filter((file) => file.endsWith('.json'));

  console.log(
    `🚀 Found ${files.length} files in '${INPUT_DIR}'. Starting batch processor...`
  );
  console.log(`   Model: ${MODEL}`);
  console.log(`   Keys loaded: ${API_KEYS.length}\n`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const inputPath = path.join(INPUT_DIR, file);
    const outputPath = path.join(OUTPUT_DIR, file);

    if (fs.existsSync(outputPath)) {
      console.log(`⏩ Skipping ${file} (already exists)`);
      skipped++;
      continue;
    }

    const ok = await processFileWithRetry(inputPath, outputPath);
    if (ok) success++;
    else failed++;
  }

  console.log(
    `\n🎉 Batch complete — ✅ ${success} processed, ` +
      `⏩ ${skipped} skipped, ❌ ${failed} failed.`
  );
}

runBatch();