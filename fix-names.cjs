// fix-names.cjs — cleans the current names.json in place
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'names.json');
const BACKUP = path.join(__dirname, 'names.old.json');

const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
fs.copyFileSync(FILE, BACKUP);
console.log(`Backup saved → names.old.json (${raw.length} names)`);

// Real Tamil first names (verified natural)
const REAL_FIRST = [
  'Aadhav','Yuvan','Kavin','Mithran','Pranav','Nilan','Rithvik','Aadhith',
  'Aarav','Iniyan','Mugilan','Tharun','Madhavan','Saravanan','Manikandan',
  'Muthukumar','Kathirvel','Arul','Senthil','Kumaran','Elango','Vetrivel',
  'Dinesh','Karthik','Vignesh','Aravind','Kishore','Santhosh','Naveen',
  'Gokul','Surya','Ashwin','Adhavan','Akilan','Amudhan','Anbarasan','Anbu',
  'Anirudh','Bharath','Balamurugan','Chandru','Charan','Dhanush','Ezhilan',
  'Girish','Hariharan','Harish','Ilango','Jeeva','Jeevan','Jayakumar',
  'Kabilan','Kannan','Karthikeyan','Koushik','Lokesh','Maran','Madhan',
  'Mano','Nandakumar','Naren','Natarajan','Nithin','Pradeep','Praveen',
  'Raghavan','Rahul','Rajkumar','Ramesh','Ranjith','Ravi','Rohit','Sabarish',
  'Sakthivel','Sanjay','Sathish','Sathyan','Shankar','Shanmugam','Sridhar',
  'Sriram','Sudarshan','Suresh','Tamilarasan','Udhay','Vaibhav','Varun',
  'Vasanth','Vijay','Vikram','Vinoth','Vishal','Vivek','Yogesh','Aakash',
  'Abishek','Adithya','Ajay','Akash','Arjun','Ashok','Balaji','Bhuvanesh',
  'Deepak','Deva','Gautham','Gowtham','Guru','Hemanth','Jagan','Janarthan',
  'Krishna','Mahesh','Mohan','Mukesh','Niranjan','Palanisamy','Parthiban',
  'Raghul','Rajesh','Rakesh','Ramkumar','Sanjith','Sarath','Sivakumar',
  'Srinath','Srinivasan','Subash','Sundar','Surendran','Vimal','Vishnu',
  'Sathish','Sudhakar','Sundaram','Murugan','Selvam','Kumar','Vel','Raju',
];

// Real Tamil last names
const REAL_LAST = [
  'Kumar','Raj','Nathan','Prakash','Chandran','Selvan','Vel','Kannan',
  'Murugan','Prasad','Maran','Balan','Mani','Anand','Subramanian','Arasan',
  'Iyer','Pillai','Menon','Nair','Reddy','Rao','Sharma','Varma','Shetty',
  'Hegde','Bhat','Pai','Kamaraj','Sundar','Srinivasan','Ramaswamy',
  'Venkataraman','Ganapathy','Krishnamurthy','Gopalakrishnan','Rangarajan',
];

// Build all combos
const seen = new Set();
const out = [];

// Preserve the "real-looking" prefix of the original list (~250 names)
for (const n of raw.slice(0, 250)) {
  const s = String(n).trim();
  if (!s) continue;
  // Reject single-letter last name or known-fake concatenation
  if (/\s[A-Z]$/.test(s)) continue;
  if (/\d/.test(s)) continue;
  if (/^[A-Za-z]+vel\s/i.test(s) && !['kumaravel','manivel','muthuvel','vetrivel','sakthivel','pazhanivel','senthilvel','thangavel','kathirvel'].includes(s.split(/\s+/)[0].toLowerCase())) continue;
  if (seen.has(s.toLowerCase())) continue;
  seen.add(s.toLowerCase());
  out.push(s);
}

// Fill up to 2049 with guaranteed-natural combinations
for (const f of REAL_FIRST) {
  for (const l of REAL_LAST) {
    if (out.length >= 2049) break;
    const name = `${f} ${l}`;
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  if (out.length >= 2049) break;
}

if (out.length < 2049) {
  console.error(`❌ Only ${out.length} unique natural names — need 2049. Add more names.`);
  process.exit(1);
}

const final = out.slice(0, 2049);

// Final sanity checks
const bad = final.filter(n => /\d/.test(n) || /\s[A-Z]$/.test(n) || !n.includes(' '));
if (bad.length) {
  console.error(`❌ ${bad.length} bad names remain:`, bad.slice(0, 10));
  process.exit(1);
}

fs.writeFileSync(FILE, JSON.stringify(final, null, 2), 'utf8');
console.log(`✅ Cleaned names.json: ${final.length} unique natural names`);
console.log(`   Sample: ${final.slice(0, 5).join(' | ')}`);
console.log(`   Sample: ${final.slice(-5).join(' | ')}`);