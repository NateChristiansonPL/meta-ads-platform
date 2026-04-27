import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

const conn = await mysql.createConnection(DATABASE_URL);

const entries = [
  ["skillProjectId:weekly-optimization",  "juQv4FJjcFEmRRYNSe9VPF"],
  ["skillProjectId:performance-insights", "juQv4FJjcFEmRRYNSe9VPF"],
  ["skillProjectId:creative-lifecycle",   "juQv4FJjcFEmRRYNSe9VPF"],
  ["skillProjectId:audience-overlap",     "juQv4FJjcFEmRRYNSe9VPF"],
  ["skillProjectId:structural-audit",     "MKTYEMAkqiP2LpTLjUQbfX"],
];

for (const [key, value] of entries) {
  await conn.execute(
    `INSERT INTO app_settings (\`key\`, value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE value = ?`,
    [key, value, value]
  );
  console.log(`✓ ${key} → ${value}`);
}

await conn.end();
console.log("Done.");
