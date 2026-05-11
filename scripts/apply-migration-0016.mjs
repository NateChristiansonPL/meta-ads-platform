import mysql2 from 'mysql2/promise';
import { readFileSync } from 'fs';
import { config } from 'dotenv';
config();

const conn = await mysql2.createConnection(process.env.DATABASE_URL);
const sql = readFileSync('./drizzle/0016_fantastic_warbound.sql', 'utf8');
const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
for (const stmt of statements) {
  try {
    await conn.execute(stmt);
    console.log('OK:', stmt.slice(0, 80));
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME' || e.code === 'ER_TABLE_EXISTS_ERROR' || e.code === 'ER_DUP_KEYNAME') {
      console.log('SKIP (already applied):', stmt.slice(0, 80));
    } else {
      console.error('ERR:', e.message, '\n  SQL:', stmt.slice(0, 120));
    }
  }
}
await conn.end();
console.log('Migration 0016 complete.');
