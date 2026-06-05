import 'dotenv/config';

// Pull all ads from a campaign and show their creative IDs
const CAMPAIGN_ID = "120246380269970713";
const GRAPH_VERSION = "v21.0";
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

async function main() {
  // Get token from DB
  const { createConnection } = await import('mysql2/promise');
  const conn = await createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.execute('SELECT accessToken FROM token_vault WHERE isActive = 1 LIMIT 1');
  await conn.end();
  
  if (!rows.length) {
    console.error("No active token found");
    process.exit(1);
  }
  const accessToken = rows[0].accessToken;

  // Get all ads from the campaign
  const url = `${BASE}/${CAMPAIGN_ID}/ads?fields=id,name,creative{id,name}&limit=100&access_token=${accessToken}`;
  const resp = await fetch(url);
  const data = await resp.json();

  if (data.error) {
    console.error("Meta API Error:", JSON.stringify(data.error, null, 2));
    process.exit(1);
  }

  console.log(`\nCampaign: ${CAMPAIGN_ID}`);
  console.log(`Total ads found: ${data.data?.length || 0}\n`);
  console.log("AD_ID | AD_NAME | CREATIVE_ID");
  console.log("-".repeat(80));
  
  const creativeIds = new Set();
  for (const ad of (data.data || [])) {
    const creativeId = ad.creative?.id || "N/A";
    creativeIds.add(creativeId);
    console.log(`${ad.id} | ${ad.name} | ${creativeId}`);
  }
  
  console.log(`\n${"=".repeat(80)}`);
  console.log(`Unique creative IDs: ${creativeIds.size}`);
  console.log(`Total ads: ${data.data?.length || 0}`);
  if (creativeIds.size < (data.data?.length || 0)) {
    console.log(`\n⚠️  SHARED CREATIVES DETECTED - ${data.data.length - creativeIds.size} ads share creatives with other ads`);
  } else {
    console.log(`\n✅ Each ad has its own unique creative ID`);
  }
}

main().catch(console.error);
